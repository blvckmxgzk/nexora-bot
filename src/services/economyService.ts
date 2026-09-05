import { Economy } from "../models/Economy.js";
import { Transaction } from "../models/Transaction.js";

export type EarnTransactionType =
  | "earn"
  | "reward"
  | "refund";

export type SpendTransactionType =
  | "spend"
  | "purchase";

function createTransactionId(): string {
  return `TX-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase()}`;
}

export const economyService = {
  async getOrCreate(discordId: string) {
    let economy = await Economy.findOne({
      discordId,
    });

    if (!economy) {
      economy = new Economy({
        discordId,
        balance: 0,
        bank: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        inventory: [],
      });

      await economy.save();
    }

    return economy;
  },

  async getBalance(discordId: string) {
    const economy =
      await this.getOrCreate(discordId);

    return economy.balance;
  },

  async addBalance(
    discordId: string,
    amount: number,
    type: EarnTransactionType = "earn",
    description = "",
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        "Amount must be greater than zero.",
      );
    }

    const economy =
      await this.getOrCreate(discordId);

    const balanceBefore = economy.balance;

    economy.balance += amount;
    economy.lifetimeEarned += amount;

    await economy.save();

    await Transaction.create({
      transactionId:
        createTransactionId(),
      discordId,
      type,
      amount,
      balanceBefore,
      balanceAfter: economy.balance,
      description,
    });

    return economy;
  },

  async removeBalance(
    discordId: string,
    amount: number,
    type: SpendTransactionType = "spend",
    description = "",
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(
        "Amount must be greater than zero.",
      );
    }

    const economy =
      await this.getOrCreate(discordId);

    if (economy.balance < amount) {
      throw new Error(
        "Insufficient balance.",
      );
    }

    const balanceBefore = economy.balance;

    economy.balance -= amount;
    economy.lifetimeSpent += amount;

    await economy.save();

    await Transaction.create({
      transactionId:
        createTransactionId(),
      discordId,
      type,
      amount,
      balanceBefore,
      balanceAfter: economy.balance,
      description,
    });

    return economy;
  },

  async transfer(
    fromDiscordId: string,
    toDiscordId: string,
    amount: number,
  ) {
    if (
      fromDiscordId === toDiscordId
    ) {
      throw new Error(
        "Cannot transfer to yourself.",
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        "Amount must be greater than zero.",
      );
    }

    const sender =
      await this.getOrCreate(
        fromDiscordId,
      );

    const receiver =
      await this.getOrCreate(
        toDiscordId,
      );

    if (sender.balance < amount) {
      throw new Error(
        "Insufficient balance.",
      );
    }

    const senderBefore =
      sender.balance;

    const receiverBefore =
      receiver.balance;

    sender.balance -= amount;
    sender.lifetimeSpent += amount;

    receiver.balance += amount;
    receiver.lifetimeEarned += amount;

    await sender.save();
    await receiver.save();

    await Transaction.create([
      {
        transactionId:
          createTransactionId(),
        discordId: fromDiscordId,
        type: "transfer",
        amount,
        balanceBefore: senderBefore,
        balanceAfter: sender.balance,
        description: `Transfer to ${toDiscordId}`,
        metadata: {
          recipientId: toDiscordId,
        },
      },
      {
        transactionId:
          createTransactionId(),
        discordId: toDiscordId,
        type: "transfer",
        amount,
        balanceBefore: receiverBefore,
        balanceAfter: receiver.balance,
        description: `Transfer from ${fromDiscordId}`,
        metadata: {
          senderId: fromDiscordId,
        },
      },
    ]);

    return {
      sender,
      receiver,
    };
  },
};
