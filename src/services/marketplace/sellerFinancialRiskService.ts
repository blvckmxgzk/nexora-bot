import type {
  ClientSession,
} from "mongoose";

import {
  SellerFinancialState,
} from "../../models/SellerFinancialState.js";

import {
  Dispute,
} from "../../models/Dispute.js";

async function lockState(
  sellerId:
    string,

  shopId:
    string,

  session:
    ClientSession,
) {
  const state =
    await SellerFinancialState
      .findOneAndUpdate(
        {
          sellerId,
        },
        {
          $setOnInsert: {
            sellerId,
            shopId,
          },

          $inc: {
            revision:
              1,
          },
        },
        {
          upsert:
            true,

          new:
            true,

          session,
        },
      );

  if (!state) {
    throw new Error(
      "ไม่สามารถ lock SellerFinancialState ได้",
    );
  }

  if (
    state.shopId !==
    shopId
  ) {
    throw new Error(
      "SellerFinancialState shop identity ไม่ตรงกัน",
    );
  }

  return state;
}

export const sellerFinancialRiskService = {
  async assertPayoutAllowed(
    sellerId:
      string,

    shopId:
      string,

    session:
      ClientSession,
  ) {
    const state =
      await lockState(
        sellerId,
        shopId,
        session,
      );

    if (
      state.payoutFrozen ===
      true
    ) {
      throw new Error(
        `การถอนเงินถูกระงับชั่วคราวเนื่องจาก Financial Risk (${state.riskStatus ?? "unknown"})`,
      );
    }

    return state;
  },

  async refreshSellerRisk(
    sellerId:
      string,

    shopId:
      string,

    session:
      ClientSession,
  ) {
    const state =
      await lockState(
        sellerId,
        shopId,
        session,
      );

    const lost =
      await Dispute
        .findOne({
          sellerId,

          status:
            "lost",

          riskResolvedAt:
            null,
        })
        .sort({
          updatedAt:
            -1,
        })
        .session(
          session,
        );

    const active =
      await Dispute
        .findOne({
          sellerId,

          status: {
            $in: [
              "open",
              "pending",
            ],
          },
        })
        .sort({
          updatedAt:
            -1,
        })
        .session(
          session,
        );

    const wonPendingCredit =
      await Dispute
        .findOne({
          sellerId,

          status:
            "won",

          "metadata.providerCreditConfirmed": {
            $ne:
              true,
          },
        })
        .sort({
          updatedAt:
            -1,
        })
        .session(
          session,
        );

    const blocker =
      lost ??
      active ??
      wonPendingCredit;

    if (!blocker) {
      state.payoutFrozen =
        false;

      state.riskStatus =
        "clear";

      state.riskReason =
        null;

      state.riskDisputeId =
        null;

      state.riskUpdatedAt =
        new Date();
    } else {
      state.payoutFrozen =
        true;

      state.riskStatus =
        blocker.status ===
          "lost"
          ? "dispute_lost"
          : "dispute_review";

      state.riskReason =
        blocker.status ===
          "won"
          ? "Provider dispute WON แต่ยังไม่พบ credit transaction ครบ"
          : `Provider dispute อยู่ในสถานะ ${blocker.status}`;

      state.riskDisputeId =
        blocker.disputeId;

      state.riskUpdatedAt =
        new Date();
    }

    await state.save({
      session,
    });

    return state;
  },
};
