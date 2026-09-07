import mongoose from "mongoose";

import {
  MinerInventoryItem,
} from "../../models/MinerInventoryItem.js";

import {
  MinerActiveBoost,
} from "../../models/MinerActiveBoost.js";

import {
  MinerProfile,
} from "../../models/MinerProfile.js";

import {
  MINER_ITEM_MAP,
} from "../../game/nexoMiner/itemCatalog.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

export const minerBoostService = {
  async getMultipliers(
    discordId:
      string,

    now =
      new Date(),
  ) {
    const boosts =
      await MinerActiveBoost
        .find({
          discordId,

          expiresAt: {
            $gt:
              now,
          },
        });

    const result = {
      power:
        NexoNumber.one(),

      luck:
        NexoNumber.one(),

      size:
        NexoNumber.one(),

      sell:
        NexoNumber.one(),
    };

    for (
      const boost
      of boosts
    ) {
      const multiplier =
        new NexoNumber(
          boost.multiplier,
        );

      if (
        boost.stat ===
        "all"
      ) {
        result.power =
          result.power.mul(
            multiplier,
          );

        result.luck =
          result.luck.mul(
            multiplier,
          );

        result.size =
          result.size.mul(
            multiplier,
          );

        result.sell =
          result.sell.mul(
            multiplier,
          );

        continue;
      }

      result[
        boost.stat
      ] =
        result[
          boost.stat
        ].mul(
          multiplier,
        );
    }

    return result;
  },

  async getActive(
    discordId:
      string,

    now =
      new Date(),
  ) {
    return MinerActiveBoost
      .find({
        discordId,

        expiresAt: {
          $gt:
            now,
        },
      })
      .sort({
        expiresAt:
          1,
      });
  },

  async useItem(
    discordId:
      string,

    itemId:
      string,
  ) {
    const definition =
      MINER_ITEM_MAP.get(
        itemId,
      );

    if (!definition) {
      throw new Error(
        "ไม่พบ Miner Item นี้",
      );
    }

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
                "ยังไม่มี Miner Profile",
              );
            }

            const inventory =
              await MinerInventoryItem
                .findOne({
                  discordId,
                  itemId,
                })
                .session(
                  session,
                );

            if (
              !inventory ||
              inventory.quantity -
                inventory
                  .tradeLockedQuantity <=
                0
            ) {
              throw new Error(
                "คุณไม่มี Item นี้",
              );
            }

            const now =
              new Date();

            if (
              definition.type ===
              "boost" &&
              definition.effect
                ?.stat &&
              definition.effect
                ?.multiplier &&
              definition.effect
                ?.durationSeconds
            ) {
              const stat =
                definition
                  .effect
                  .stat;

              const existing =
                await MinerActiveBoost
                  .findOne({
                    discordId,
                    stat,
                  })
                  .session(
                    session,
                  );

              const durationMs =
                definition
                  .effect
                  .durationSeconds *
                1000;

              let expiresAt =
                new Date(
                  now.getTime() +
                    durationMs,
                );

              let multiplier =
                new NexoNumber(
                  definition
                    .effect
                    .multiplier,
                );

              if (existing) {
                const baseTime =
                  existing
                    .expiresAt
                    .getTime() >
                  now.getTime()
                    ? existing
                        .expiresAt
                        .getTime()
                    : now.getTime();

                expiresAt =
                  new Date(
                    baseTime +
                      durationMs,
                  );

                const old =
                  new NexoNumber(
                    existing
                      .multiplier,
                  );

                if (
                  old.gt(
                    multiplier,
                  )
                ) {
                  multiplier =
                    old;
                }

                existing.itemId =
                  itemId;

                existing.multiplier =
                  multiplier
                    .toStorage();

                existing.startedAt =
                  now;

                existing.expiresAt =
                  expiresAt;

                await existing.save({
                  session,
                });
              } else {
                await MinerActiveBoost
                  .create(
                    [
                      {
                        discordId,
                        stat,
                        itemId,

                        multiplier:
                          multiplier
                            .toStorage(),

                        startedAt:
                          now,

                        expiresAt,
                      },
                    ],
                    {
                      session,
                    },
                  );
              }

              result = {
                type:
                  "boost",

                stat,

                multiplier:
                  multiplier
                    .toStorage(),

                expiresAt,
              };
            } else if (
              definition.type ===
                "token" &&
              definition.effect
                ?.infiniteBag
            ) {
              if (
                definition.effect
                  .permanent
              ) {
                profile
                  .permanentInfiniteBag =
                  true;

                result = {
                  type:
                    "infinite_bag",

                  permanent:
                    true,
                };
              } else {
                const seconds =
                  definition.effect
                    .durationSeconds ??
                  0;

                const current =
                  profile
                    .infiniteBagUntil
                    ?.getTime() ??
                  0;

                const base =
                  Math.max(
                    current,
                    now.getTime(),
                  );

                profile
                  .infiniteBagUntil =
                  new Date(
                    base +
                    seconds *
                      1000,
                  );

                result = {
                  type:
                    "infinite_bag",

                  permanent:
                    false,

                  expiresAt:
                    profile
                      .infiniteBagUntil,
                };
              }

              profile.pausedReason =
                null;

              profile.miningActive =
                true;

              profile.lastSettledAt =
                now;

              await profile.save({
                session,
              });
            } else {
              throw new Error(
                "Item นี้ยังไม่สามารถกดใช้ได้",
              );
            }

            inventory.quantity--;

            if (
              inventory.quantity <=
              0
            ) {
              await inventory
                .deleteOne({
                  session,
                });
            } else {
              await inventory.save({
                session,
              });
            }
          },
        );
    } finally {
      await session
        .endSession();
    }

    return result;
  },
};
