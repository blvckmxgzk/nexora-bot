import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";

export const customId = "nexora_product_add";

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

  // Verified Seller เป็นเพียงสถานะสร้างความน่าเชื่อถือ
  // ไม่ได้เป็นเงื่อนไขสำหรับการเพิ่มสินค้า
  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.reply({
      content:
        shop.status === "closed"
          ? "🔒 ร้านค้าของคุณปิดอยู่ กรุณาเปิดร้านอีกครั้งก่อนเพิ่มสินค้า"
          : "🚫 ร้านค้าของคุณถูกระงับ ไม่สามารถจัดการสินค้าได้",
      ephemeral: true,
    });

    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("nexora_product_create_modal")
    .setTitle("➕ เพิ่มสินค้า");

  const nameInput = new TextInputBuilder()
    .setCustomId("product_name")
    .setLabel("ชื่อสินค้า")
    .setPlaceholder("เช่น Roblox Robux 400")
    .setStyle(TextInputStyle.Short)
    .setMinLength(2)
    .setMaxLength(100)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId("product_description")
    .setLabel("รายละเอียดสินค้า")
    .setPlaceholder("อธิบายรายละเอียดสินค้า...")
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(2)
    .setMaxLength(1000)
    .setRequired(true);

  const priceInput = new TextInputBuilder()
    .setCustomId("product_price")
    .setLabel("ราคา (บาท)")
    .setPlaceholder("129")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const stockInput = new TextInputBuilder()
    .setCustomId("product_stock")
    .setLabel("จำนวนสินค้า")
    .setPlaceholder("10")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(nameInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(descriptionInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(priceInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(stockInput),
  );

  await interaction.showModal(modal);
}
