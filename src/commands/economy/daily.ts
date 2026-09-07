import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import {
  economyService,
} from "../../services/economyService.js";

import {
  toSuffix,
} from "../../services/nexo/NexoNumber.js";

const DAILY_REWARD =
  "500";

export const data =
  new SlashCommandBuilder()
    .setName(
      "daily",
    )
    .setDescription(
      "รับ Daily NEXO",
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const result =
    await economyService
      .claimDaily(
        interaction.user.id,
        DAILY_REWARD,
      );

  if (
    !result.claimed
  ) {
    const hours =
      Math.floor(
        result.remainingMs /
        3_600_000,
      );

    const minutes =
      Math.floor(
        (
          result.remainingMs %
          3_600_000
        ) /
        60_000,
      );

    await interaction.reply({
      content:
        `⏰ คุณรับ Daily ไปแล้ว\nกลับมาใหม่ใน **${hours} ชั่วโมง ${minutes} นาที**`,

      ephemeral:
        true,
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        "🎁 Daily NEXO",
      )
      .setDescription(
        `ได้รับ **${toSuffix(result.reward)} NEXO**`,
      )
      .addFields({
        name:
          "💰 Wallet",

        value:
          `**${toSuffix(result.balance)} NEXO**`,
      })
      .setThumbnail(
        interaction.user
          .displayAvatarURL(),
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [
      embed,
    ],
  });
}
