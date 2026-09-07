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
  MinerOreStack,
} from "../src/models/MinerOreStack.ts";

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
            count:
              1,

            storageEngine:
              "wiredTiger",
          },
        });

    await mongoose.connect(
      replSet.getUri(),
      {
        dbName:
          "nexo-miner-engine",
      },
    );

    await Promise.all([
      MinerProfile
        .syncIndexes(),

      MinerPickaxe
        .syncIndexes(),

      MinerOreStack
        .syncIndexes(),

      Economy
        .syncIndexes(),

      Transaction
        .syncIndexes(),
    ]);
  },
  120_000,
);

afterEach(
  async () => {
    await Promise.all([
      MinerProfile
        .deleteMany({}),

      MinerPickaxe
        .deleteMany({}),

      MinerOreStack
        .deleteMany({}),

      Economy
        .deleteMany({}),

      Transaction
        .deleteMany({}),
    ]);
  },
);

afterAll(
  async () => {
    await mongoose
      .disconnect();

    await replSet
      .stop();
  },
  120_000,
);

describe(
  "NEXO Miner Engine",
  () => {
    it(
      "creates profile and starter pickaxe",
      async () => {
        const profile =
          await minerService
            .createProfile(
              "USER-A",
            );

        expect(
          profile.miningActive,
        ).toBe(
          true,
        );

        expect(
          profile.bagWeight,
        ).toBe(
          "0",
        );

        const pickaxe =
          await MinerPickaxe
            .findOne({
              discordId:
                "USER-A",
            });

        expect(
          pickaxe
            ?.definitionId,
        ).toBe(
          "rusty_pickaxe",
        );

        expect(
          pickaxe
            ?.tradeLocked,
        ).toBe(
          true,
        );
      },
    );

    it(
      "creates 100kg starter bag",
      async () => {
        await minerService
          .createProfile(
            "USER-B",
          );

        const summary =
          await minerService
            .getSummary(
              "USER-B",
            );

        expect(
          summary
            ?.stats
            .maxWeight
            .eq(
              100,
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "idle settlement mines ore",
      async () => {
        await minerService
          .createProfile(
            "USER-C",
          );

        const profile =
          await MinerProfile
            .findOne({
              discordId:
                "USER-C",
            });

        const now =
          new Date(
            profile!
              .lastSettledAt
              .getTime() +
            60_000,
          );

        const result =
          await minerService
            .settle(
              "USER-C",
              {
                now,

                rng:
                  () =>
                    0.1,
              },
            );

        expect(
          result.mined,
        ).toBeGreaterThan(
          0,
        );

        expect(
          await MinerOreStack
            .countDocuments({
              discordId:
                "USER-C",

              location:
                "bag",
            }),
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "mining increases overtime networth",
      async () => {
        await minerService
          .createProfile(
            "USER-D",
          );

        const profile =
          await MinerProfile
            .findOne({
              discordId:
                "USER-D",
            });

        await minerService
          .settle(
            "USER-D",
            {
              now:
                new Date(
                  profile!
                    .lastSettledAt
                    .getTime() +
                  60_000,
                ),

              rng:
                () =>
                  0.1,
            },
          );

        const latest =
          await MinerProfile
            .findOne({
              discordId:
                "USER-D",
            });

        expect(
          new NexoNumber(
            latest!
              .allTimeMinedNetworth,
          ).gt(
            0,
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "sell credits NEXO atomically",
      async () => {
        await minerService
          .createProfile(
            "USER-E",
          );

        await MinerOreStack
          .create({
            discordId:
              "USER-E",

            definitionId:
              "stone",

            rarity:
              "common",

            location:
              "bag",

            quantity:
              10,

            totalWeight:
              "10",

            totalNetWorth:
              "10",

            largestWeight:
              "1",

            largestSizeClass:
              "normal",
          });

        await MinerProfile
          .updateOne(
            {
              discordId:
                "USER-E",
            },
            {
              $set: {
                bagWeight:
                  "10",

                lastSettledAt:
                  new Date(),
              },
            },
          );

        const result =
          await minerService
            .sellAll(
              "USER-E",
            );

        expect(
          new NexoNumber(
            result.payout,
          ).gt(
            0,
          ),
        ).toBe(
          true,
        );

        expect(
          await MinerOreStack
            .countDocuments({
              discordId:
                "USER-E",

              location:
                "bag",
            }),
        ).toBe(
          0,
        );

        expect(
          await Transaction
            .countDocuments({
              discordId:
                "USER-E",

              type:
                "miner_sell",
            }),
        ).toBe(
          1,
        );
      },
    );

    it(
      "power upgrade spends NEXO",
      async () => {
        await minerService
          .createProfile(
            "USER-F",
          );

        await Economy
          .updateOne(
            {
              discordId:
                "USER-F",
            },
            {
              $set: {
                balance:
                  "1e12",
              },
            },
          );

        const result =
          await minerService
            .upgrade(
              "USER-F",
              "power",
            );

        expect(
          result.level,
        ).toBe(
          1,
        );

        const pickaxe =
          await MinerPickaxe
            .findOne({
              discordId:
                "USER-F",
            });

        expect(
          pickaxe
            ?.powerLevel,
        ).toBe(
          1,
        );
      },
    );

    it(
      "maxweight upgrade increases capacity",
      async () => {
        await minerService
          .createProfile(
            "USER-G",
          );

        await Economy
          .updateOne(
            {
              discordId:
                "USER-G",
            },
            {
              $set: {
                balance:
                  "1e12",
              },
            },
          );

        const before =
          await minerService
            .getSummary(
              "USER-G",
            );

        await minerService
          .upgrade(
            "USER-G",
            "maxweight",
          );

        const after =
          await minerService
            .getSummary(
              "USER-G",
            );

        expect(
          after!
            .stats
            .maxWeight
            .gt(
              before!
                .stats
                .maxWeight,
            ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "legendary ore can move to chest without bag weight",
      async () => {
        await minerService
          .createProfile(
            "USER-H",
          );

        await MinerOreStack
          .create({
            discordId:
              "USER-H",

            definitionId:
              "uranium",

            rarity:
              "legendary",

            location:
              "bag",

            quantity:
              1,

            totalWeight:
              "5",

            totalNetWorth:
              "5e9",

            largestWeight:
              "5",

            largestSizeClass:
              "normal",
          });

        await MinerProfile
          .updateOne(
            {
              discordId:
                "USER-H",
            },
            {
              $set: {
                bagWeight:
                  "5",

                lastSettledAt:
                  new Date(),
              },
            },
          );

        await minerService
          .storeOre(
            "USER-H",
            "uranium",
          );

        const profile =
          await MinerProfile
            .findOne({
              discordId:
                "USER-H",
            });

        expect(
          new NexoNumber(
            profile!
              .bagWeight,
          ).eq(
            0,
          ),
        ).toBe(
          true,
        );

        expect(
          await MinerOreStack
            .countDocuments({
              discordId:
                "USER-H",

              location:
                "chest",
            }),
        ).toBe(
          1,
        );
      },
    );

    it(
      "common ore cannot enter rare chest",
      async () => {
        await minerService
          .createProfile(
            "USER-I",
          );

        await MinerOreStack
          .create({
            discordId:
              "USER-I",

            definitionId:
              "stone",

            rarity:
              "common",

            location:
              "bag",

            quantity:
              1,

            totalWeight:
              "1",

            totalNetWorth:
              "1",

            largestWeight:
              "1",

            largestSizeClass:
              "normal",
          });

        await expect(
          minerService
            .storeOre(
              "USER-I",
              "stone",
            ),
        ).rejects.toThrow(
          /Legendary/,
        );
      },
    );

    it(
      "leaderboard uses overtime networth",
      async () => {
        await minerService
          .createProfile(
            "USER-J1",
          );

        await minerService
          .createProfile(
            "USER-J2",
          );

        await MinerProfile
          .updateOne(
            {
              discordId:
                "USER-J1",
            },
            {
              $set: {
                allTimeMinedNetworth:
                  "1e100",
              },
            },
          );

        await MinerProfile
          .updateOne(
            {
              discordId:
                "USER-J2",
            },
            {
              $set: {
                allTimeMinedNetworth:
                  "1e200",
              },
            },
          );

        const board =
          await minerService
            .leaderboard();

        expect(
          board[0]
            .discordId,
        ).toBe(
          "USER-J2",
        );
      },
    );
  },
);
