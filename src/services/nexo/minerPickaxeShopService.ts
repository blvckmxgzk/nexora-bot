import crypto from "node:crypto";

import mongoose from "mongoose";

import {
  Economy,
} from "../../models/Economy.js";

import {
  MinerProfile,
} from "../../models/MinerProfile.js";

import {
  MinerPickaxe,
} from "../../models/MinerPickaxe.js";

import {
  Transaction,
} from "../../models/Transaction.js";

import {
  PICKAXE_MAP,
} from "../../game/nexoMiner/pickaxeCatalog.js";

import {
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

const SHOP_MAX_RARITY_TIER =
  5;

const REQUIRED_POWER_LEVEL: Record<
  number,
  number
> = {
  1: 3,
  2: 8,
  3: 15,
  4: 25,
  5: 40,
};

function createInstanceId() {
  return (
    "PXA-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function createTransactionId() {
  return (
    "NXPICK-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function definitionNetWorth(
  definition: any,
) {
  const value =
    definition.netWorth ??
    definition.baseNetWorth;

  if (
    value ===
    undefined ||
    value ===
    null
  ) {
    throw new Error(
      `Pickaxe ${definition.id} ไม่มี Networth`,
    );
  }

  return new NexoNumber(
    value,
  );
}

function definitionPower(
  definition: any,
) {
  const value =
    definition.basePower ??
    definition.power;

  if (
    value ===
    undefined ||
    value ===
    null
  ) {
    throw new Error(
      `Pickaxe ${definition.id} ไม่มี Base Power`,
    );
  }

  return new NexoNumber(
    value,
  );
}

function definitionLuck(
  definition: any,
) {
  const value =
    definition.baseLuck ??
    definition.luck;

  if (
    value ===
    undefined ||
    value ===
    null
  ) {
    throw new Error(
      `Pickaxe ${definition.id} ไม่มี Base Luck`,
    );
  }

  return new NexoNumber(
    value,
  );
}

function shopPrice(
  definition: any,
) {
  return definitionNetWorth(
    definition,
  ).mul(
    5,
  );
}

function rarityTier(
  definition: any,
) {
  const rarity =
    MINER_RARITY_MAP.get(
      definition.rarity,
    );

  if (!rarity) {
    throw new Error(
      `ไม่พบ Rarity ของ Pickaxe ${definition.id}`,
    );
  }

  return rarity.tier;
}

export const minerPickaxeShopService = {
  async getCatalog(
    discordId: string,
  ) {
    const profile =
      await MinerProfile.findOne({
        discordId,
      });

    if (!profile) {
      throw new Error(
        "ยังไม่มี Miner Profile",
      );
    }

    /*
     * ใช้ Power Level สูงสุดที่ผู้เล่นเคยอัปเกรด
     * เพื่อไม่ให้ Unlock Shop หายเมื่อเปลี่ยน Pickaxe
     */
    const owned =
      await MinerPickaxe.find({
        discordId,
      }).select({
        powerLevel: 1,
      });

    const highestPowerLevel =
      owned.reduce(
        (
          highest,
          pickaxe,
        ) =>
          Math.max(
            highest,
            pickaxe.powerLevel,
          ),
        0,
      );

    const rows =
      Array.from(
        PICKAXE_MAP.values(),
      )
        .map(
          (
            definition: any,
          ) => {
            const tier =
              rarityTier(
                definition,
              );

            const requiredPowerLevel =
              REQUIRED_POWER_LEVEL[
                tier
              ] ??
              Number.POSITIVE_INFINITY;

            return {
              definition,
              tier,

              price:
                shopPrice(
                  definition,
                ).toStorage(),

              requiredPowerLevel,

              unlocked:
                tier >= 1 &&
                tier <=
                  SHOP_MAX_RARITY_TIER &&
                highestPowerLevel >=
                  requiredPowerLevel,
            };
          },
        )
        .filter(
          (row) =>
            row.tier >= 1 &&
            row.tier <=
              SHOP_MAX_RARITY_TIER,
        )
        .sort(
          (a, b) =>
            a.tier -
            b.tier,
        );

    return {
      highestPowerLevel,
      rows,
    };
  },

  async buy(
    discordId: string,
    definitionId: string,
  ) {
    const session =
      await mongoose
        .startSession();

    try {


      const result =
        await session
        .withTransaction(
          async () => {
            const definition =
              PICKAXE_MAP.get(
                definitionId,
              ) as any;

            if (!definition) {
              throw new Error(
                "ไม่พบ Pickaxe นี้",
              );
            }

            const tier =
              rarityTier(
                definition,
              );

            if (
              tier < 1 ||
              tier >
                SHOP_MAX_RARITY_TIER
            ) {
              throw new Error(
                "Pickaxe ระดับนี้ไม่มีขายใน Shop",
              );
            }

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
                "ยังไม่มี Miner Profile",
              );
            }

            const owned =
              await MinerPickaxe
                .find({
                  discordId,
                })
                .session(
                  session,
                );

            const highestPowerLevel =
              owned.reduce(
                (
                  highest,
                  pickaxe,
                ) =>
                  Math.max(
                    highest,
                    pickaxe.powerLevel,
                  ),
                0,
              );

            const requiredPowerLevel =
              REQUIRED_POWER_LEVEL[
                tier
              ] ??
              Number.POSITIVE_INFINITY;

            if (
              highestPowerLevel <
              requiredPowerLevel
            ) {
              throw new Error(
                `ต้องมี Power Upgrade อย่างน้อย Lv.${requiredPowerLevel} เพื่อซื้อ Pickaxe นี้`,
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
                "ไม่พบ Economy",
              );
            }

            const balance =
              new NexoNumber(
                economy.balance,
              );

            const reserved =
              new NexoNumber(
                economy
                  .reservedBalance ??
                  "0",
              );

            const available =
              balance.sub(
                reserved,
              );

            const price =
              shopPrice(
                definition,
              );

            if (
              available.lt(
                price,
              )
            ) {
              throw new Error(
                "NEXO ที่ใช้งานได้ไม่เพียงพอสำหรับซื้อ Pickaxe",
              );
            }

            const balanceAfter =
              balance.sub(
                price,
              );

            economy.balance =
              balanceAfter
                .toStorage();

            economy.lifetimeSpent =
              new NexoNumber(
                economy
                  .lifetimeSpent ??
                  "0",
              )
                .add(
                  price,
                )
                .toStorage();

            await economy.save({
              session,
            });

            const pickaxeInstanceId =
              createInstanceId();

            await MinerPickaxe.create(
              [
                {
                  pickaxeInstanceId,

                  discordId,

                  definitionId:
                    definition.id,

                  rarity:
                    definition.rarity,

                  basePower:
                    definitionPower(
                      definition,
                    ).toStorage(),

                  baseLuck:
                    definitionLuck(
                      definition,
                    ).toStorage(),

                  baseNetWorth:
                    definitionNetWorth(
                      definition,
                    ).toStorage(),

                  powerLevel:
                    0,

                  luckLevel:
                    0,

                  equipped:
                    false,

                  tradeLocked:
                    false,

                  source:
                    "shop",
                },
              ],
              {
                session,
                ordered: true,
              },
            );

            await Transaction.create(
              [
                {
                  transactionId:
                    createTransactionId(),

                  discordId,

                  type:
                    "purchase",

                  amount:
                    price.toStorage(),

                  balanceBefore:
                    balance.toStorage(),

                  balanceAfter:
                    balanceAfter
                      .toStorage(),

                  description:
                    `Purchased Pickaxe: ${definition.name}`,

                  metadata: {
                    category:
                      "pickaxe_shop",

                    definitionId:
                      definition.id,

                    pickaxeInstanceId,

                    rarity:
                      definition.rarity,
                  },
                },
              ],
              {
                session,
                ordered: true,
              },
            );

            return {
              pickaxeInstanceId,
              definitionId:
                definition.id,
              price:
                price.toStorage(),
              balanceAfter:
                balanceAfter
                  .toStorage(),
            };
          },
        );

      if (!result) {
        throw new Error(
          "ซื้อ Pickaxe ไม่สำเร็จ",
        );
      }

      return result;
    } finally {
      await session.endSession();
    }
  },
};
