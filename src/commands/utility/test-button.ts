import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("test-button")
  .setDescription(
    "Test NEXORA interaction system.",
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const button =
    new ButtonBuilder()
      .setCustomId(
        "nexora_test_button",
      )
      .setLabel("กดเพื่อทดสอบ")
      .setEmoji("🚀")
      .setStyle(ButtonStyle.Primary);

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(button);

  await interaction.reply({
    content:
      "กดปุ่มด้านล่างเพื่อทดสอบ Interaction System",
    components: [row],
  });
}