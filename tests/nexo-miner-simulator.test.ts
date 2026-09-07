
import {

  afterAll,

  afterEach,

  beforeAll,

  describe,

  expect,

  it,

} from "vitest";

import mongoose from "mongoose";

import {

  MongoMemoryReplSet,

} from "mongodb-memory-server";

import {

  MinerProfile,

} from "../src/models/MinerProfile.ts";

import {

  MinerPickaxe,

} from "../src/models/MinerPickaxe.ts";

import {

  MinerInventoryItem,

} from "../src/models/MinerInventoryItem.ts";

import {

  MinerActiveBoost,

} from "../src/models/MinerActiveBoost.ts";

import {

  MinerRareDropEvent,

} from "../src/models/MinerRareDropEvent.ts";

import {

  Economy,

} from "../src/models/Economy.ts";

import {

  Transaction,

} from "../src/models/Transaction.ts";

import {

  minerService,

} from "../src/services/nexo/minerService.ts";

import {

  minerShopService,

} from "../src/services/nexo/minerShopService.ts";

import {

  minerBoostService,

} from "../src/services/nexo/minerBoostService.ts";

import {

  minerLootService,

} from "../src/services/nexo/minerLootService.ts";

import {

  minerPickaxeService,

} from "../src/services/nexo/minerPickaxeService.ts";

import {

  NexoNumber,

} from "../src/services/nexo/NexoNumber.ts";

let replSet:

  MongoMemoryReplSet;

beforeAll(

  async () => {

    replSet =

      await MongoMemoryReplSet

        .create({

          replSet: {

            count: 1,

            storageEngine:

              "wiredTiger",

          },

        });

    await mongoose.connect(

      replSet.getUri(),

      {

        dbName:

          "nexo-simulator",

      },

    );

    await Promise.all([

      MinerProfile.syncIndexes(),

      MinerPickaxe.syncIndexes(),

      MinerInventoryItem.syncIndexes(),

      MinerActiveBoost.syncIndexes(),

      MinerRareDropEvent.syncIndexes(),

      Economy.syncIndexes(),

      Transaction.syncIndexes(),

    ]);

  },

  120_000,

);

afterEach(

  async () => {

    await Promise.all([

      MinerProfile.deleteMany({}),

      MinerPickaxe.deleteMany({}),

      MinerInventoryItem.deleteMany({}),

      MinerActiveBoost.deleteMany({}),

      MinerRareDropEvent.deleteMany({}),

      Economy.deleteMany({}),

      Transaction.deleteMany({}),

    ]);

  },

);

afterAll(

  async () => {

    await mongoose.disconnect();

    await replSet.stop();

  },

  120_000,

);

describe(

  "NEXO Miner Simulator Layer",

  () => {

    it(

      "shop purchase spends NEXO and gives item",

      async () => {

        await minerService.createProfile(

          "SIM-A",

        );

        await Economy.updateOne(

          {

            discordId:

              "SIM-A",

          },

          {

            $set: {

              balance:

                "1e30",

            },

          },

        );

        const result =

          await minerShopService.buy(

            "SIM-A",

            "luck_potion_minor",

            2,

          );

        expect(

          result.quantity,

        ).toBe(

          2,

        );

        const item =

          await MinerInventoryItem

            .findOne({

              discordId:

                "SIM-A",

              itemId:

                "luck_potion_minor",

            });

        expect(

          item?.quantity,

        ).toBe(

          2,

        );

      },

    );

    it(

      "luck potion consumes item and activates boost",

      async () => {

        await minerService.createProfile(

          "SIM-B",

        );

        await MinerInventoryItem.create({

          discordId:

            "SIM-B",

          itemId:

            "luck_potion_minor",

          quantity:

            1,

        });

        const result =

          await minerBoostService

            .useItem(

              "SIM-B",

              "luck_potion_minor",

            );

        expect(

          result.stat,

        ).toBe(

          "luck",

        );

        expect(

          await MinerActiveBoost

            .countDocuments({

              discordId:

                "SIM-B",

            }),

        ).toBe(

          1,

        );

      },

    );

    it(

      "same-stat potion extends rather than stacks multiplicatively",

      async () => {

        await minerService.createProfile(

          "SIM-C",

        );

        await MinerInventoryItem.create({

          discordId:

            "SIM-C",

          itemId:

            "luck_potion_minor",

          quantity:

            2,

        });

        await minerBoostService.useItem(

          "SIM-C",

          "luck_potion_minor",

        );

        const first =

          await MinerActiveBoost

            .findOne({

              discordId:

                "SIM-C",

              stat:

                "luck",

            });

        await minerBoostService.useItem(

          "SIM-C",

          "luck_potion_minor",

        );

        const second =

          await MinerActiveBoost

            .findOne({

              discordId:

                "SIM-C",

              stat:

                "luck",

            });

        expect(

          second?.multiplier,

        ).toBe(

          first?.multiplier,

        );

        expect(

          second!

            .expiresAt

            .getTime(),

        ).toBeGreaterThan(

          first!

            .expiresAt

            .getTime(),

        );

      },

    );

    it(

      "temporary Infinite Bag extends profile",

      async () => {

        await minerService.createProfile(

          "SIM-D",

        );

        await MinerInventoryItem.create({

          discordId:

            "SIM-D",

          itemId:

            "infinite_bag_15m",

          quantity:

            1,

        });

        await minerBoostService.useItem(

          "SIM-D",

          "infinite_bag_15m",

        );

        const profile =

          await MinerProfile.findOne({

            discordId:

              "SIM-D",

          });

        expect(

          profile

            ?.infiniteBagUntil,

        ).not.toBeNull();

      },

    );

    it(

      "permanent Infinite Bag becomes permanent",

      async () => {

        await minerService.createProfile(

          "SIM-E",

        );

        await MinerInventoryItem.create({

          discordId:

            "SIM-E",

          itemId:

            "eternal_infinite_bag",

          quantity:

            1,

        });

        await minerBoostService.useItem(

          "SIM-E",

          "eternal_infinite_bag",

        );

        const profile =

          await MinerProfile.findOne({

            discordId:

              "SIM-E",

          });

        expect(

          profile

            ?.permanentInfiniteBag,

        ).toBe(

          true,

        );

      },

    );

    it(

      "pending loot debt survives independently",

      async () => {

        await minerService.createProfile(

          "SIM-F",

        );

        await MinerProfile.updateOne(

          {

            discordId:

              "SIM-F",

          },

          {

            $set: {

              pendingLootRolls:

                20,

            },

          },

        );

        await minerLootService

          .processPendingLoot(

            "SIM-F",

            {

              rng:

                () =>

                  0.999999,

            },

          );

        const profile =

          await MinerProfile.findOne({

            discordId:

              "SIM-F",

          });

        expect(

          profile

            ?.pendingLootRolls,

        ).toBe(

          0,

        );

      },

    );

    it(

      "guaranteed low RNG can produce mining item",

      async () => {

        await minerService.createProfile(

          "SIM-G",

        );

        await MinerProfile.updateOne(

          {

            discordId:

              "SIM-G",

          },

          {

            $set: {

              pendingLootRolls:

                1,

            },

          },

        );

        await minerLootService

          .processPendingLoot(

            "SIM-G",

            {

              luck:

                new NexoNumber(

                  "1e100",

                ),

              rng:

                () =>

                  0,

            },

          );

        expect(

          await MinerInventoryItem

            .countDocuments({

              discordId:

                "SIM-G",

            }),

        ).toBeGreaterThan(

          0,

        );

      },

    );

    it(

      "starter cannot directly drop endgame pickaxe",

      async () => {

        await minerService.createProfile(

          "SIM-H",

        );

        await MinerProfile.updateOne(

          {

            discordId:

              "SIM-H",

          },

          {

            $set: {

              pendingLootRolls:

                100,

            },

          },

        );

        await minerLootService

          .processPendingLoot(

            "SIM-H",

            {

              luck:

                new NexoNumber(

                  "1e100",

                ),

              rng:

                () =>

                  0,

            },

          );

        const pickaxes =

          await MinerPickaxe.find({

            discordId:

              "SIM-H",

          });

        for (

          const pickaxe

          of pickaxes

        ) {

          expect(

            [

              "rusty_pickaxe",

              "copper_pickaxe",

              "steel_pickaxe",

            ],

          ).toContain(

            pickaxe.definitionId,

          );

        }

      },

    );

    it(

      "can equip owned pickaxe",

      async () => {

        await minerService.createProfile(

          "SIM-I",

        );

        const pickaxe =

          await MinerPickaxe.create({

            pickaxeInstanceId:

              "PICK-SIM-I",

            discordId:

              "SIM-I",

            definitionId:

              "copper_pickaxe",

            rarity:

              "uncommon",

            basePower:

              "1e4",

            baseLuck:

              "1e2",

            baseNetWorth:

              "1e10",

            equipped:

              false,

            tradeLocked:

              false,

            source:

              "mining",

          });

        await minerPickaxeService.equip(

          "SIM-I",

          pickaxe.pickaxeInstanceId,

        );

        const profile =

          await MinerProfile.findOne({

            discordId:

              "SIM-I",

          });

        expect(

          profile

            ?.equippedPickaxeInstanceId,

        ).toBe(

          "PICK-SIM-I",

        );

      },

    );

  },

);

