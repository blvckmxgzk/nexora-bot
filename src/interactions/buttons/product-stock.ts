import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

export const customId =
  "nexora_product_stock:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const productId =
    interaction.customId.split(":")[1];

  if (!productId) {
    await interaction.reply({
      content: "❌ Product ID ไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  const shop =
    await Shop.findOne({
      ownerId: interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content: "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });
    return;
  }

  const product =
    await Product.findOne({
      productId,
      shopId: shop.shopId,
      ownerId: interaction.user.id,
    });

  if (!product) {
    await interaction.reply({
      content:
        "❌ ไม่พบสินค้า หรือสินค้านี้ไม่ใช่ของคุณ",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_product_stock_modal:${product.productId}`,
      )
      .setTitle("📦 จัดการ Stock");

  const stock =
    new TextInputBuilder()
      .setCustomId("stock")
      .setStyle(TextInputStyle.Short)
      .setValue(
        String(product.stock),
      )
      .setPlaceholder(
        "ใส่จำนวน Stock ใหม่",
      )
      .setMaxLength(20)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(stock),
  );

  await interaction.showModal(modal);
}
