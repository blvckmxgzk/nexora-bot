import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

export const customId =
  "nexora_marketplace_search";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal =
    new ModalBuilder()
      .setCustomId(
        "nexora_marketplace_search_modal",
      )
      .setTitle("🔎 ค้นหา Marketplace");

  const query =
    new TextInputBuilder()
      .setCustomId("query")
      .setLabel("คำค้นหา")
      .setPlaceholder(
        "ชื่อร้าน ชื่อสินค้า หรือรายละเอียด",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(100)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(query),
  );

  await interaction.showModal(modal);
}
