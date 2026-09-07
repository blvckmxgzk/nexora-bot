import {
  Payment,
} from "../../models/Payment.js";

import {
  Order,
} from "../../models/Order.js";

import {
  Refund,
} from "../../models/Refund.js";

import {
  Payout,
} from "../../models/Payout.js";

import {
  SellerLedgerEntry,
} from "../../models/SellerLedgerEntry.js";

import {
  SellerFinancialState,
} from "../../models/SellerFinancialState.js";

import {
  Dispute,
} from "../../models/Dispute.js";

import {
  RiskReview,
} from "../../models/RiskReview.js";

import {
  financialIntegrityService,
} from "./financialIntegrityService.js";

interface FinancialHealthLike {
  negativeSellerBalanceCount:
    number;

  openPayoutCount:
    number;

  conservativeTotalCoverageGapSatang:
    number;

  transferableAfterReservedDemandSatang:
    number;

  [key:
    string]:
    unknown;
}

async function auditLedgerAccounting() {
  const sales =
    await SellerLedgerEntry
      .find({
        type:
          "sale_credit",
      })
      .lean();

  let unresolvedSaleLedgerCount =
    0;

  let unresolvedRefundLedgerCount =
    0;

  for (
    const sale
    of sales
  ) {
    const payment =
      await Payment
        .findOne({
          orderId:
            sale.orderId,
        })
        .lean();

    if (
      !payment ||
      payment.accountingPolicy !==
        "seller_pays_provider_fee" ||
      typeof payment
        .sellerNetSatang !==
        "number" ||
      !Number.isSafeInteger(
        payment
          .sellerNetSatang,
      )
    ) {
      unresolvedSaleLedgerCount++;
      continue;
    }

    const saleAdjustment =
      await SellerLedgerEntry
        .findOne({
          sourceKey:
            `accounting-adjustment:sale:${sale.orderId}`,
        })
        .lean();

    const effectiveSale =
      sale.amountSatang +
      (
        saleAdjustment
          ?.amountSatang ??
        0
      );

    if (
      effectiveSale !==
      payment.sellerNetSatang
    ) {
      unresolvedSaleLedgerCount++;
    }

    const refund =
      await SellerLedgerEntry
        .findOne({
          orderId:
            sale.orderId,

          type:
            "refund_debit",
        })
        .lean();

    if (!refund) {
      continue;
    }

    const sourceKey =
      `accounting-adjustment:refund:${refund.refundId ?? sale.orderId}`;

    const refundAdjustment =
      await SellerLedgerEntry
        .findOne({
          sourceKey,
        })
        .lean();

    const effectiveRefund =
      refund.amountSatang +
      (
        refundAdjustment
          ?.amountSatang ??
        0
      );

    if (
      effectiveRefund !==
      -payment.sellerNetSatang
    ) {
      unresolvedRefundLedgerCount++;
    }
  }

  return {
    saleLedgerCount:
      sales.length,

    unresolvedSaleLedgerCount,

    unresolvedRefundLedgerCount,
  };
}

async function auditDisputeAccounting() {
  const disputes =
    await Dispute
      .find({})
      .lean();

  let disputeLedgerMismatchCount =
    0;

  for (
    const dispute
    of disputes
  ) {
    const liability =
      dispute
        .sellerLiabilitySatang;

    if (
      !Number.isSafeInteger(
        liability,
      ) ||
      liability <
        0
    ) {
      disputeLedgerMismatchCount++;
      continue;
    }

    const loss =
      await SellerLedgerEntry
        .findOne({
          sourceKey:
            `dispute-loss:${dispute.providerDisputeId}`,
        })
        .lean();

    if (
      dispute.status ===
        "lost" &&
      liability >
        0
    ) {
      if (
        !loss ||
        loss.amountSatang !==
          -liability
      ) {
        disputeLedgerMismatchCount++;
      }
    }

    const providerCreditConfirmed =
      dispute.metadata
        ?.providerCreditConfirmed ===
      true;

    if (
      dispute.status ===
        "won" &&
      providerCreditConfirmed &&
      loss
    ) {
      const recovery =
        await SellerLedgerEntry
          .findOne({
            sourceKey:
              `dispute-recovery:${dispute.providerDisputeId}`,
          })
          .lean();

      if (
        !recovery ||
        recovery.amountSatang !==
          -loss.amountSatang
      ) {
        disputeLedgerMismatchCount++;
      }
    }
  }

  return {
    disputeCount:
      disputes.length,

    disputeLedgerMismatchCount,
  };
}

export async function runPreLiveFinancialAudit(
  options: {
    getHealthReport?:
      () =>
        Promise<
          FinancialHealthLike
        >;
  } = {},
) {
  const getHealthReport =
    options.getHealthReport ??
    (
      async () =>
        financialIntegrityService
          .getHealthReport()
    );

  const [
    legacyPaymentCount,
    missingProviderPaymentIdCount,
    openPaymentCount,
    openRefundCount,
    openPayoutCount,
    disputedOrderCount,
    missingCategoryOpenOrderCount,
    activeDisputeCount,
    unresolvedLostDisputeCount,
    wonPendingCreditCount,
    frozenSellerCount,
    pendingRiskReviewCount,
    pendingPayoutRiskReviewCount,
    pendingRefundRiskReviewCount,
    ledgerSellerIds,
  ] =
    await Promise.all([
      Payment.countDocuments({
        status: {
          $in: [
            "paid",
            "refunded",
          ],
        },

        accountingPolicy: {
          $ne:
            "seller_pays_provider_fee",
        },
      }),

      Payment.countDocuments({
        status: {
          $in: [
            "paid",
            "refunded",
          ],
        },

        $or: [
          {
            providerPaymentId:
              null,
          },
          {
            providerPaymentId: {
              $exists:
                false,
            },
          },
        ],
      }),

      Payment.countDocuments({
        status: {
          $in: [
            "creating",
            "pending",
          ],
        },
      }),

      Refund.countDocuments({
        status: {
          $in: [
            "requested",
            "approved",
            "processing",
            "failed",
          ],
        },
      }),

      Payout.countDocuments({
        status: {
          $in: [
            "reserved",
            "creating_transfer",
            "submitted",
            "sent",
          ],
        },
      }),

      /*
       * Historical LOST dispute ที่ Admin
       * resolve แล้วอาจคง status=disputed
       * เพื่อเก็บประวัติ
       *
       * block เฉพาะ Order ที่ยังมี
       * active dispute blocker
       */
      Order.countDocuments({
        status:
          "disputed",

        "metadata.activeDisputeId": {
          $type:
            "string",
        },
      }),

      Order.countDocuments({
        status: {
          $in: [
            "pending",
            "awaiting_payment",
          ],
        },

        $or: [
          {
            productCategory: {
              $exists:
                false,
            },
          },
          {
            productCategory:
              null,
          },
        ],
      }),

      Dispute.countDocuments({
        status: {
          $in: [
            "open",
            "pending",
          ],
        },
      }),

      Dispute.countDocuments({
        status:
          "lost",

        riskResolvedAt:
          null,
      }),

      Dispute.countDocuments({
        status:
          "won",

        "metadata.providerCreditConfirmed": {
          $ne:
            true,
        },
      }),

      SellerFinancialState
        .countDocuments({
          payoutFrozen:
            true,
        }),

      RiskReview.countDocuments({
        status:
          "pending",
      }),

      RiskReview.countDocuments({
        status:
          "pending",

        resourceType:
          "payout",
      }),

      RiskReview.countDocuments({
        status:
          "pending",

        resourceType:
          "refund",
      }),

      SellerLedgerEntry
        .distinct(
          "sellerId",
        ),
    ]);

  const financialStateSellerIds =
    await SellerFinancialState
      .distinct(
        "sellerId",
        {
          sellerId: {
            $in:
              ledgerSellerIds,
          },
        },
      );

  const stateSet =
    new Set(
      financialStateSellerIds,
    );

  const missingFinancialStateCount =
    ledgerSellerIds
      .filter(
        (
          sellerId,
        ) =>
          !stateSet.has(
            sellerId,
          ),
      )
      .length;

  const ledgerAudit =
    await auditLedgerAccounting();

  const disputeAudit =
    await auditDisputeAccounting();

  const health =
    await getHealthReport();

  const reasons:
    string[] =
      [];

  if (
    legacyPaymentCount >
    0
  ) {
    reasons.push(
      `${legacyPaymentCount} paid/refunded Payments ยังไม่มี provider-net accounting`,
    );
  }

  if (
    missingProviderPaymentIdCount >
    0
  ) {
    reasons.push(
      `${missingProviderPaymentIdCount} financial Payments ไม่มี Provider Payment ID`,
    );
  }

  if (
    ledgerAudit
      .unresolvedSaleLedgerCount >
    0
  ) {
    reasons.push(
      `${ledgerAudit.unresolvedSaleLedgerCount} sale ledger entries ยังไม่ reconcile กับ Seller net`,
    );
  }

  if (
    ledgerAudit
      .unresolvedRefundLedgerCount >
    0
  ) {
    reasons.push(
      `${ledgerAudit.unresolvedRefundLedgerCount} refund ledger entries ยังไม่ reconcile กับ Seller net`,
    );
  }

  if (
    missingFinancialStateCount >
    0
  ) {
    reasons.push(
      `${missingFinancialStateCount} Sellers ยังไม่มี SellerFinancialState`,
    );
  }

  if (
    openPaymentCount >
    0
  ) {
    reasons.push(
      `${openPaymentCount} Payments ยังอยู่ระหว่างดำเนินการ`,
    );
  }

  if (
    openRefundCount >
    0
  ) {
    reasons.push(
      `${openRefundCount} Refunds ยังไม่ terminal`,
    );
  }

  if (
    openPayoutCount >
    0
  ) {
    reasons.push(
      `${openPayoutCount} Payouts ยังไม่ terminal`,
    );
  }

  if (
    disputedOrderCount >
    0
  ) {
    reasons.push(
      `${disputedOrderCount} Orders อยู่ในสถานะ disputed`,
    );
  }

  if (
    missingCategoryOpenOrderCount >
    0
  ) {
    reasons.push(
      `${missingCategoryOpenOrderCount} open Orders ไม่มี trusted productCategory snapshot`,
    );
  }

  if (
    activeDisputeCount >
    0
  ) {
    reasons.push(
      `${activeDisputeCount} Provider Disputes ยังอยู่ open/pending`,
    );
  }

  if (
    unresolvedLostDisputeCount >
    0
  ) {
    reasons.push(
      `${unresolvedLostDisputeCount} unresolved LOST Disputes ยัง freeze Financial Risk`,
    );
  }

  if (
    wonPendingCreditCount >
    0
  ) {
    reasons.push(
      `${wonPendingCreditCount} WON Disputes ยังไม่มี Provider credit confirmation`,
    );
  }

  if (
    frozenSellerCount >
    0
  ) {
    reasons.push(
      `${frozenSellerCount} Sellers ยังถูก payout freeze`,
    );
  }

  if (
    pendingRiskReviewCount >
    0
  ) {
    reasons.push(
      `${pendingRiskReviewCount} Marketplace Risk Reviews ยัง pending (${pendingPayoutRiskReviewCount} payout / ${pendingRefundRiskReviewCount} refund)`,
    );
  }

  if (
    disputeAudit
      .disputeLedgerMismatchCount >
    0
  ) {
    reasons.push(
      `${disputeAudit.disputeLedgerMismatchCount} Dispute ledger records ไม่ reconcile`,
    );
  }

  if (
    health
      .negativeSellerBalanceCount >
    0
  ) {
    reasons.push(
      `${health.negativeSellerBalanceCount} Sellers มียอดติดลบ`,
    );
  }

  if (
    health
      .conservativeTotalCoverageGapSatang <
    0
  ) {
    reasons.push(
      `Provider total balance ขาด coverage ${Math.abs(
        health
          .conservativeTotalCoverageGapSatang,
      )} satang`,
    );
  }

  if (
    health
      .transferableAfterReservedDemandSatang <
    0
  ) {
    reasons.push(
      `Provider transferable balance ต่ำกว่า reserved payout demand ${Math.abs(
        health
          .transferableAfterReservedDemandSatang,
      )} satang`,
    );
  }

  return {
    status:
      reasons.length ===
      0
        ? "READY"
        : "NOT_READY",

    ready:
      reasons.length ===
      0,

    checkedAt:
      new Date(),

    reasons,

    legacyPaymentCount,

    missingProviderPaymentIdCount,

    openPaymentCount,

    openRefundCount,

    openPayoutCount,

    disputedOrderCount,

    missingCategoryOpenOrderCount,

    missingFinancialStateCount,

    activeDisputeCount,

    unresolvedLostDisputeCount,

    wonPendingCreditCount,

    frozenSellerCount,

    pendingRiskReviewCount,

    pendingPayoutRiskReviewCount,

    pendingRefundRiskReviewCount,

    ...ledgerAudit,

    ...disputeAudit,

    health,

    /*
     * IMPORTANT:
     * READY ตรงนี้หมายถึง
     * financial data migration gate เท่านั้น
     *
     * Live Omise ยังถูก block อยู่
     */
    liveModeEnabled:
      false,
  } as const;
}
