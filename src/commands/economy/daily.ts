import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import {
  economyService,
} from "../../services/economyService.js";

const DAILY_REWARD = 500;

const DAY_MS = 24 * 60 * 60 * 1000;

export const data = new SlashCommandBuilder()
  .setName("daily")
  .setDescription(
    "Claim your daily NEXO reward.",
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const economy =
    await economyService.getOrCreate(
      interaction.user.id,
    );

  const now = Date.now();

  if (economy.lastDailyAt) {
    const elapsed =
      now -
      economy.lastDailyAt.getTime();

    if (elapsed < DAY_MS) {
      const remaining =
        DAY_MS - elapsed;

      const hours = Math.floor(
        remaining / (60 * 60 * 1000),
      );

      const minutes = Math.floor(
        (remaining %
          (60 * 60 * 1000)) /
          (60 * 1000),
      );

      await interaction.reply({
        content:
          `⏰ คุณรับ Daily ไปแล้ว!\nกลับมาใหม่ใน **${hours} ชั่วโมง ${minutes} นาที**`,
        ephemeral: true,
      });

      return;
    }
  }

  const balanceBefore =
    economy.balance;

  economy.balance += DAILY_REWARD;
  economy.lifetimeEarned +=
    DAILY_REWARD;

  economy.lastDailyAt = new Date();

  await economy.save();

  const { Transaction } =
    await import(
      "../../models/Transaction.js"
    );

  await Transaction.create({
    transactionId: `DAILY-${Date.now()}-${interaction.user.id}`,
    discordId: interaction.user.id,
    type: "reward",
    amount: DAILY_REWARD,
    balanceBefore,
    balanceAfter: economy.balance,
    description: "Daily reward",
  });

  const embed =
    new EmbedBuilder()
      .setTitle("🎁 Daily Reward")
      .setDescription(
        `ยินดีด้วย! คุณได้รับ **${DAILY_REWARD.toLocaleString()} NEXO** 🎉`,
      )
      .addFields({
        name: "💰 ยอดเงินปัจจุบัน",
        value:
          `**${economy.balance.toLocaleString()} NEXO**`,
      })
      .setThumbnail(
        interaction.user.displayAvatarURL(),
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}
