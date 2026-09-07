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
    const amountSatang =
      toSatang(
        order.totalAmount,
      );

    if (
      amountSatang ===
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

        amountSatang,

        currency:
          "THB",

        metadata: {
          paymentId:
            order.paymentId ??
            null,
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

    const amountSatang =
      toSatang(
        refund.amount,
      );

    if (
      amountSatang ===
      0
    ) {
      return null;
    }

    if (
      amountSatang !==
      saleEntry.amountSatang
    ) {
      throw new Error(
        "ยอด Refund ไม่ตรงกับ Seller Ledger credit เดิม",
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

        amountSatang:
          -amountSatang,

        currency:
          "THB",

        metadata: {
          paymentId:
            refund.paymentId,
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
