import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

export const customId = "nexora_shop_open";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal =
    new ModalBuilder()
      .setCustomId("nexora_shop_create_modal")
      .setTitle("🏪 เปิดร้านค้า NEXORA");

  const nameInput =
    new TextInputBuilder()
      .setCustomId("shop_name")
      .setLabel("ชื่อร้าน")
      .setPlaceholder("เช่น Blvck Gaming")
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(100)
      .setRequired(true);

  const descriptionInput =
    new TextInputBuilder()
      .setCustomId("shop_description")
      .setLabel("คำอธิบายร้าน")
      .setPlaceholder("อธิบายว่าร้านของคุณขายอะไร...")
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(5)
      .setMaxLength(1000)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(nameInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(descriptionInput),
  );

  await interaction.showModal(modal);
}
