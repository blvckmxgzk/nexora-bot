import mongoose from "mongoose";

import {
  Shop,
} from "../models/Shop.js";

import {
  Order,
} from "../models/Order.js";

import {
  Refund,
} from "../models/Refund.js";

import {
  Payout,
} from "../models/Payout.js";

const ACTIVE_ORDER_STATUSES = [
  "pending",
  "awaiting_payment",
  "paid",
  "processing",
  "disputed",
];

const ACTIVE_REFUND_STATUSES = [
  "requested",
  "approved",
  "processing",
  "failed",
];

const ACTIVE_PAYOUT_STATUSES = [
  "reserved",
  "creating_transfer",
  "submitted",
  "sent",
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
      any = null;

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

          /*
           * Idempotent archive
           */
          if (shop.deletedAt) {
            archivedShop =
              shop;

            forumThreadId =
              shop.archivedForumThreadId ??
              shop.forumThreadId ??
              null;

            return;
          }

          const activeOrder =
            await Order.exists({
              shopId:
                shop.shopId,

              status: {
                $in:
                  ACTIVE_ORDER_STATUSES,
              },
            })
              .session(
                session,
              );

          if (activeOrder) {
            throw new Error(
              "ไม่สามารถ archive ร้านได้ เนื่องจากยังมีคำสั่งซื้อที่กำลังดำเนินการอยู่",
            );
          }

          const activeRefund =
            await Refund.exists({
              shopId:
                shop.shopId,

              status: {
                $in:
                  ACTIVE_REFUND_STATUSES,
              },
            })
              .session(
                session,
              );

          if (activeRefund) {
            throw new Error(
              "ไม่สามารถ archive ร้านได้ เนื่องจากยังมี Refund ที่ต้องดำเนินการ",
            );
          }

          const activePayout =
            await Payout.exists({
              sellerId:
                shop.ownerId,

              status: {
                $in:
                  ACTIVE_PAYOUT_STATUSES,
              },
            })
              .session(
                session,
              );

          if (activePayout) {
            throw new Error(
              "ไม่สามารถ archive ร้านได้ เนื่องจากยังมี Payout ที่กำลังดำเนินการอยู่",
            );
          }

          forumThreadId =
            shop.forumThreadId ??
            null;

          const canRememberStatus =
            shop.status ===
              "pending" ||
            shop.status ===
              "verified" ||
            shop.status ===
              "rejected";

          const archived =
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
                      canRememberStatus
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
                  new: true,
                  session,
                },
              );

          if (!archived) {
            throw new Error(
              "ไม่สามารถ archive ร้านค้าได้",
            );
          }

          archivedShop =
            archived;
        },
      );

      if (!archivedShop) {
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
      await session.endSession();
    }
  },
};
