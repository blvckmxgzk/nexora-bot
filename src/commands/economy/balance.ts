import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { economyService } from "../../services/economyService.js";

export const data = new SlashCommandBuilder()
  .setName("balance")
  .setDescription(
    "Check your NEXORA balance.",
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const balance =
    await economyService.getBalance(
      interaction.user.id,
    );

  const embed =
    new EmbedBuilder()
      .setTitle("💰 NEXORA Wallet")
      .setDescription(
        `ยอดเงินของคุณคือ **${balance.toLocaleString()} NEXO**`,
      )
      .setThumbnail(
        interaction.user.displayAvatarURL(),
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}
