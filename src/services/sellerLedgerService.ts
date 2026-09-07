import crypto from "node:crypto";

import type {
  ClientSession,
} from "mongoose";

import {
  SellerLedgerEntry,
} from "../models/SellerLedgerEntry.js";

import {
  SellerFinancialState,
} from "../models/SellerFinancialState.js";

import {
  Payment,
} from "../models/Payment.js";

function generateLedgerEntryId():
  string {
  return (
    "LED-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

async function touchFinancialState(
  sellerId: string,
  shopId: string,
  session:
    ClientSession,
): Promise<void> {
  await SellerFinancialState
    .findOneAndUpdate(
      {
        sellerId,
      },
      {
        $setOnInsert: {
          sellerId,
        },

        $set: {
          shopId,
        },

        $inc: {
          revision: 1,
        },
      },
      {
        upsert: true,
        new: true,
        session,
      },
    );
}

async function getBalanceWithSession(
  sellerId: string,
  session:
    ClientSession,
): Promise<number> {
  const result =
    await SellerLedgerEntry
      .aggregate<{
        _id: null;
        balance:
          number;
      }>([
        {
          $match: {
            sellerId,
          },
        },

        {
          $group: {
            _id: null,

            balance: {
              $sum:
                "$amountSatang",
            },
          },
        },
      ])
      .session(
        session,
      );

  return (
    result[0]
      ?.balance ??
    0
  );
}

export function toSatang(
  amount: number,
): number {
  if (
    !Number.isFinite(
      amount,
    ) ||
    amount < 0
  ) {
    throw new Error(
      "จำนวนเงินไม่ถูกต้อง",
    );
  }

  const scaled =
    amount * 100;

  const satang =
    Math.round(
      scaled,
    );

  if (
    !Number.isSafeInteger(
      satang,
    ) ||
    Math.abs(
      scaled - satang,
    ) > 1e-8
  ) {
    throw new Error(
      "จำนวนเงินต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    );
  }

  return satang;
}

export const sellerLedgerService = {
  async creditCompletedOrder(
    order: {
      orderId: string;
      sellerId: string;
      shopId: string;
      totalAmount: number;
      paymentId?:
        string |
        null;
    },

    session:
      ClientSession,
  ) {
    const grossAmountSatang =
      toSatang(
        order.totalAmount,
      );

    if (
      grossAmountSatang ===
      0
    ) {
      return null;
    }

    let sellerNetSatang =
      grossAmountSatang;

    let accountingPolicy:
      "legacy_gross" |
      "seller_pays_provider_fee" =
        "legacy_gross";

    let providerFeeSatang:
      number |
      null =
        null;

    let providerFeeVatSatang:
      number |
      null =
        null;

    let providerDeductionsSatang:
      number |
      null =
        null;

    let providerNetSatang:
      number |
      null =
        null;

    let providerTransactionId:
      string |
      null =
        null;

    if (
      order.paymentId
    ) {
      const payment =
        await Payment.findOne({
          paymentId:
            order.paymentId,
        }).session(
          session,
        );

      if (payment) {
        if (
          payment.orderId !==
            order.orderId ||
          payment.sellerId !==
            order.sellerId ||
          payment.shopId !==
            order.shopId
        ) {
          throw new Error(
            "Payment identity ไม่ตรงกับ Order สำหรับ Seller Ledger",
          );
        }

        if (
          payment.accountingPolicy ===
          "seller_pays_provider_fee"
        ) {
          /*
           * เก็บลง local variables ก่อน
           * เพื่อให้ TypeScript narrow
           * number | null | undefined
           * ได้อย่างถูกต้อง
           */
          const paymentGrossAmountSatang =
            payment
              .grossAmountSatang;

          const paymentSellerNetSatang =
            payment
              .sellerNetSatang;

          if (
            typeof paymentGrossAmountSatang !==
              "number" ||
            !Number.isSafeInteger(
              paymentGrossAmountSatang,
            ) ||
            paymentGrossAmountSatang !==
              grossAmountSatang ||
            typeof paymentSellerNetSatang !==
              "number" ||
            !Number.isSafeInteger(
              paymentSellerNetSatang,
            ) ||
            paymentSellerNetSatang <
              0
          ) {
            throw new Error(
              "Payment accounting ไม่พร้อมสำหรับ Seller Ledger credit",
            );
          }

          accountingPolicy =
            "seller_pays_provider_fee";

          sellerNetSatang =
            paymentSellerNetSatang;

          providerFeeSatang =
            payment
              .providerFeeSatang ??
            null;

          providerFeeVatSatang =
            payment
              .providerFeeVatSatang ??
            null;

          providerDeductionsSatang =
            payment
              .providerDeductionsSatang ??
            null;

          providerNetSatang =
            payment
              .providerNetSatang ??
            null;

          providerTransactionId =
            payment
              .providerTransactionId ??
            null;
        }
      }
    }

    /*
     * หาก provider net = 0
     * Seller ไม่มี liability
     */
    if (
      sellerNetSatang ===
      0
    ) {
      return null;
    }

    await touchFinancialState(
      order.sellerId,
      order.shopId,
      session,
    );

    const entry =
      new SellerLedgerEntry({
        ledgerEntryId:
          generateLedgerEntryId(),

        sourceKey:
          `sale:${order.orderId}`,

        sellerId:
          order.sellerId,

        shopId:
          order.shopId,

        orderId:
          order.orderId,

        type:
          "sale_credit",

        amountSatang:
          sellerNetSatang,

        currency:
          "THB",

        metadata: {
          paymentId:
            order.paymentId ??
            null,

          accountingPolicy,

          grossAmountSatang,

          providerFeeSatang,

          providerFeeVatSatang,

          providerDeductionsSatang,

          providerNetSatang,

          sellerNetSatang,

          platformFeeSatang:
            0,

          providerTransactionId,
        },
      });

    await entry.save({
      session,
    });

    return entry;
  },

  async debitRefundIfCredited(
    refund: {
      refundId: string;
      orderId: string;
      sellerId: string;
      shopId: string;
      paymentId: string;
      amount: number;
    },

    session:
      ClientSession,
  ) {
    const saleEntry =
      await SellerLedgerEntry
        .findOne({
          sourceKey:
            `sale:${refund.orderId}`,
        })
        .session(
          session,
        );

    if (!saleEntry) {
      return null;
    }

    const refundGrossSatang =
      toSatang(
        refund.amount,
      );

    if (
      refundGrossSatang ===
      0
    ) {
      return null;
    }

    const metadataGross =
      saleEntry.metadata
        ?.grossAmountSatang;

    const originalGrossSatang =
      Number.isSafeInteger(
        metadataGross,
      )
        ? metadataGross
        : saleEntry
            .amountSatang;

    /*
     * NEXORA Refund ปัจจุบันเป็น
     * full refund เท่านั้น
     *
     * จึง validate กับ original gross
     * ไม่ใช่ Seller net credit
     */
    if (
      refundGrossSatang !==
      originalGrossSatang
    ) {
      throw new Error(
        "ยอด Refund gross ไม่ตรงกับยอดขายเดิม",
      );
    }

    const sellerDebitSatang =
      saleEntry
        .amountSatang;

    if (
      !Number.isSafeInteger(
        sellerDebitSatang,
      ) ||
      sellerDebitSatang <=
        0
    ) {
      throw new Error(
        "Seller sale credit เดิมไม่ถูกต้อง",
      );
    }

    await touchFinancialState(
      refund.sellerId,
      refund.shopId,
      session,
    );

    const sourceKey =
      `refund:${refund.refundId}`;

    const existing =
      await SellerLedgerEntry
        .findOne({
          sourceKey,
        })
        .session(
          session,
        );

    if (existing) {
      return existing;
    }

    const entry =
      new SellerLedgerEntry({
        ledgerEntryId:
          generateLedgerEntryId(),

        sourceKey,

        sellerId:
          refund.sellerId,

        shopId:
          refund.shopId,

        orderId:
          refund.orderId,

        refundId:
          refund.refundId,

        type:
          "refund_debit",

        /*
         * Debit Seller เท่ากับ
         * credit ที่ Seller เคยได้รับ
         *
         * +sale net
         * -sale net
         * = Seller balance กลับ 0
         */
        amountSatang:
          -sellerDebitSatang,

        currency:
          "THB",

        metadata: {
          paymentId:
            refund.paymentId,

          refundGrossAmountSatang:
            refundGrossSatang,

          originalSaleCreditSatang:
            sellerDebitSatang,

          accountingPolicy:
            saleEntry.metadata
              ?.accountingPolicy ??
            "legacy_gross",

          /*
           * Omise อาจคืนหรือไม่คืน
           * original charge fee
           * ตาม refund timing
           *
           * ห้าม assume ว่าคืน
           */
          providerRefundFeeTreatment:
            "not_assumed",

          platformRefundFeeExposure:
            true,
        },
      });

    await entry.save({
      session,
    });

    return entry;
  },

  async applyDisputeLoss(
    dispute: {
      disputeId: string;
      providerDisputeId: string;
      paymentId: string;
      orderId: string;
      sellerId: string;
      shopId: string;
      sellerLiabilitySatang: number;
      amountSatang: number;
      providerDebitSatang: number;
    },

    session:
      ClientSession,
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
      throw new Error(
        "Seller Dispute liability ไม่ถูกต้อง",
      );
    }

    if (
      liability ===
      0
    ) {
      return null;
    }

    const sourceKey =
      `dispute-loss:${dispute.providerDisputeId}`;

    const existing =
      await SellerLedgerEntry
        .findOne({
          sourceKey,
        })
        .session(
          session,
        );

    if (existing) {
      if (
        existing.sellerId !==
          dispute.sellerId ||
        existing.shopId !==
          dispute.shopId ||
        existing.orderId !==
          dispute.orderId ||
        existing.amountSatang !==
          -liability
      ) {
        throw new Error(
          "Dispute loss ledger เดิมไม่ตรงกับ canonical liability",
        );
      }

      return existing;
    }

    await touchFinancialState(
      dispute.sellerId,
      dispute.shopId,
      session,
    );

    const entry =
      new SellerLedgerEntry({
        ledgerEntryId:
          generateLedgerEntryId(),

        sourceKey,

        sellerId:
          dispute.sellerId,

        shopId:
          dispute.shopId,

        orderId:
          dispute.orderId,

        disputeId:
          dispute.disputeId,

        type:
          "dispute_loss_debit",

        amountSatang:
          -liability,

        currency:
          "THB",

        metadata: {
          paymentId:
            dispute.paymentId,

          providerDisputeId:
            dispute.providerDisputeId,

          disputeGrossAmountSatang:
            dispute.amountSatang,

          providerDebitSatang:
            dispute.providerDebitSatang,

          sellerLiabilityPolicy:
            "seller_net_pro_rata_v1",
        },
      });

    await entry.save({
      session,
    });

    return entry;
  },

  async reverseDisputeLoss(
    dispute: {
      disputeId: string;
      providerDisputeId: string;
      paymentId: string;
      orderId: string;
      sellerId: string;
      shopId: string;
      providerCreditSatang: number;
    },

    session:
      ClientSession,
  ) {
    const loss =
      await SellerLedgerEntry
        .findOne({
          sourceKey:
            `dispute-loss:${dispute.providerDisputeId}`,
        })
        .session(
          session,
        );

    if (!loss) {
      return null;
    }

    if (
      loss.sellerId !==
        dispute.sellerId ||
      loss.shopId !==
        dispute.shopId ||
      loss.orderId !==
        dispute.orderId ||
      loss.amountSatang >=
        0
    ) {
      throw new Error(
        "Dispute loss ledger ไม่ถูกต้องสำหรับ recovery",
      );
    }

    const sourceKey =
      `dispute-recovery:${dispute.providerDisputeId}`;

    const existing =
      await SellerLedgerEntry
        .findOne({
          sourceKey,
        })
        .session(
          session,
        );

    if (existing) {
      if (
        existing.amountSatang !==
        -loss.amountSatang
      ) {
        throw new Error(
          "Dispute recovery ledger เดิมไม่ตรงกับ loss",
        );
      }

      return existing;
    }

    await touchFinancialState(
      dispute.sellerId,
      dispute.shopId,
      session,
    );

    const entry =
      new SellerLedgerEntry({
        ledgerEntryId:
          generateLedgerEntryId(),

        sourceKey,

        sellerId:
          dispute.sellerId,

        shopId:
          dispute.shopId,

        orderId:
          dispute.orderId,

        disputeId:
          dispute.disputeId,

        type:
          "dispute_recovery_credit",

        amountSatang:
          -loss.amountSatang,

        currency:
          "THB",

        metadata: {
          paymentId:
            dispute.paymentId,

          providerDisputeId:
            dispute.providerDisputeId,

          providerCreditSatang:
            dispute.providerCreditSatang,

          reversesLedgerEntryId:
            loss.ledgerEntryId,
        },
      });

    await entry.save({
      session,
    });

    return entry;
  },

  async appendAccountingAdjustment(
    data: {
      sourceKey:
        string;

      sellerId:
        string;

      shopId:
        string;

      orderId:
        string;

      amountSatang:
        number;

      metadata?:
        Record<
          string,
          unknown
        >;
    },

    session:
      ClientSession,
  ) {
    if (
      !Number.isSafeInteger(
        data.amountSatang,
      ) ||
      data.amountSatang ===
        0
    ) {
      throw new Error(
        "Accounting adjustment ต้องเป็น safe integer และห้ามเป็น 0",
      );
    }

    if (
      !data.sourceKey
        .startsWith(
          "accounting-adjustment:",
        )
    ) {
      throw new Error(
        "Accounting adjustment sourceKey ไม่ถูกต้อง",
      );
    }

    const existing =
      await SellerLedgerEntry
        .findOne({
          sourceKey:
            data.sourceKey,
        })
        .session(
          session,
        );

    if (existing) {
      if (
        existing.sellerId !==
          data.sellerId ||
        existing.shopId !==
          data.shopId ||
        existing.orderId !==
          data.orderId ||
        existing.amountSatang !==
          data.amountSatang
      ) {
        throw new Error(
          "Accounting adjustment เดิมไม่ตรงกับ migration plan",
        );
      }

      return existing;
    }

    await touchFinancialState(
      data.sellerId,
      data.shopId,
      session,
    );

    const entry =
      new SellerLedgerEntry({
        ledgerEntryId:
          generateLedgerEntryId(),

        sourceKey:
          data.sourceKey,

        sellerId:
          data.sellerId,

        shopId:
          data.shopId,

        orderId:
          data.orderId,

        type:
          data.amountSatang >
          0
            ? "accounting_adjustment_credit"
            : "accounting_adjustment_debit",

        amountSatang:
          data.amountSatang,

        currency:
          "THB",

        metadata: {
          migration:
            "phase60_payment_accounting",

          ...(
            data.metadata ??
            {}
          ),
        },
      });

    await entry.save({
      session,
    });

    return entry;
  },

  async reservePayout(
    payout: {
      payoutId:
        string;

      sellerId:
        string;

      shopId:
        string;

      amountSatang:
        number;
    },

    session:
      ClientSession,
  ) {
    if (
      !Number.isSafeInteger(
        payout.amountSatang,
      ) ||
      payout.amountSatang <=
        0
    ) {
      throw new Error(
        "ยอดถอนเงินไม่ถูกต้อง",
      );
    }

    await touchFinancialState(
      payout.sellerId,
      payout.shopId,
      session,
    );

    const sourceKey =
      `payout-reserve:${payout.payoutId}`;

    const existing =
      await SellerLedgerEntry
        .findOne({
          sourceKey,
        })
        .session(
          session,
        );

    if (existing) {
      return existing;
    }

    const available =
      await getBalanceWithSession(
        payout.sellerId,
        session,
      );

    if (
      available <
      payout.amountSatang
    ) {
      throw new Error(
        "ยอดเงินคงเหลือไม่เพียงพอสำหรับการถอน",
      );
    }

    const entry =
      new SellerLedgerEntry({
        ledgerEntryId:
          generateLedgerEntryId(),

        sourceKey,

        sellerId:
          payout.sellerId,

        shopId:
          payout.shopId,

        payoutId:
          payout.payoutId,

        type:
          "payout_reserve",

        amountSatang:
          -payout.amountSatang,

        currency:
          "THB",
      });

    await entry.save({
      session,
    });

    return entry;
  },

  async releasePayout(
    payout: {
      payoutId:
        string;

      sellerId:
        string;

      shopId:
        string;

      amountSatang:
        number;
    },

    session:
      ClientSession,
  ) {
    await touchFinancialState(
      payout.sellerId,
      payout.shopId,
      session,
    );

    const reserve =
      await SellerLedgerEntry
        .findOne({
          sourceKey:
            `payout-reserve:${payout.payoutId}`,
        })
        .session(
          session,
        );

    if (!reserve) {
      throw new Error(
        "ไม่พบ Payout reservation สำหรับคืนยอดเงิน",
      );
    }

    if (
      reserve.amountSatang !==
      -payout.amountSatang
    ) {
      throw new Error(
        "ยอด Payout reservation ไม่ตรงกัน",
      );
    }

    const sourceKey =
      `payout-release:${payout.payoutId}`;

    const existing =
      await SellerLedgerEntry
        .findOne({
          sourceKey,
        })
        .session(
          session,
        );

    if (existing) {
      return existing;
    }

    const entry =
      new SellerLedgerEntry({
        ledgerEntryId:
          generateLedgerEntryId(),

        sourceKey,

        sellerId:
          payout.sellerId,

        shopId:
          payout.shopId,

        payoutId:
          payout.payoutId,

        type:
          "payout_release",

        amountSatang:
          payout.amountSatang,

        currency:
          "THB",
      });

    await entry.save({
      session,
    });

    return entry;
  },

  async getAvailableBalanceSatang(
    sellerId: string,
  ): Promise<number> {
    const result =
      await SellerLedgerEntry
        .aggregate<{
          _id: null;

          balance:
            number;
        }>([
          {
            $match: {
              sellerId,
            },
          },

          {
            $group: {
              _id: null,

              balance: {
                $sum:
                  "$amountSatang",
              },
            },
          },
        ]);

    return (
      result[0]
        ?.balance ??
      0
    );
  },
};
