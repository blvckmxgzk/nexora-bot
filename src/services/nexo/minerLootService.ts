import crypto from "node:crypto";

import mongoose from "mongoose";

import {
  MinerProfile,
} from "../../models/MinerProfile.js";

import {
  MinerPickaxe,
} from "../../models/MinerPickaxe.js";

import {
  MinerInventoryItem,
} from "../../models/MinerInventoryItem.js";

import {
  MinerRareDropEvent,
} from "../../models/MinerRareDropEvent.js";

import {
  MINER_ITEM_CATALOG,
} from "../../game/nexoMiner/itemCatalog.js";

import {
  PICKAXE_CATALOG,
} from "../../game/nexoMiner/pickaxeCatalog.js";

import {
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

import {
  minerMathService,
} from "./minerMathService.js";

import {
  minerBoostService,
} from "./minerBoostService.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

const MAX_LOOT_ROLLS =
  20_000;

const ITEM_DROP_CAP =
  0.005;

const PICKAXE_DROP_CAP =
  0.0005;

const LOOT_LOCK_MS =
  30_000;

function id(
  prefix:
    string,
) {
  return (
    `${prefix}-` +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function luckMultiplier(
  luck:
    NexoNumber,
) {
  const raw =
    luck.value
      .add(
        1,
      )
      .log10()
      .toNumber();

  const score =
    Number.isFinite(
      raw,
    )
      ? Math.max(
          0,
          Math.min(
            36,
            raw,
          ),
        )
      : 36;

  /*
   * สูงสุดประมาณ ×10
   * ต่อให้ Luck หลุดโลก
   */
  return Math.min(
    10,
    1 +
      score *
        0.25,
  );
}

function weightedRoll<
  T extends {
    miningDropDenominator:
      number |
      null;
  },
>(
  candidates:
    T[],

  luck:
    NexoNumber,

  cap:
    number,

  rng:
    () =>
      number,
):
  T |
  null {
  const weighted =
    candidates
      .filter(
        (
          candidate,
        ) =>
          candidate
            .miningDropDenominator !==
          null,
      )
      .map(
        (
          candidate,
        ) => ({
          candidate,

          weight:
            1 /
            candidate
              .miningDropDenominator!,
        }),
      );

  const baseChance =
    weighted.reduce(
      (
        sum,
        entry,
      ) =>
        sum +
        entry.weight,
      0,
    );

  const chance =
    Math.min(
      cap,

      baseChance *
      luckMultiplier(
        luck,
      ),
    );

  if (
    rng() >=
    chance
  ) {
    return null;
  }

  const total =
    weighted.reduce(
      (
        sum,
        entry,
      ) =>
        sum +
        entry.weight,
      0,
    );

  let roll =
    rng() *
    total;

  for (
    const entry
    of weighted
  ) {
    roll -=
      entry.weight;

    if (
      roll <=
      0
    ) {
      return entry
        .candidate;
    }
  }

  return (
    weighted.at(
      -1,
    )?.candidate ??
    null
  );
}

export const minerLootService = {
  async processPendingLoot(
    discordId:
      string,

    options: {
      luck?:
        NexoNumber;

      rng?:
        () =>
          number;
    } = {},
  ) {
    const now =
      new Date();

    const token =
      id(
        "LOOT",
      );

    const claimed =
      await MinerProfile
        .findOneAndUpdate(
          {
            discordId,

            pendingLootRolls: {
              $gt:
                0,
            },

            $or: [
              {
                lootLockUntil:
                  null,
              },
              {
                lootLockUntil: {
                  $exists:
                    false,
                },
              },
              {
                lootLockUntil: {
                  $lte:
                    now,
                },
              },
            ],
          },
          {
            $set: {
              lootLockToken:
                token,

              lootLockUntil:
                new Date(
                  now.getTime() +
                    LOOT_LOCK_MS,
                ),
            },
          },
          {
            new:
              true,
          },
        );

    if (!claimed) {
      return {
        rolls:
          0,

        items:
          0,

        pickaxes:
          0,
      };
    }

    try {
      const pickaxe =
        await MinerPickaxe
          .findOne({
            discordId,

            pickaxeInstanceId:
              claimed
                .equippedPickaxeInstanceId,
          });

      if (!pickaxe) {
        throw new Error(
          "ไม่พบ Equipped Pickaxe",
        );
      }

      let effectiveLuck =
        options.luck;

      if (!effectiveLuck) {
        const base =
          minerMathService
            .getStats(
              claimed,
              pickaxe,
            );

        const boosts =
          await minerBoostService
            .getMultipliers(
              discordId,
              now,
            );

        effectiveLuck =
          base.luck.mul(
            boosts.luck,
          );
      }

      const rng =
        options.rng ??
        Math.random;

      const rolls =
        Math.min(
          claimed
            .pendingLootRolls,

          MAX_LOOT_ROLLS,
        );

      const itemDrops =
        new Map<
          string,
          number
        >();

      const pickaxeDrops:
        Array<
          typeof PICKAXE_CATALOG[number]
        > = [];

      const rareEvents:
        Array<any> = [];

      const currentRarity =
        MINER_RARITY_MAP.get(
          pickaxe.rarity as
            any,
        );

      const maxPickaxeTier =
        Math.min(
          23,

          (
            currentRarity
              ?.tier ??
            0
          ) +
          2,
        );

      const eligiblePickaxes =
        PICKAXE_CATALOG.filter(
          (
            candidate,
          ) => {
            const rarity =
              MINER_RARITY_MAP
                .get(
                  candidate
                    .rarity,
                );

            return (
              candidate.tradeable &&
              candidate
                .miningDropDenominator !==
                null &&
              (
                rarity
                  ?.tier ??
                999
              ) <=
                maxPickaxeTier
            );
          },
        );

      for (
        let i =
          0;
        i <
          rolls;
        i++
      ) {
        const item =
          weightedRoll(
            MINER_ITEM_CATALOG,
            effectiveLuck,
            ITEM_DROP_CAP,
            rng,
          );

        if (item) {
          itemDrops.set(
            item.id,

            (
              itemDrops.get(
                item.id,
              ) ??
              0
            ) +
            1,
          );

          const rarity =
            MINER_RARITY_MAP.get(
              item.rarity,
            );

          if (
            (
              rarity?.tier ??
              0
            ) >=
            6
          ) {
            rareEvents.push({
              eventId:
                id(
                  "DROP",
                ),

              discordId,

              dropType:
                "item",

              definitionId:
                item.id,

              rarity:
                item.rarity,

              netWorth:
                item.netWorth,
            });
          }
        }

        const droppedPickaxe =
          weightedRoll(
            eligiblePickaxes,
            effectiveLuck,
            PICKAXE_DROP_CAP,
            rng,
          );

        if (
          droppedPickaxe
        ) {
          pickaxeDrops.push(
            droppedPickaxe,
          );

          const rarity =
            MINER_RARITY_MAP.get(
              droppedPickaxe
                .rarity,
            );

          if (
            (
              rarity?.tier ??
              0
            ) >=
            6
          ) {
            rareEvents.push({
              eventId:
                id(
                  "DROP",
                ),

              discordId,

              dropType:
                "pickaxe",

              definitionId:
                droppedPickaxe
                  .id,

              rarity:
                droppedPickaxe
                  .rarity,

              netWorth:
                droppedPickaxe
                  .netWorth,
            });
          }
        }
      }

      const session =
        await mongoose
          .startSession();

      try {
        await session
          .withTransaction(
            async () => {
              const profile =
                await MinerProfile
                  .findOne({
                    discordId,

                    lootLockToken:
                      token,

                    pendingLootRolls: {
                      $gte:
                        rolls,
                    },
                  })
                  .session(
                    session,
                  );

              if (!profile) {
                throw new Error(
                  "Loot lock สูญหาย",
                );
              }

              for (
                const [
                  itemId,
                  quantity,
                ]
                of itemDrops
              ) {
                await MinerInventoryItem
                  .findOneAndUpdate(
                    {
                      discordId,
                      itemId,
                    },
                    {
                      $inc: {
                        quantity,
                      },

                      $set: {
                        lastSource:
                          "mining",
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
              }

              for (
                const definition
                of pickaxeDrops
              ) {
                await MinerPickaxe
                  .create(
                    [
                      {
                        pickaxeInstanceId:
                          id(
                            "PICK",
                          ),

                        discordId,

                        definitionId:
                          definition
                            .id,

                        rarity:
                          definition
                            .rarity,

                        basePower:
                          definition
                            .basePower,

                        baseLuck:
                          definition
                            .baseLuck,

                        baseNetWorth:
                          definition
                            .netWorth,

                        powerLevel:
                          0,

                        luckLevel:
                          0,

                        equipped:
                          false,

                        tradeLocked:
                          false,

                        source:
                          "mining",
                      },
                    ],
                    {
                      session,
                    },
                  );
              }

              if (
                rareEvents.length >
                0
              ) {
                await MinerRareDropEvent
                  .insertMany(
                    rareEvents,
                    {
                      session,
                    },
                  );
              }

              profile.pendingLootRolls -=
                rolls;

              profile.lootLockToken =
                null;

              profile.lootLockUntil =
                null;

              await profile.save({
                session,
              });
            },
          );
      } finally {
        await session
          .endSession();
      }

      return {
        rolls,

        items:
          [...itemDrops.values()]
            .reduce(
              (
                total,
                quantity,
              ) =>
                total +
                quantity,
              0,
            ),

        pickaxes:
          pickaxeDrops
            .length,

        rare:
          rareEvents
            .length,
      };
    } catch (error) {
      await MinerProfile
        .updateOne(
          {
            discordId,

            lootLockToken:
              token,
          },
          {
            $set: {
              lootLockToken:
                null,

              lootLockUntil:
                null,
            },
          },
        )
        .catch(
          () =>
            undefined,
        );

      throw error;
    }
  },

  async processPendingProfiles(
    limit =
      100,
  ) {
    const profiles =
      await MinerProfile
        .find({
          pendingLootRolls: {
            $gt:
              0,
          },
        })
        .limit(
          limit,
        )
        .select({
          discordId:
            1,
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
        await this
          .processPendingLoot(
            profile.discordId,
          );

        processed++;
      } catch (error) {
        failed++;

        console.error(
          `❌ Loot settlement failed for ${profile.discordId}:`,
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
};
