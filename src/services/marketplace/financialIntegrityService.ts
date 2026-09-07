import {
  SellerLedgerEntry,
} from "../../models/SellerLedgerEntry.js";

import {
  Payout,
} from "../../models/Payout.js";

import {
  Dispute,
} from "../../models/Dispute.js";

import {
  SellerFinancialState,
} from "../../models/SellerFinancialState.js";

import {
  RiskReview,
} from "../../models/RiskReview.js";

import type {
  PayoutProviderName,
} from "../payment/payoutProvider.js";

import {
  payoutProviderRegistry,
} from "../payment/payoutProviderRegistry.js";

interface SellerBalanceRow {
  _id:
    string;

  balanceSatang:
    number;
}

interface PayoutStatusRow {
  _id:
    string;

  amountSatang:
    number;

  count:
    number;
}

function safeAdd(
  left:
    number,

  right:
    number,
): number {
  const value =
    left +
    right;

  if (
    !Number.isSafeInteger(
      value,
    )
  ) {
    throw new Error(
      "Financial health aggregation เกิน safe integer",
    );
  }

  return value;
}

export const financialIntegrityService = {
  async getHealthReport(
    providerName:
      PayoutProviderName =
        "omise",
  ) {
    const sellerBalances =
      await SellerLedgerEntry
        .aggregate<SellerBalanceRow>([
          {
            $group: {
              _id:
                "$sellerId",

              balanceSatang: {
                $sum:
                  "$amountSatang",
              },
            },
          },
        ]);

    let ledgerAvailableLiabilitySatang =
      0;

    let negativeSellerBalanceExposureSatang =
      0;

    let positiveSellerBalanceCount =
      0;

    let negativeSellerBalanceCount =
      0;

    for (
      const row
      of sellerBalances
    ) {
      if (
        !Number.isSafeInteger(
          row.balanceSatang,
        )
      ) {
        throw new Error(
          `Seller Ledger balance ไม่ใช่ safe integer: ${row._id}`,
        );
      }

      if (
        row.balanceSatang >
        0
      ) {
        positiveSellerBalanceCount++;

        ledgerAvailableLiabilitySatang =
          safeAdd(
            ledgerAvailableLiabilitySatang,
            row.balanceSatang,
          );
      } else if (
        row.balanceSatang <
        0
      ) {
        negativeSellerBalanceCount++;

        negativeSellerBalanceExposureSatang =
          safeAdd(
            negativeSellerBalanceExposureSatang,
            Math.abs(
              row.balanceSatang,
            ),
          );
      }
    }

    const payoutRows =
      await Payout
        .aggregate<PayoutStatusRow>([
          {
            $match: {
              status: {
                $in: [
                  "reserved",
                  "creating_transfer",
                  "submitted",
                  "sent",
                ],
              },
            },
          },

          {
            $group: {
              _id:
                "$status",

              amountSatang: {
                $sum:
                  "$amountSatang",
              },

              count: {
                $sum:
                  1,
              },
            },
          },
        ]);

    let openPayoutLiabilitySatang =
      0;

    let openPayoutCount =
      0;

    let reservedPayoutDemandSatang =
      0;

    for (
      const row
      of payoutRows
    ) {
      if (
        !Number.isSafeInteger(
          row.amountSatang,
        ) ||
        row.amountSatang <
          0
      ) {
        throw new Error(
          `Payout liability aggregation ไม่ถูกต้อง: ${row._id}`,
        );
      }

      openPayoutLiabilitySatang =
        safeAdd(
          openPayoutLiabilitySatang,
          row.amountSatang,
        );

      openPayoutCount +=
        row.count;

      if (
        row._id ===
        "reserved"
      ) {
        reservedPayoutDemandSatang =
          row.amountSatang;
      }
    }

    /*
     * Ledger balance หัก payout_reserve ไปแล้ว
     * ดังนั้นต้องบวก open payout กลับเพื่อหา
     * outstanding seller obligation ทั้งหมด
     */
    const totalOutstandingSellerLiabilitySatang =
      safeAdd(
        ledgerAvailableLiabilitySatang,
        openPayoutLiabilitySatang,
      );

    const [
      activeDisputeCount,
      unresolvedLostDisputeCount,
      wonPendingCreditCount,
      frozenSellerCount,
      disputeExposureRows,
    ] =
      await Promise.all([
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

        Dispute.aggregate<{
          exposureSatang:
            number;
        }>([
          {
            $project: {
              exposureSatang: {
                $max: [
                  0,
                  {
                    $subtract: [
                      {
                        $ifNull: [
                          "$providerDebitSatang",
                          0,
                        ],
                      },

                      {
                        $ifNull: [
                          "$providerCreditSatang",
                          0,
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },

          {
            $group: {
              _id:
                null,

              exposureSatang: {
                $sum:
                  "$exposureSatang",
              },
            },
          },
        ]),
      ]);

    const providerDisputeNetDebitExposureSatang =
      disputeExposureRows[0]
        ?.exposureSatang ??
      0;

    if (
      !Number.isSafeInteger(
        providerDisputeNetDebitExposureSatang,
      ) ||
      providerDisputeNetDebitExposureSatang <
        0
    ) {
      throw new Error(
        "Dispute provider exposure aggregation ไม่ถูกต้อง",
      );
    }

    const unresolvedRiskDisputeCount =
      activeDisputeCount +
      unresolvedLostDisputeCount +
      wonPendingCreditCount;

    const [
      pendingRiskReviewCount,
      pendingPayoutRiskReviewCount,
      pendingRefundRiskReviewCount,
    ] =
      await Promise.all([
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
      ]);

    const provider =
      payoutProviderRegistry.get(
        providerName,
      );

    const providerBalance =
      await provider
        .retrieveBalance();

    if (
      providerBalance.currency !==
      "THB"
    ) {
      throw new Error(
        "Provider financial health currency ต้องเป็น THB",
      );
    }

    return {
      checkedAt:
        new Date(),

      provider:
        providerName,

      sellerBalanceCount:
        sellerBalances.length,

      positiveSellerBalanceCount,

      negativeSellerBalanceCount,

      ledgerAvailableLiabilitySatang,

      negativeSellerBalanceExposureSatang,

      openPayoutCount,

      openPayoutLiabilitySatang,

      reservedPayoutDemandSatang,

      totalOutstandingSellerLiabilitySatang,

      activeDisputeCount,

      unresolvedLostDisputeCount,

      wonPendingCreditCount,

      unresolvedRiskDisputeCount,

      frozenSellerCount,

      providerDisputeNetDebitExposureSatang,

      pendingRiskReviewCount,

      pendingPayoutRiskReviewCount,

      pendingRefundRiskReviewCount,

      providerBalance,

      /*
       * Conservative snapshot:
       * submitted/sent Transfer อาจอยู่ระหว่าง
       * เคลื่อนออกจาก provider แล้ว
       */
      conservativeTotalCoverageGapSatang:
        providerBalance
          .totalSatang -
        totalOutstandingSellerLiabilitySatang,

      transferableAfterReservedDemandSatang:
        providerBalance
          .transferableSatang -
        reservedPayoutDemandSatang,
    };
  },
};
