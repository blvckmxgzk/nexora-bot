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
  minerMathService,
  type MinerUpgrade,
} from "./minerMathService.js";

import {
  minerService,
} from "./minerService.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

export type MinerBulkUpgradeStat =
  MinerUpgrade;

function transactionId() {
  return (
    "NXUPG-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function getCurrentLevel(
  stat: MinerBulkUpgradeStat,
  profile: any,
  pickaxe: any,
) {
  switch (stat) {
    case "power":
      return pickaxe.powerLevel;

    case "luck":
      return pickaxe.luckLevel;

    case "maxweight":
      return profile.maxWeightLevel;

    case "sellmulti":
      return profile.sellMultiLevel;

    case "sizemulti":
      return profile.sizeMultiLevel;
  }
}

function calculateCost(
  stat: MinerBulkUpgradeStat,
  currentLevel: number,
  quantity: number,
) {
  if (
    quantity <= 0
  ) {
    return new NexoNumber(
      0,
    );
  }

  /*
   * Rebalance v2 price curve เปลี่ยน multiplier
   * ทุก milestone 50 levels
   *
   * รวมราคาเป็น geometric series ต่อ block
   * แทน loop ทีละ level
   */
  let total =
    new NexoNumber(
      0,
    );

  let level =
    currentLevel;

  let remaining =
    quantity;

  while (
    remaining > 0
  ) {
    const milestone =
      Math.floor(
        level / 50,
      );

    const blockEnd =
      (
        milestone + 1
      ) * 50;

    const count =
      Math.min(
        remaining,
        blockEnd -
          level,
      );

    const firstPrice =
      minerMathService
        .getUpgradePrice(
          stat,
          level,
        );

    if (
      count === 1
    ) {
      total =
        total.add(
          firstPrice,
        );
    } else {
      const secondPrice =
        minerMathService
          .getUpgradePrice(
            stat,
            level + 1,
          );

      const ratio =
        secondPrice.div(
          firstPrice,
        );

      const blockTotal =
        firstPrice
          .mul(
            ratio
              .pow(
                count,
              )
              .sub(
                1,
              ),
          )
          .div(
            ratio.sub(
              1,
            ),
          );

      total =
        total.add(
          blockTotal,
        );
    }

    level +=
      count;

    remaining -=
      count;
  }

  return total;
}

const MAX_UPGRADE_SEARCH =
  10_000_000;

function findMaxAffordableQuantity(
  stat: MinerBulkUpgradeStat,
  currentLevel: number,
  availableBalance: NexoNumber,
) {
  const firstPrice =
    minerMathService
      .getUpgradePrice(
        stat,
        currentLevel,
      );

  if (
    firstPrice.gt(
      availableBalance,
    )
  ) {
    return {
      quantity: 0,
      totalCost:
        new NexoNumber(
          0,
        ),
      capped: false,
    };
  }

  /*
   * หา upper bound แบบ exponential:
   * 1, 2, 4, 8, 16 ...
   *
   * จากนั้น binary search เฉพาะช่วงที่จำเป็น
   */
  let high =
    1;

  while (
    high <
      MAX_UPGRADE_SEARCH
  ) {
    const cost =
      calculateCost(
        stat,
        currentLevel,
        high,
      );

    if (
      cost.gt(
        availableBalance,
      )
    ) {
      break;
    }

    const next =
      Math.min(
        MAX_UPGRADE_SEARCH,
        high * 2,
      );

    if (
      next === high
    ) {
      break;
    }

    high =
      next;
  }

  const maxCost =
    calculateCost(
      stat,
      currentLevel,
      high,
    );

  if (
    high ===
      MAX_UPGRADE_SEARCH &&
    maxCost.lte(
      availableBalance,
    )
  ) {
    return {
      quantity:
        high,
      totalCost:
        maxCost,
      capped:
        true,
    };
  }

  const found =
    findAffordableQuantity(
      stat,
      currentLevel,
      high,
      availableBalance,
    );

  return {
    ...found,
    capped:
      false,
  };
}

function findAffordableQuantity(
  stat: MinerBulkUpgradeStat,
  currentLevel: number,
  requested: number,
  availableBalance: NexoNumber,
) {
  /*
   * Binary search:
   *
   * ไม่ต้องลอง MongoDB ทีละ level
   * คำนวณใน RAM อย่างเดียว
   */
  let low = 0;
  let high = requested;

  let affordable = 0;
  let affordableCost =
    new NexoNumber(0);

  while (
    low <= high
  ) {
    const mid =
      Math.floor(
        (low + high) /
          2,
      );

    const cost =
      calculateCost(
        stat,
        currentLevel,
        mid,
      );

    if (
      cost.lte(
        availableBalance,
      )
    ) {
      affordable =
        mid;

      affordableCost =
        cost;

      low =
        mid + 1;
    } else {
      high =
        mid - 1;
    }
  }

  return {
    quantity:
      affordable,

    totalCost:
      affordableCost,
  };
}

export const minerBulkUpgradeService = {
  async upgradeMany(
    discordId: string,
    stat: MinerBulkUpgradeStat,
    quantity: number | "max",
  ) {
    const isMax =
      quantity ===
      "max";

    const requested:
      number | "MAX" =
      isMax
        ? "MAX"
        : Math.max(
            1,
            Math.min(
              100,
              Math.trunc(
                quantity,
              ),
            ),
          );

    /*
     * Settlement ก่อนซื้อ
     *
     * ทำก่อน transaction เพื่อไม่ให้ Mining settlement
     * ไปปนกับ purchase transaction
     */
    await minerService.settle(
      discordId,
    );

    const session =
      await mongoose
        .startSession();

    try {


      const result =
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
                "ไม่พบ Miner Profile",
              );
            }

            const pickaxe =
              await MinerPickaxe
                .findOne({
                  discordId,

                  pickaxeInstanceId:
                    profile
                      .equippedPickaxeInstanceId,
                })
                .session(
                  session,
                );

            if (!pickaxe) {
              throw new Error(
                "ไม่พบ Pickaxe ที่กำลังใช้งาน",
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

            const currentLevel =
              getCurrentLevel(
                stat,
                profile,
                pickaxe,
              );

            const affordable =
              isMax
                ? findMaxAffordableQuantity(
                    stat,
                    currentLevel,
                    available,
                  )
                : findAffordableQuantity(
                    stat,
                    currentLevel,
                    requested as number,
                    available,
                  );

            const affordableQuantity =
              affordable.quantity;

            const totalCost =
              affordable.totalCost;

            const maxSearchCapped =
              "capped" in
                affordable &&
              affordable.capped;

            if (
              affordableQuantity <=
              0
            ) {
              throw new Error(
                "NEXO ที่ใช้งานได้ไม่เพียงพอสำหรับ Upgrade",
              );
            }

            const balanceAfter =
              balance.sub(
                totalCost,
              );

            /*
             * ============================
             * UPDATE LEVEL ONCE
             * ============================
             */

            switch (stat) {
              case "power":
                pickaxe.powerLevel +=
                  affordableQuantity;

                await pickaxe.save({
                  session,
                });

                break;

              case "luck":
                pickaxe.luckLevel +=
                  affordableQuantity;

                await pickaxe.save({
                  session,
                });

                break;

              case "maxweight":
                profile.maxWeightLevel +=
                  affordableQuantity;

                await profile.save({
                  session,
                });

                break;

              case "sellmulti":
                profile.sellMultiLevel +=
                  affordableQuantity;

                await profile.save({
                  session,
                });

                break;

              case "sizemulti":
                profile.sizeMultiLevel +=
                  affordableQuantity;

                await profile.save({
                  session,
                });

                break;
            }

            /*
             * ============================
             * DEDUCT NEXO ONCE
             * ============================
             */

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
                  totalCost,
                )
                .toStorage();

            await economy.save({
              session,
            });

            /*
             * Transaction log แค่ 1 record
             * สำหรับ Bulk ทั้งก้อน
             */
            await Transaction.create(
              [
                {
                  transactionId:
                    transactionId(),

                  discordId,

                  type:
                    "purchase",

                  amount:
                    totalCost
                      .toStorage(),

                  balanceBefore:
                    balance
                      .toStorage(),

                  balanceAfter:
                    balanceAfter
                      .toStorage(),

                  description:
                    `NEXO Miner bulk upgrade ${stat} ×${affordableQuantity}`,

                  metadata: {
                    upgrade:
                      stat,

                    quantity:
                      affordableQuantity,

                    requested,

                    fromLevel:
                      currentLevel,

                    toLevel:
                      currentLevel +
                      affordableQuantity,
                  },
                },
              ],
              {
                session,
                ordered:
                  true,
              },
            );

            return {
              requested,

              purchased:
                affordableQuantity,

              totalCost:
                totalCost
                  .toStorage(),

              lastLevel:
                currentLevel +
                affordableQuantity,

              stoppedReason:
                isMax
                  ? (
                      maxSearchCapped
                        ? `ถึง safety cap ${MAX_UPGRADE_SEARCH.toLocaleString()} เลเวลต่อครั้ง`
                        : null
                    )
                  : affordableQuantity <
                      (requested as number)
                    ? "NEXO ไม่เพียงพอสำหรับจำนวนที่ตั้งไว้ จึงซื้อได้เท่าที่เงินพอ"
                    : null,
            };
          },
        );

      if (!result) {
        throw new Error(
          "Bulk Upgrade ไม่สำเร็จ",
        );
      }

      return result;
    } finally {
      await session
        .endSession();
    }
  },
};
