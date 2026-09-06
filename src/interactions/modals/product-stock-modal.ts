import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

export const customId =
  "nexora_product_stock_modal:";

export async function execute(
  interaction: ModalSubmitInteraction,
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

  const stockText =
    interaction.fields
      .getTextInputValue("stock")
      .trim();

  const stock =
    Number(stockText);

  if (
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    await interaction.reply({
      content:
        "❌ Stock ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป",
      ephemeral: true,
    });
    return;
  }

  const oldStock =
    product.stock;

  product.stock =
    stock;

  await product.save();

  const embed =
    new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(
        "📦 อัปเดต Stock สำเร็จ",
      )
      .setDescription(
        [
          `📦 **${product.name}**`,
          "",
          `ก่อนหน้า: **${oldStock.toLocaleString("th-TH")}**`,
          `ปัจจุบัน: **${product.stock.toLocaleString("th-TH")}**`,
          "",
          `🆔 Product ID: \`${product.productId}\``,
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
