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
  MinerTrade,
} from "../src/models/MinerTrade.ts";

import {
  MinerTradeAction,
} from "../src/models/MinerTradeAction.ts";

import {
  MinerInventoryItem,
} from "../src/models/MinerInventoryItem.ts";

import {
  MinerOreStack,
} from "../src/models/MinerOreStack.ts";

import {
  MinerPickaxe,
} from "../src/models/MinerPickaxe.ts";

import {
  MinerProfile,
} from "../src/models/MinerProfile.ts";

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
  minerTradeService,
} from "../src/services/nexo/minerTradeService.ts";

import {
  NexoNumber,
} from "../src/services/nexo/NexoNumber.ts";

let replSet:
  MongoMemoryReplSet;

async function setup(
  user:
    string,

  balance =
    "1e20",
) {
  await minerService
    .createProfile(
      user,
    );

  await Economy.updateOne(
    {
      discordId:
        user,
    },
    {
      $set: {
        balance,
        reservedBalance:
          "0",
      },
    },
  );
}

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
          "nexo-trade",
      },
    );

    await Promise.all([
      MinerTrade.syncIndexes(),
      MinerTradeAction.syncIndexes(),
      MinerInventoryItem.syncIndexes(),
      MinerOreStack.syncIndexes(),
      MinerPickaxe.syncIndexes(),
      MinerProfile.syncIndexes(),
      Economy.syncIndexes(),
      Transaction.syncIndexes(),
    ]);
  },
  120_000,
);

afterEach(
  async () => {
    await Promise.all([
      MinerTrade.deleteMany({}),
      MinerTradeAction.deleteMany({}),
      MinerInventoryItem.deleteMany({}),
      MinerOreStack.deleteMany({}),
      MinerPickaxe.deleteMany({}),
      MinerProfile.deleteMany({}),
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
  "NEXO Miner Trade",
  () => {
    it(
      "creates trade",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        const trade =
          await minerTradeService
            .create(
              "GUILD",
              "TRADE-A",
              "TRADE-B",
            );

        expect(
          trade.status,
        ).toBe(
          "open",
        );
      },
    );

    it(
      "NEXO offer reserves balance",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService
          .offerNexo(
            trade.tradeId,
            "TRADE-A",
            "1e10",
          );

        const economy =
          await Economy.findOne({
            discordId:
              "TRADE-A",
          });

        expect(
          new NexoNumber(
            economy!
              .reservedBalance,
          ).eq(
            "1e10",
          ),
        ).toBe(true);
      },
    );

    it(
      "item offer locks quantity",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        await MinerInventoryItem.create({
          discordId:
            "TRADE-A",
          itemId:
            "luck_potion_minor",
          quantity:
            5,
        });

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService
          .offerItem(
            trade.tradeId,
            "TRADE-A",
            "luck_potion_minor",
            3,
          );

        const item =
          await MinerInventoryItem.findOne({
            discordId:
              "TRADE-A",
          });

        expect(
          item
            ?.tradeLockedQuantity,
        ).toBe(3);
      },
    );

    it(
      "ore offer locks entire stack",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        await MinerOreStack.create({
          discordId:
            "TRADE-A",
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

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService
          .offerOre(
            trade.tradeId,
            "TRADE-A",
            "stone",
          );

        const ore =
          await MinerOreStack.findOne({
            discordId:
              "TRADE-A",
          });

        expect(
          ore?.tradeLocked,
        ).toBe(true);
      },
    );

    it(
      "starter Pickaxe cannot trade",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        const pickaxe =
          await MinerPickaxe.findOne({
            discordId:
              "TRADE-A",
        });

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await expect(
          minerTradeService
            .offerPickaxe(
              trade.tradeId,
              "TRADE-A",
              pickaxe!
                .pickaxeInstanceId,
            ),
        ).rejects.toThrow();
      },
    );

    it(
      "rejects unfair >10 percent trade",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService
          .offerNexo(
            trade.tradeId,
            "TRADE-A",
            "100",
          );

        await minerTradeService
          .offerNexo(
            trade.tradeId,
            "TRADE-B",
            "120",
          );

        await expect(
          minerTradeService.confirm(
            trade.tradeId,
            "TRADE-A",
          ),
        ).rejects.toThrow(
          /10%/,
        );
      },
    );

    it(
      "accepts exactly 10 percent difference",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService
          .offerNexo(
            trade.tradeId,
            "TRADE-A",
            "100",
          );

        await minerTradeService
          .offerNexo(
            trade.tradeId,
            "TRADE-B",
            "110",
          );

        await minerTradeService.confirm(
          trade.tradeId,
          "TRADE-A",
        );

        const result =
          await minerTradeService.confirm(
            trade.tradeId,
            "TRADE-B",
          );

        expect(
          result.completed,
        ).toBe(true);

        expect(
          (
            await MinerTrade.findOne({
              tradeId:
                trade.tradeId,
            })
          )?.status,
        ).toBe(
          "completed",
        );
      },
    );

    it(
      "changing offer resets confirmations",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService.offerNexo(
          trade.tradeId,
          "TRADE-A",
          "100",
        );

        await minerTradeService.offerNexo(
          trade.tradeId,
          "TRADE-B",
          "100",
        );

        await minerTradeService.confirm(
          trade.tradeId,
          "TRADE-A",
        );

        await minerTradeService.offerNexo(
          trade.tradeId,
          "TRADE-B",
          "105",
        );

        const latest =
          await MinerTrade.findOne({
            tradeId:
              trade.tradeId,
          });

        expect(
          latest
            ?.sideA
            .confirmedAt,
        ).toBeNull();
      },
    );

    it(
      "cancel releases reservations",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService.offerNexo(
          trade.tradeId,
          "TRADE-A",
          "1e10",
        );

        await minerTradeService.cancel(
          trade.tradeId,
          "TRADE-A",
        );

        const economy =
          await Economy.findOne({
            discordId:
              "TRADE-A",
          });

        expect(
          new NexoNumber(
            economy!
              .reservedBalance,
          ).eq(0),
        ).toBe(true);
      },
    );

    it(
      "completed trade moves item ownership",
      async () => {
        await setup("TRADE-A");
        await setup("TRADE-B");

        await MinerInventoryItem.create({
          discordId:
            "TRADE-A",
          itemId:
            "luck_potion_minor",
          quantity:
            1,
        });

        /*
         * Potion intrinsic = 1e4
         * B offers equal NEXO
         */
        const trade =
          await minerTradeService.create(
            "GUILD",
            "TRADE-A",
            "TRADE-B",
          );

        await minerTradeService.offerItem(
          trade.tradeId,
          "TRADE-A",
          "luck_potion_minor",
          1,
        );

        await minerTradeService.offerNexo(
          trade.tradeId,
          "TRADE-B",
          "1e4",
        );

        await minerTradeService.confirm(
          trade.tradeId,
          "TRADE-A",
        );

        await minerTradeService.confirm(
          trade.tradeId,
          "TRADE-B",
        );

        expect(
          await MinerInventoryItem
            .countDocuments({
              discordId:
                "TRADE-A",
              itemId:
                "luck_potion_minor",
            }),
        ).toBe(0);

        expect(
          (
            await MinerInventoryItem.findOne({
              discordId:
                "TRADE-B",
              itemId:
                "luck_potion_minor",
            })
          )?.quantity,
        ).toBe(1);
      },
    );
  },
);
