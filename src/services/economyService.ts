import crypto from "node:crypto";

import mongoose, {
  type ClientSession,
} from "mongoose";

import {
  Economy,
} from "../models/Economy.js";

import {
  Transaction,
} from "../models/Transaction.js";

import {
  NexoNumber,
  type NexoNumberish,
} from "./nexo/NexoNumber.js";

export type EarnTransactionType =
  | "earn"
  | "reward"
  | "refund";

export type SpendTransactionType =
  | "spend"
  | "purchase"
  | "miner_upgrade";


export interface DailyClaimResult {
  claimed: boolean;
  balance: string;
  reward: string;
  remainingMs: number;
}

function createTransactionId():
  string {
  return (
    "NX-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

async function getOrCreateInternal(
  discordId:
    string,

  session?:
    ClientSession,
) {
  return Economy
    .findOneAndUpdate(
      {
        discordId,
      },
      {
        $setOnInsert: {
          discordId,

          balance:
            "0",

          bank:
            "0",

          lifetimeEarned:
            "0",

          lifetimeSpent:
            "0",

          inventory:
            [],
        },
      },
      {
        upsert:
          true,

        new:
          true,

        setDefaultsOnInsert:
          true,

        ...(session
          ? {
              session,
            }
          : {}),
      },
    );
}

function assertPositive(
  amount:
    NexoNumberish,
) {
  const value =
    NexoNumber.from(
      amount,
    );

  if (
    value.lte(
      0,
    )
  ) {
    throw new Error(
      "Amount must be greater than zero.",
    );
  }

  return value;
}

export const economyService = {
  async getOrCreate(
    discordId:
      string,
  ) {
    return getOrCreateInternal(
      discordId,
    );
  },

  async getBalance(
    discordId:
      string,
  ) {
    const economy =
      await getOrCreateInternal(
        discordId,
      );

    return economy.balance;
  },

  async addBalance(
    discordId:
      string,

    amount:
      NexoNumberish,

    type:
      EarnTransactionType =
        "earn",

    description =
      "",
  ) {
    const value =
      assertPositive(
        amount,
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
            const economy =
              await getOrCreateInternal(
                discordId,
                session,
              );

            const before =
              NexoNumber.from(
                economy.balance,
              );

            const after =
              before.add(
                value,
              );

            economy.balance =
              after.toStorage();

            economy.lifetimeEarned =
              NexoNumber
                .from(
                  economy
                    .lifetimeEarned,
                )
                .add(
                  value,
                )
                .toStorage();

            await economy.save({
              session,
            });

            await Transaction
              .create(
                [
                  {
                    transactionId:
                      createTransactionId(),

                    discordId,

                    type,

                    amount:
                      value.toStorage(),

                    balanceBefore:
                      before.toStorage(),

                    balanceAfter:
                      after.toStorage(),

                    description,
                  },
                ],
                {
                  session,
                },
              );

            result =
              economy;
          },
        );
    } finally {
      await session
        .endSession();
    }

    return result;
  },

  async removeBalance(
    discordId:
      string,

    amount:
      NexoNumberish,

    type:
      SpendTransactionType =
        "spend",

    description =
      "",
  ) {
    const value =
      assertPositive(
        amount,
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
            const economy =
              await getOrCreateInternal(
                discordId,
                session,
              );

            const before =
              NexoNumber.from(
                economy.balance,
              );

            const availableBalance =
              before.sub(
                economy.reservedBalance ??
                  "0",
              );

            if (
              availableBalance.lt(
                value,
              )
            ) {
              throw new Error(
                "Insufficient available balance.",
              );
            }

            const after =
              before.sub(
                value,
              );

            economy.balance =
              after.toStorage();

            economy.lifetimeSpent =
              NexoNumber
                .from(
                  economy
                    .lifetimeSpent,
                )
                .add(
                  value,
                )
                .toStorage();

            await economy.save({
              session,
            });

            await Transaction
              .create(
                [
                  {
                    transactionId:
                      createTransactionId(),

                    discordId,

                    type,

                    amount:
                      value.toStorage(),

                    balanceBefore:
                      before.toStorage(),

                    balanceAfter:
                      after.toStorage(),

                    description,
                  },
                ],
                {
                  session,
                },
              );

            result =
              economy;
          },
        );
    } finally {
      await session
        .endSession();
    }

    return result;
  },

  async claimDaily(
    discordId:
      string,

    reward:
      NexoNumberish =
        "500",
  ): Promise<DailyClaimResult> {
    const value =
      assertPositive(
        reward,
      );

    const DAY_MS =
      24 *
      60 *
      60 *
      1000;

    const session =
      await mongoose
        .startSession();

    let result:
      | {
          claimed:
            true;

          balance:
            string;

          reward:
            string;

          remainingMs:
            0;
        }
      | {
          claimed:
            false;

          balance:
            string;

          reward:
            string;

          remainingMs:
            number;
        }
      | null =
        null;

    try {
      await session
        .withTransaction(
          async () => {
            const economy =
              await getOrCreateInternal(
                discordId,
                session,
              );

            const now =
              Date.now();

            if (
              economy.lastDailyAt
            ) {
              const elapsed =
                now -
                economy
                  .lastDailyAt
                  .getTime();

              if (
                elapsed <
                DAY_MS
              ) {
                result = {
                  claimed:
                    false,

                  balance:
                    economy.balance,

                  reward:
                    value.toStorage(),

                  remainingMs:
                    DAY_MS -
                    elapsed,
                };

                return;
              }
            }

            const before =
              NexoNumber.from(
                economy.balance,
              );

            const after =
              before.add(
                value,
              );

            economy.balance =
              after.toStorage();

            economy.lifetimeEarned =
              NexoNumber
                .from(
                  economy
                    .lifetimeEarned,
                )
                .add(
                  value,
                )
                .toStorage();

            economy.lastDailyAt =
              new Date();

            await economy.save({
              session,
            });

            await Transaction
              .create(
                [
                  {
                    transactionId:
                      createTransactionId(),

                    discordId,

                    type:
                      "reward",

                    amount:
                      value.toStorage(),

                    balanceBefore:
                      before.toStorage(),

                    balanceAfter:
                      after.toStorage(),

                    description:
                      "Daily reward",
                  },
                ],
                {
                  session,
                },
              );

            result = {
              claimed:
                true,

              balance:
                after.toStorage(),

              reward:
                value.toStorage(),

              remainingMs:
                0,
            };
          },
        );
    } finally {
      await session
        .endSession();
    }

    if (!result) {
      throw new Error(
        "Daily transaction failed.",
      );
    }

    return result;
  },

  async transfer():
    Promise<never> {
    throw new Error(
      "Direct NEXO transfers are disabled. Use the Trade system.",
    );
  },
};
