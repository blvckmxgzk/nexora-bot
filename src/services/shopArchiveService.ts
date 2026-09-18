import mongoose from "mongoose";

import {
  Shop,
} from "../models/Shop.js";

import {
  TradeRequest,
} from "../models/TradeRequest.js";

const ACTIVE_TRADE_STATUSES = [
  "waiting_seller",
  "contacted",
  "buyer_confirmed",
];

export const shopArchiveService = {
  async archiveShop(
    data: {
      ownerId:
        string;

      actorId:
        string;

      reason?:
        string;
    },
  ) {
    const session =
      await mongoose
        .startSession();

    let archivedShop:
      any =
        null;

    let forumThreadId:
      string |
      null =
        null;

    try {
      await session.withTransaction(
        async () => {
          const shop =
            await Shop.findOne({
              ownerId:
                data.ownerId,
            })
              .session(
                session,
              );

          if (!shop) {
            throw new Error(
              "ไม่พบร้านค้าของคุณ",
            );
          }

          if (
            shop.deletedAt
          ) {
            archivedShop =
              shop;

            forumThreadId =
              shop.archivedForumThreadId ??
              shop.forumThreadId ??
              null;

            return;
          }

          const activeTrade =
            await TradeRequest
              .exists({
                shopId:
                  shop.shopId,

                status: {
                  $in:
                    ACTIVE_TRADE_STATUSES,
                },
              })
              .session(
                session,
              );

          if (
            activeTrade
          ) {
            throw new Error(
              "ไม่สามารถ Archive ร้านได้ เนื่องจากยังมี Trade Request ที่กำลังดำเนินการอยู่",
            );
          }

          forumThreadId =
            shop.forumThreadId ??
            null;

          const rememberStatus =
            shop.status ===
              "pending" ||
            shop.status ===
              "verified" ||
            shop.status ===
              "rejected";

          archivedShop =
            await Shop
              .findOneAndUpdate(
                {
                  _id:
                    shop._id,

                  deletedAt:
                    null,
                },

                {
                  $set: {
                    status:
                      "closed",

                    closedFromStatus:
                      rememberStatus
                        ? shop.status
                        : (
                            shop.closedFromStatus ??
                            null
                          ),

                    archivedForumThreadId:
                      forumThreadId,

                    forumThreadId:
                      null,

                    deletedAt:
                      new Date(),

                    deletedBy:
                      data.actorId,

                    deleteReason:
                      data.reason
                        ?.trim()
                        .slice(
                          0,
                          500,
                        ) ||
                      "Archived by seller",

                    autoOpenClose:
                      false,
                  },
                },

                {
                  new:
                    true,

                  session,
                },
              );

          if (
            !archivedShop
          ) {
            throw new Error(
              "ไม่สามารถ Archive ร้านค้าได้",
            );
          }
        },
      );

      if (
        !archivedShop
      ) {
        throw new Error(
          "Shop archive ไม่ได้ผลลัพธ์",
        );
      }

      return {
        shop:
          archivedShop,

        forumThreadId,
      };
    } finally {
      await session
        .endSession();
    }
  },
};
