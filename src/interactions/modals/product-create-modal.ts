import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { randomUUID } from "node:crypto";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_create_modal";

const DEFAULT_CATEGORY =
  "other";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId: interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
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
          ? "🔒 ร้านค้าของคุณปิดอยู่ กรุณาเปิดร้านอีกครั้งก่อนเพิ่มสินค้า"
          : "🚫 ร้านค้าของคุณถูกระงับ ไม่สามารถจัดการสินค้าได้",
      ephemeral: true,
    });

    return;
  }

  const name =
    interaction.fields
      .getTextInputValue(
        "product_name",
      )
      .trim();

  const description =
    interaction.fields
      .getTextInputValue(
        "product_description",
      )
      .trim();

  const priceText =
    interaction.fields
      .getTextInputValue(
        "product_price",
      )
      .trim();

  const stockText =
    interaction.fields
      .getTextInputValue(
        "product_stock",
      )
      .trim();

  const price =
    Number(priceText);

  const stock =
    Number(stockText);

  if (
    !name ||
    name.length > 100
  ) {
    await interaction.reply({
      content:
        "❌ ชื่อสินค้าต้องมีความยาว 1-100 ตัวอักษร",
      ephemeral: true,
    });

    return;
  }

  if (
    !description ||
    description.length > 1000
  ) {
    await interaction.reply({
      content:
        "❌ รายละเอียดสินค้าต้องมีความยาว 1-1000 ตัวอักษร",
      ephemeral: true,
    });

    return;
  }

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    await interaction.reply({
      content:
        "❌ ราคาสินค้าไม่ถูกต้อง",
      ephemeral: true,
    });

    return;
  }

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

  const product =
    await Product.create({
      productId:
        `PRD-${Date.now()}-${randomUUID()
          .slice(0, 6)
          .toUpperCase()}`,

      shopId:
        shop.shopId,

      ownerId:
        shop.ownerId,

      name,

      description,

      price,

      category:
        DEFAULT_CATEGORY,

      stock,

      sold: 0,

      active: true,
    });

  const embed =
    new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(
        "✅ เพิ่มสินค้าสำเร็จ",
      )
      .setDescription(
        [
          `📦 **${product.name}**`,
          "",
          `💰 ราคา: **฿${product.price.toLocaleString("th-TH")}**`,
          `📦 Stock: **${product.stock.toLocaleString("th-TH")}**`,
          `🏷️ หมวดหมู่: \`${product.category}\``,
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
