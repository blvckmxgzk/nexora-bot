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

export const data =
  new SlashCommandBuilder()
    .setName(
      "balance",
    )
    .setDescription(
      "ดูยอด NEXO ของคุณ",
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const balance =
    await economyService
      .getBalance(
        interaction.user.id,
      );

  const embed =
    new EmbedBuilder()
      .setTitle(
        "💰 NEXO Wallet",
      )
      .setDescription(
        `คุณมี **${toSuffix(balance)} NEXO**`,
      )
      .setThumbnail(
        interaction.user
          .displayAvatarURL(),
      )
      .setFooter({
        text:
          "NEXORA • NEXO Economy",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [
      embed,
    ],
  });
}
