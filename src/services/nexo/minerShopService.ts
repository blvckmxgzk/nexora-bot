import crypto from "node:crypto";

import mongoose from "mongoose";

import {
  Economy,
} from "../../models/Economy.js";

import {
  Transaction,
} from "../../models/Transaction.js";

import {
  MinerProfile,
} from "../../models/MinerProfile.js";

import {
  MinerInventoryItem,
} from "../../models/MinerInventoryItem.js";

import {
  MINER_ITEM_CATALOG,
  MINER_ITEM_MAP,
} from "../../game/nexoMiner/itemCatalog.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

function transactionId() {
  return (
    "NXSHOP-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

export const minerShopService = {
  getCatalog() {
    return MINER_ITEM_CATALOG
      .filter((item) => item.shopPrice !== null)
      .sort((a, b) =>
        new NexoNumber(a.shopPrice!).cmp(b.shopPrice!),
      );
  },

  async buy(
    discordId:
      string,

    itemId:
      string,

    quantity =
      1,
  ) {
    const item =
      MINER_ITEM_MAP.get(
        itemId,
      );

    if (
      !item ||
      item.shopPrice ===
      null
    ) {
      throw new Error(
        "Item นี้ไม่มีขายใน Miner Shop",
      );
    }

    const safeQuantity =
      Math.max(
        1,
        Math.min(
          100,
          Math.trunc(
            quantity,
          ),
        ),
      );

    const total =
      new NexoNumber(
        item.shopPrice,
      ).mul(
        safeQuantity,
      );

    const session =
      await mongoose
        .startSession();

    let result:
      any =
        null;

    try {
      await session
        .withTransaction(
          async () => {
            const profile =
              await MinerProfile
                .findOne({
                  discordId,
                })
                .session(
                  session,
                );

            if (!profile) {
              throw new Error(
                "ต้องสร้าง `/miner create` ก่อน",
              );
            }

            const economy =
              await Economy
                .findOne({
                  discordId,
                })
                .session(
                  session,
                );

            if (!economy) {
              throw new Error(
                "ไม่พบ NEXO Wallet",
              );
            }

            const before =
              new NexoNumber(
                economy.balance,
              );

            const availableBalance =
              before.sub(
                economy.reservedBalance ??
                  "0",
              );

            if (
              availableBalance.lt(
                total,
              )
            ) {
              throw new Error(
                "NEXO ที่ใช้งานได้ไม่เพียงพอ",
              );
            }

            const after =
              before.sub(
                total,
              );

            economy.balance =
              after.toStorage();

            economy.lifetimeSpent =
              new NexoNumber(
                economy
                  .lifetimeSpent,
              )
                .add(
                  total,
                )
                .toStorage();

            await economy.save({
              session,
            });

            await MinerInventoryItem
              .findOneAndUpdate(
                {
                  discordId,
                  itemId,
                },
                {
                  $inc: {
                    quantity:
                      safeQuantity,
                  },

                  $set: {
                    lastSource:
                      "shop",
                  },

                  $setOnInsert: {
                    tradeLockedQuantity:
                      0,
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

            await Transaction.create(
              [
                {
                  transactionId:
                    transactionId(),

                  discordId,

                  type:
                    "purchase",

                  amount:
                    total
                      .toStorage(),

                  balanceBefore:
                    before
                      .toStorage(),

                  balanceAfter:
                    after
                      .toStorage(),

                  description:
                    `Miner Shop: ${itemId}`,

                  metadata: {
                    itemId,
                    quantity:
                      safeQuantity,
                  },
                },
              ],
              {
                session,
              },
            );

            result = {
              item,
              quantity:
                safeQuantity,

              total:
                total
                  .toStorage(),

              balance:
                after
                  .toStorage(),
            };
          },
        );
    } finally {
      await session
        .endSession();
    }

    return result;
  },
};
