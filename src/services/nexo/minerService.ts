import crypto from "node:crypto";

import mongoose, {
  type ClientSession,
} from "mongoose";

import {
  MinerProfile,
} from "../../models/MinerProfile.js";

import {
  MinerPickaxe,
} from "../../models/MinerPickaxe.js";

import {
  MinerOreStack,
} from "../../models/MinerOreStack.js";

import {
  Economy,
} from "../../models/Economy.js";

import {
  Transaction,
} from "../../models/Transaction.js";

import {
  PICKAXE_CATALOG,
} from "../../game/nexoMiner/pickaxeCatalog.js";

import {
  ORE_MAP,
} from "../../game/nexoMiner/oreCatalog.js";

import {
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

import {
  minerMathService,
  type MinerUpgrade,
} from "./minerMathService.js";

import {
  minerRngService,
  type MinerSizeClass,
} from "./minerRngService.js";


import {
  minerBoostService,
} from "./minerBoostService.js";

import {
  minerLootService,
} from "./minerLootService.js";

const MAX_SETTLEMENT_CYCLES =
  20_000;

const SETTLEMENT_LOCK_MS =
  30_000;

const STARTER_PICKAXE =
  PICKAXE_CATALOG[0];

const SIZE_RANK:
  Record<
    MinerSizeClass,
    number
  > = {
    normal: 0,
    large: 1,
    giant: 2,
    colossal: 3,
    titan: 4,
  };

interface StackDelta {
  definitionId:
    string;

  rarity:
    string;

  quantity:
    number;

  totalWeight:
    NexoNumber;

  totalNetWorth:
    NexoNumber;

  largestWeight:
    NexoNumber;

  largestSizeClass:
    MinerSizeClass;
}

function createId(
  prefix:
    string,
): string {
  return (
    `${prefix}-` +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

async function ensureEconomy(
  discordId:
    string,

  session:
    ClientSession,
) {
  return Economy.findOneAndUpdate(
    {
      discordId,
    },
    {
      $setOnInsert: {
        discordId,
        balance: "0",
        bank: "0",
        lifetimeEarned: "0",
        lifetimeSpent: "0",
        inventory: [],
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      session,
    },
  );
}

function hasInfiniteBag(
  profile:
    any,

  now =
    new Date(),
): boolean {
  if (
    profile.permanentInfiniteBag ===
    true
  ) {
    return true;
  }

  return Boolean(
    profile.infiniteBagUntil &&
      profile.infiniteBagUntil
        .getTime() >
        now.getTime(),
  );
}

async function releaseSettlementLock(
  discordId:
    string,

  token:
    string,
): Promise<void> {
  await MinerProfile.updateOne(
    {
      discordId,

      settleLockToken:
        token,
    },
    {
      $set: {
        settleLockToken:
          null,

        settleLockUntil:
          null,
      },
    },
  );
}

export const minerService = {
  async createProfile(
    discordId:
      string,
  ) {
    const session =
      await mongoose.startSession();

    let result:
      any =
        null;

    try {
      await session.withTransaction(
        async () => {
          const existing =
            await MinerProfile
              .findOne({
                discordId,
              })
              .session(
                session,
              );

          if (existing) {
            throw new Error(
              "คุณมี NEXO Miner Profile อยู่แล้ว",
            );
          }

          const pickaxeInstanceId =
            createId(
              "PICK",
            );

          await MinerPickaxe.create(
            [
              {
                pickaxeInstanceId,

                discordId,

                definitionId:
                  STARTER_PICKAXE.id,

                rarity:
                  STARTER_PICKAXE
                    .rarity,

                basePower:
                  STARTER_PICKAXE
                    .basePower,

                baseLuck:
                  STARTER_PICKAXE
                    .baseLuck,

                baseNetWorth:
                  STARTER_PICKAXE
                    .netWorth,

                powerLevel:
                  0,

                luckLevel:
                  0,

                equipped:
                  true,

                /*
                 * Starter Pickaxe ห้ามโยกให้ alt
                 */
                tradeLocked:
                  true,

                source:
                  "starter",
              },
            ],
            {
              session,
            },
          );

          const [
            profile,
          ] =
            await MinerProfile.create(
              [
                {
                  discordId,

                  equippedPickaxeInstanceId:
                    pickaxeInstanceId,

                  miningActive:
                    true,

                  pausedReason:
                    null,

                  lastSettledAt:
                    new Date(),

                  bagWeight:
                    "0",

                  maxWeightLevel:
                    0,

                  sellMultiLevel:
                    0,

                  sizeMultiLevel:
                    0,

                  chestSlots:
                    20,

                  permanentInfiniteBag:
                    false,

                  infiniteBagUntil:
                    null,

                  allTimeMinedNetworth:
                    "0",

                  totalOresMined:
                    "0",
                },
              ],
              {
                session,
              },
            );

          await ensureEconomy(
            discordId,
            session,
          );

          result =
            profile;
        },
      );
    } finally {
      await session.endSession();
    }

    return result;
  },

  async settle(
    discordId:
      string,

    options: {
      now?:
        Date;

      rng?:
        () =>
          number;

      maxCycles?:
        number;
    } = {},
  ) {
    const now =
      options.now ??
      new Date();

    const rng =
      options.rng ??
      Math.random;

    const lockToken =
      createId(
        "SETTLE",
      );

    const profile =
      await MinerProfile
        .findOneAndUpdate(
          {
            discordId,

            $or: [
              {
                settleLockUntil:
                  null,
              },
              {
                settleLockUntil: {
                  $exists:
                    false,
                },
              },
              {
                settleLockUntil: {
                  $lte:
                    now,
                },
              },
            ],
          },
          {
            $set: {
              settleLockToken:
                lockToken,

              settleLockUntil:
                new Date(
                  now.getTime() +
                    SETTLEMENT_LOCK_MS,
                ),
            },
          },
          {
            new:
              true,
          },
        );

    if (!profile) {
      const exists =
        await MinerProfile.exists({
          discordId,
        });

      return {
        exists:
          Boolean(
            exists,
          ),

        busy:
          Boolean(
            exists,
          ),

        processed:
          0,

        mined:
          0,

        bagFull:
          false,

        minedNetWorth:
          "0",
      };
    }

    try {
      if (
        profile.pausedReason ===
        "bag_full"
      ) {
        /*
         * ตอนกระเป๋าเต็มจะไม่สะสมเวลา
         * ไว้ปั๊มย้อนหลังหลังขาย
         */
        await MinerProfile.updateOne(
          {
            discordId,

            settleLockToken:
              lockToken,
          },
          {
            $set: {
              lastSettledAt:
                now,

              settleLockToken:
                null,

              settleLockUntil:
                null,
            },
          },
        );

        return {
          exists: true,
          busy: false,
          processed: 0,
          mined: 0,
          bagFull: true,
          minedNetWorth: "0",
        };
      }

      const pickaxe =
        await MinerPickaxe.findOne({
          discordId,

          pickaxeInstanceId:
            profile
              .equippedPickaxeInstanceId,
        });

      if (!pickaxe) {
        throw new Error(
          "ไม่พบ Equipped Pickaxe",
        );
      }

      const baseStats =
        minerMathService.getStats(
          profile,
          pickaxe,
        );

      const boostMultipliers =
        await minerBoostService
          .getMultipliers(
            discordId,
            now,
          );

      const stats = {
        ...baseStats,

        power:
          baseStats.power.mul(
            boostMultipliers.power,
          ),

        luck:
          baseStats.luck.mul(
            boostMultipliers.luck,
          ),

        sizeMulti:
          baseStats.sizeMulti.mul(
            boostMultipliers.size,
          ),

        sellMulti:
          baseStats.sellMulti.mul(
            boostMultipliers.sell,
          ),
      };

      const cycleMs =
        minerMathService
          .getMiningCycleMs(
            stats.power,
          );

      const lastSettledMs =
        profile
          .lastSettledAt
          .getTime();

      const elapsedMs =
        Math.max(
          0,
          now.getTime() -
            lastSettledMs,
        );

      const availableCycles =
        Math.floor(
          elapsedMs /
            cycleMs,
        );

      if (
        availableCycles <=
        0
      ) {
        await releaseSettlementLock(
          discordId,
          lockToken,
        );

        return {
          exists: true,
          busy: false,
          processed: 0,
          mined: 0,
          bagFull: false,
          minedNetWorth: "0",
        };
      }

      const cycles =
        Math.min(
          availableCycles,

          Math.max(
            1,

            options.maxCycles ??
              MAX_SETTLEMENT_CYCLES,
          ),
        );

      const infiniteBag =
        hasInfiniteBag(
          profile,
          now,
        );

      let bagWeight =
        new NexoNumber(
          profile.bagWeight,
        );

      let minedNetWorth =
        NexoNumber.zero();

      let mined =
        0;

      let processed =
        0;

      let bagFull =
        false;

      const deltas =
        new Map<
          string,
          StackDelta
        >();

      for (
        let i =
          0;
        i <
          cycles;
        i++
      ) {
        if (
          !infiniteBag &&
          bagWeight.gte(
            stats.maxWeight,
          )
        ) {
          bagFull =
            true;

          break;
        }

        const roll =
          minerRngService.rollOre(
            stats.power,
            stats.luck,
            stats.sizeMulti,
            rng,
          );

        processed++;
        mined++;

        /*
         * Oversize protection:
         *
         * ถ้าก้อนนี้ทำให้เกิน capacity
         * ยังเก็บก้อนนี้ให้ผู้เล่นก่อน
         * แล้วค่อย pause
         */
        bagWeight =
          bagWeight.add(
            roll.weight,
          );

        minedNetWorth =
          minedNetWorth.add(
            roll.netWorth,
          );

        const current =
          deltas.get(
            roll.ore.id,
          );

        if (current) {
          current.quantity++;

          current.totalWeight =
            current
              .totalWeight
              .add(
                roll.weight,
              );

          current.totalNetWorth =
            current
              .totalNetWorth
              .add(
                roll.netWorth,
              );

          if (
            roll.weight.gt(
              current
                .largestWeight,
            )
          ) {
            current.largestWeight =
              roll.weight;
          }

          if (
            SIZE_RANK[
              roll.sizeClass
            ] >
            SIZE_RANK[
              current
                .largestSizeClass
            ]
          ) {
            current.largestSizeClass =
              roll.sizeClass;
          }
        } else {
          deltas.set(
            roll.ore.id,
            {
              definitionId:
                roll.ore.id,

              rarity:
                roll.ore
                  .rarity,

              quantity:
                1,

              totalWeight:
                roll.weight,

              totalNetWorth:
                roll.netWorth,

              largestWeight:
                roll.weight,

              largestSizeClass:
                roll.sizeClass,
            },
          );
        }

        if (
          !infiniteBag &&
          bagWeight.gt(
            stats.maxWeight,
          )
        ) {
          bagFull =
            true;

          break;
        }
      }

      const session =
        await mongoose.startSession();

      try {
        await session.withTransaction(
          async () => {
            const currentProfile =
              await MinerProfile
                .findOne({
                  discordId,

                  settleLockToken:
                    lockToken,
                })
                .session(
                  session,
                );

            if (!currentProfile) {
              throw new Error(
                "Miner Settlement lock สูญหาย",
              );
            }

            for (
              const delta
              of deltas.values()
            ) {
              const stack =
                await MinerOreStack
                  .findOne({
                    discordId,

                    definitionId:
                      delta
                        .definitionId,

                    location:
                      "bag",
                  })
                  .session(
                    session,
                  );

              if (!stack) {
                await MinerOreStack.create(
                  [
                    {
                      discordId,

                      definitionId:
                        delta
                          .definitionId,

                      rarity:
                        delta.rarity,

                      location:
                        "bag",

                      quantity:
                        delta.quantity,

                      totalWeight:
                        delta
                          .totalWeight
                          .toStorage(),

                      totalNetWorth:
                        delta
                          .totalNetWorth
                          .toStorage(),

                      largestWeight:
                        delta
                          .largestWeight
                          .toStorage(),

                      largestSizeClass:
                        delta
                          .largestSizeClass,
                    },
                  ],
                  {
                    session,
                  },
                );

                continue;
              }

              stack.quantity +=
                delta.quantity;

              stack.totalWeight =
                new NexoNumber(
                  stack.totalWeight,
                )
                  .add(
                    delta
                      .totalWeight,
                  )
                  .toStorage();

              stack.totalNetWorth =
                new NexoNumber(
                  stack
                    .totalNetWorth,
                )
                  .add(
                    delta
                      .totalNetWorth,
                  )
                  .toStorage();

              if (
                delta
                  .largestWeight
                  .gt(
                    stack
                      .largestWeight,
                  )
              ) {
                stack.largestWeight =
                  delta
                    .largestWeight
                    .toStorage();
              }

              const oldSize =
                stack
                  .largestSizeClass as
                  MinerSizeClass;

              if (
                SIZE_RANK[
                  delta
                    .largestSizeClass
                ] >
                SIZE_RANK[
                  oldSize
                ]
              ) {
                stack.largestSizeClass =
                  delta
                    .largestSizeClass;
              }

              await stack.save({
                session,
              });
            }

            currentProfile.bagWeight =
              bagWeight
                .toStorage();

            currentProfile
              .allTimeMinedNetworth =
              new NexoNumber(
                currentProfile
                  .allTimeMinedNetworth,
              )
                .add(
                  minedNetWorth,
                )
                .toStorage();

            currentProfile.pendingLootRolls +=
              mined;

            currentProfile
              .totalOresMined =
              new NexoNumber(
                currentProfile
                  .totalOresMined,
              )
                .add(
                  String(
                    mined,
                  ),
                )
                .toStorage();

            if (bagFull) {
              currentProfile
                .pausedReason =
                "bag_full";

              currentProfile
                .lastSettledAt =
                now;
            } else {
              currentProfile
                .pausedReason =
                null;

              currentProfile
                .lastSettledAt =
                new Date(
                  lastSettledMs +
                    processed *
                      cycleMs,
                );
            }

            currentProfile
              .miningActive =
                true;

            currentProfile
              .settleLockToken =
                null;

            currentProfile
              .settleLockUntil =
                null;

            await currentProfile.save({
              session,
            });
          },
        );
      } finally {
        await session.endSession();
      }

      try {
        await minerLootService
          .processPendingLoot(
            discordId,
            {
              luck:
                stats.luck,

              rng,
            },
          );
      } catch (lootError) {
        /*
         * Ore settlement สำเร็จแล้ว
         * ห้าม rollback เพราะ Loot worker
         * สามารถมาทำ pending debt ต่อได้
         */
        console.error(
          `⚠️ Pending Miner loot delayed for ${discordId}:`,
          lootError,
        );
      }

      return {
        exists: true,
        busy: false,
        processed,
        mined,
        bagFull,

        minedNetWorth:
          minedNetWorth
            .toStorage(),
      };
    } catch (error) {
      await releaseSettlementLock(
        discordId,
        lockToken,
      ).catch(
        () =>
          undefined,
      );

      throw error;
    }
  },

  async getSummary(
    discordId:
      string,
  ) {
    await this.settle(
      discordId,
    );

    const profile =
      await MinerProfile.findOne({
        discordId,
      });

    if (!profile) {
      return null;
    }

    const pickaxe =
      await MinerPickaxe.findOne({
        discordId,

        pickaxeInstanceId:
          profile
            .equippedPickaxeInstanceId,
      });

    if (!pickaxe) {
      throw new Error(
        "ไม่พบ Equipped Pickaxe",
      );
    }

    const baseStats =
      minerMathService.getStats(
        profile,
        pickaxe,
      );

    const boosts =
      await minerBoostService
        .getMultipliers(
          discordId,
        );

    return {
      profile,
      pickaxe,
      boosts,

      stats: {
        ...baseStats,

        power:
          baseStats.power.mul(
            boosts.power,
          ),

        luck:
          baseStats.luck.mul(
            boosts.luck,
          ),

        sizeMulti:
          baseStats.sizeMulti.mul(
            boosts.size,
          ),

        sellMulti:
          baseStats.sellMulti.mul(
            boosts.sell,
          ),
      },
    };
  },

  async getInventory(
    discordId:
      string,
  ) {
    await this.settle(
      discordId,
    );

    return MinerOreStack.find({
      discordId,
      location: "bag",
    });
  },

  async getChest(
    discordId:
      string,
  ) {
    return MinerOreStack.find({
      discordId,
      location: "chest",
    });
  },

  async sellAll(
    discordId:
      string,
  ) {
    await this.settle(
      discordId,
    );

    const session =
      await mongoose.startSession();

    let result:
      any =
        null;

    try {
      await session.withTransaction(
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
              "ยังไม่มี NEXO Miner Profile",
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
              "ไม่พบ Pickaxe",
            );
          }

          const stacks =
            await MinerOreStack
              .find({
                discordId,
                location: "bag",
              })
              .session(
                session,
              );

          if (
            stacks.length ===
            0
          ) {
            throw new Error(
              "ไม่มีแร่ในกระเป๋า",
            );
          }

          let intrinsicNetWorth =
            NexoNumber.zero();

          for (
            const stack
            of stacks
          ) {
            intrinsicNetWorth =
              intrinsicNetWorth.add(
                stack
                  .totalNetWorth,
              );
          }

          const baseStats =
            minerMathService.getStats(
              profile,
              pickaxe,
            );

          const boosts =
            await minerBoostService
              .getMultipliers(
                discordId,
              );

          const stats = {
            ...baseStats,

            sellMulti:
              baseStats.sellMulti.mul(
                boosts.sell,
              ),
          };

          const payout =
            intrinsicNetWorth.mul(
              stats.sellMulti,
            );

          const economy =
            await ensureEconomy(
              discordId,
              session,
            );

          const before =
            new NexoNumber(
              economy.balance,
            );

          const after =
            before.add(
              payout,
            );

          economy.balance =
            after.toStorage();

          economy.lifetimeEarned =
            new NexoNumber(
              economy
                .lifetimeEarned,
            )
              .add(
                payout,
              )
              .toStorage();

          await economy.save({
            session,
          });

          await Transaction.create(
            [
              {
                transactionId:
                  createId(
                    "NXSELL",
                  ),

                discordId,

                type:
                  "miner_sell",

                amount:
                  payout
                    .toStorage(),

                balanceBefore:
                  before
                    .toStorage(),

                balanceAfter:
                  after
                    .toStorage(),

                description:
                  "Sold Miner bag",

                metadata: {
                  intrinsicNetWorth:
                    intrinsicNetWorth
                      .toStorage(),

                  sellMulti:
                    stats
                      .sellMulti
                      .toStorage(),
                },
              },
            ],
            {
              session,
            },
          );

          await MinerOreStack.deleteMany(
            {
              discordId,
              location: "bag",
            },
            {
              session,
            },
          );

          profile.bagWeight =
            "0";

          profile.pausedReason =
            null;

          profile.miningActive =
            true;

          profile.lastSettledAt =
            new Date();

          await profile.save({
            session,
          });

          result = {
            intrinsic:
              intrinsicNetWorth
                .toStorage(),

            sellMulti:
              stats
                .sellMulti
                .toStorage(),

            payout:
              payout
                .toStorage(),

            balance:
              after
                .toStorage(),
          };
        },
      );
    } finally {
      await session.endSession();
    }

    return result;
  },

  async upgrade(
    discordId:
      string,

    type:
      MinerUpgrade,
  ) {
    await this.settle(
      discordId,
    );

    const session =
      await mongoose.startSession();

    let result:
      any =
        null;

    try {
      await session.withTransaction(
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
              "ยังไม่มี Miner Profile",
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
              "ไม่พบ Pickaxe",
            );
          }

          let currentLevel =
            0;

          if (
            type ===
            "power"
          ) {
            currentLevel =
              pickaxe
                .powerLevel;
          } else if (
            type ===
            "luck"
          ) {
            currentLevel =
              pickaxe
                .luckLevel;
          } else if (
            type ===
            "maxweight"
          ) {
            currentLevel =
              profile
                .maxWeightLevel;
          } else if (
            type ===
            "sellmulti"
          ) {
            currentLevel =
              profile
                .sellMultiLevel;
          } else {
            currentLevel =
              profile
                .sizeMultiLevel;
          }

          const price =
            minerMathService
              .getUpgradePrice(
                type,
                currentLevel,
              );

          const economy =
            await ensureEconomy(
              discordId,
              session,
            );

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
              price,
            )
          ) {
            throw new Error(
              "NEXO ที่ใช้งานได้ไม่เพียงพอสำหรับ Upgrade",
            );
          }

          const after =
            before.sub(
              price,
            );

          economy.balance =
            after.toStorage();

          economy.lifetimeSpent =
            new NexoNumber(
              economy
                .lifetimeSpent,
            )
              .add(
                price,
              )
              .toStorage();

          if (
            type ===
            "power"
          ) {
            pickaxe.powerLevel++;
          } else if (
            type ===
            "luck"
          ) {
            pickaxe.luckLevel++;
          } else if (
            type ===
            "maxweight"
          ) {
            profile.maxWeightLevel++;
          } else if (
            type ===
            "sellmulti"
          ) {
            profile.sellMultiLevel++;
          } else {
            profile.sizeMultiLevel++;
          }

          /*
           * Upgrade ไม่ควรเอา Power ใหม่
           * ไปคำนวณย้อนหลังกับเวลาที่ผ่านมา
           */
          profile.lastSettledAt =
            new Date();

          await economy.save({
            session,
          });

          await pickaxe.save({
            session,
          });

          await profile.save({
            session,
          });

          await Transaction.create(
            [
              {
                transactionId:
                  createId(
                    "NXUP",
                  ),

                discordId,

                type:
                  "miner_upgrade",

                amount:
                  price
                    .toStorage(),

                balanceBefore:
                  before
                    .toStorage(),

                balanceAfter:
                  after
                    .toStorage(),

                description:
                  `Miner upgrade: ${type}`,

                metadata: {
                  upgrade:
                    type,

                  previousLevel:
                    currentLevel,

                  newLevel:
                    currentLevel +
                    1,
                },
              },
            ],
            {
              session,
            },
          );

          result = {
            type,

            level:
              currentLevel +
              1,

            price:
              price
                .toStorage(),

            balance:
              after
                .toStorage(),
          };
        },
      );
    } finally {
      await session.endSession();
    }

    return result;
  },

  async storeOre(
    discordId:
      string,

    definitionId:
      string,
  ) {
    await this.settle(
      discordId,
    );

    const session =
      await mongoose.startSession();

    try {
      await session.withTransaction(
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
              "ยังไม่มี Miner Profile",
            );
          }

          const source =
            await MinerOreStack
              .findOne({
                discordId,

                definitionId,

                location:
                  "bag",
              })
              .session(
                session,
              );

          if (!source) {
            throw new Error(
              "ไม่พบแร่นี้ในกระเป๋า",
            );
          }

          const rarity =
            MINER_RARITY_MAP.get(
              source.rarity as
                any,
            );

          if (
            !rarity ||
            rarity.tier <
              6
          ) {
            throw new Error(
              "Rare Chest รับเฉพาะ Legendary ขึ้นไป",
            );
          }

          const destination =
            await MinerOreStack
              .findOne({
                discordId,

                definitionId,

                location:
                  "chest",
              })
              .session(
                session,
              );

          if (!destination) {
            const usedSlots =
              await MinerOreStack
                .countDocuments({
                  discordId,

                  location:
                    "chest",
                })
                .session(
                  session,
                );

            if (
              usedSlots >=
              profile.chestSlots
            ) {
              throw new Error(
                "Rare Chest เต็มแล้ว",
              );
            }

            source.location =
              "chest";

            await source.save({
              session,
            });
          } else {
            destination.quantity +=
              source.quantity;

            destination.totalWeight =
              new NexoNumber(
                destination
                  .totalWeight,
              )
                .add(
                  source
                    .totalWeight,
                )
                .toStorage();

            destination.totalNetWorth =
              new NexoNumber(
                destination
                  .totalNetWorth,
              )
                .add(
                  source
                    .totalNetWorth,
                )
                .toStorage();

            if (
              new NexoNumber(
                source
                  .largestWeight,
              ).gt(
                destination
                  .largestWeight,
              )
            ) {
              destination.largestWeight =
                source
                  .largestWeight;
            }

            await destination.save({
              session,
            });

            await source.deleteOne({
              session,
            });
          }

          const nextWeight =
            new NexoNumber(
              profile
                .bagWeight,
            ).sub(
              source.totalWeight,
            );

          profile.bagWeight =
            nextWeight.gte(0)
              ? nextWeight
                  .toStorage()
              : "0";

          profile.pausedReason =
            null;

          profile.miningActive =
            true;

          profile.lastSettledAt =
            new Date();

          await profile.save({
            session,
          });
        },
      );
    } finally {
      await session.endSession();
    }
  },

  async takeOre(
    discordId:
      string,

    definitionId:
      string,
  ) {
    const session =
      await mongoose.startSession();

    try {
      await session.withTransaction(
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
              "ยังไม่มี Miner Profile",
            );
          }

          const source =
            await MinerOreStack
              .findOne({
                discordId,

                definitionId,

                location:
                  "chest",
              })
              .session(
                session,
              );

          if (!source) {
            throw new Error(
              "ไม่พบแร่นี้ใน Rare Chest",
            );
          }

          const destination =
            await MinerOreStack
              .findOne({
                discordId,

                definitionId,

                location:
                  "bag",
              })
              .session(
                session,
              );

          if (!destination) {
            source.location =
              "bag";

            await source.save({
              session,
            });
          } else {
            destination.quantity +=
              source.quantity;

            destination.totalWeight =
              new NexoNumber(
                destination
                  .totalWeight,
              )
                .add(
                  source
                    .totalWeight,
                )
                .toStorage();

            destination.totalNetWorth =
              new NexoNumber(
                destination
                  .totalNetWorth,
              )
                .add(
                  source
                    .totalNetWorth,
                )
                .toStorage();

            if (
              new NexoNumber(
                source
                  .largestWeight,
              ).gt(
                destination
                  .largestWeight,
              )
            ) {
              destination.largestWeight =
                source
                  .largestWeight;
            }

            await destination.save({
              session,
            });

            await source.deleteOne({
              session,
            });
          }

          profile.bagWeight =
            new NexoNumber(
              profile
                .bagWeight,
            )
              .add(
                source
                  .totalWeight,
              )
              .toStorage();

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
              "ไม่พบ Pickaxe",
            );
          }

          const stats =
            minerMathService
              .getStats(
                profile,
                pickaxe,
              );

          if (
            !hasInfiniteBag(
              profile,
            ) &&
            new NexoNumber(
              profile
                .bagWeight,
            ).gt(
              stats.maxWeight,
            )
          ) {
            profile.pausedReason =
              "bag_full";
          }

          profile.lastSettledAt =
            new Date();

          await profile.save({
            session,
          });
        },
      );
    } finally {
      await session.endSession();
    }
  },

  async leaderboard(
    limit =
      10,
  ) {
    const profiles =
      await MinerProfile.find({})
        .select({
          discordId: 1,

          allTimeMinedNetworth:
            1,

          totalOresMined:
            1,
        });

    profiles.sort(
      (
        a,
        b,
      ) =>
        new NexoNumber(
          b
            .allTimeMinedNetworth,
        ).cmp(
          a
            .allTimeMinedNetworth,
        ),
    );

    return profiles.slice(
      0,
      limit,
    );
  },

  async settleDueProfiles(
    limit =
      100,
  ) {
    const profiles =
      await MinerProfile.find({
        miningActive: true,
        pausedReason: null,
      })
        .sort({
          lastSettledAt: 1,
        })
        .limit(
          limit,
        )
        .select({
          discordId: 1,
        });

    let processed =
      0;

    let failed =
      0;

    for (
      const profile
      of profiles
    ) {
      try {
        await this.settle(
          profile.discordId,
        );

        processed++;
      } catch (error) {
        failed++;

        console.error(
          `❌ Miner settlement failed for ${profile.discordId}:`,
          error,
        );
      }
    }

    return {
      checked:
        profiles.length,

      processed,

      failed,
    };
  },

  getOreDefinition(
    definitionId:
      string,
  ) {
    return ORE_MAP.get(
      definitionId,
    );
  },
};
