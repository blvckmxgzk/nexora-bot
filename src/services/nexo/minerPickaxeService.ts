import mongoose from "mongoose";

import {
  MinerProfile,
} from "../../models/MinerProfile.js";

import {
  MinerPickaxe,
} from "../../models/MinerPickaxe.js";

import {
  minerService,
} from "./minerService.js";

export const minerPickaxeService = {
  async list(
    discordId:
      string,
  ) {
    await minerService
      .settle(
        discordId,
      );

    return MinerPickaxe.find({
      discordId,
    });
  },

  async equip(
    discordId:
      string,

    pickaxeInstanceId:
      string,
  ) {
    /*
     * settle ด้วย Pickaxe เก่าก่อน
     * ไม่ให้ Pickaxe ใหม่คำนวณย้อนหลัง
     */
    await minerService
      .settle(
        discordId,
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
            const target =
              await MinerPickaxe
                .findOne({
                  discordId,

                  pickaxeInstanceId,
                })
                .session(
                  session,
                );

            if (!target) {
              throw new Error(
                "ไม่พบ Pickaxe นี้",
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
                "ไม่พบ Miner Profile",
              );
            }

            await MinerPickaxe
              .updateMany(
                {
                  discordId,
                },
                {
                  $set: {
                    equipped:
                      false,
                  },
                },
                {
                  session,
                },
              );

            target.equipped =
              true;

            await target.save({
              session,
            });

            profile
              .equippedPickaxeInstanceId =
              pickaxeInstanceId;

            profile.lastSettledAt =
              new Date();

            await profile.save({
              session,
            });

            result =
              target;
          },
        );
    } finally {
      await session
        .endSession();
    }

    return result;
  },
};
