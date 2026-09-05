import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";

export const customId = "nexora_shop_edit";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    await interaction.reply({
      content: "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });
    return;
  }

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.reply({
      content:
        shop.status === "closed"
          ? "🔒 ร้านค้าของคุณปิดอยู่ กรุณาเปิดร้านก่อนแก้ไขข้อมูล"
          : "🚫 ร้านค้าของคุณถูกระงับ ไม่สามารถแก้ไขข้อมูลได้",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId("nexora_shop_edit_modal")
      .setTitle("✏️ แก้ไขข้อมูลร้าน");

  const nameInput =
    new TextInputBuilder()
      .setCustomId("shop_name")
      .setLabel("ชื่อร้าน")
      .setValue(shop.name)
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(100)
      .setRequired(true);

  const descriptionInput =
    new TextInputBuilder()
      .setCustomId("shop_description")
      .setLabel("คำอธิบายร้าน")
      .setValue(shop.description)
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(5)
      .setMaxLength(1000)
      .setRequired(true);

  const categoryInput =
    new TextInputBuilder()
      .setCustomId("shop_category")
      .setLabel("หมวดหมู่")
      .setPlaceholder(
        "game_topup / game_keys / gift_cards / digital_services / other",
      )
      .setValue(shop.category)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(nameInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(descriptionInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(categoryInput),
  );

  await interaction.showModal(modal);
}
