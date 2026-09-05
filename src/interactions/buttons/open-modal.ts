import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

export const customId = "nexora_open_modal";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const input =
    new TextInputBuilder()
      .setCustomId("nexora_test_input")
      .setLabel("ข้อความทดสอบ")
      .setPlaceholder("พิมพ์ข้อความอะไรก็ได้...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

  const row =
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(input);

  const modal =
    new ModalBuilder()
      .setCustomId("nexora_test_modal")
      .setTitle("NEXORA Test Modal")
      .addComponents(row);

  await interaction.showModal(modal);
}
