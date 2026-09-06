import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

const categories = [
  "game_topup",
  "game_keys",
  "gift_cards",
  "digital_services",
  "other",
] as const;

export const customId =
  "nexora_product_edit_modal:";

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

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.reply({
      content:
        "❌ ร้านค้านี้ไม่สามารถแก้ไขสินค้าได้",
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

  const name =
    interaction.fields
      .getTextInputValue("name")
      .trim();

  const description =
    interaction.fields
      .getTextInputValue("description")
      .trim();

  const priceText =
    interaction.fields
      .getTextInputValue("price")
      .trim();

  const category =
    interaction.fields
      .getTextInputValue("category")
      .trim()
      .toLowerCase();

  const price =
    Number(priceText);

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
    !categories.includes(
      category as (typeof categories)[number],
    )
  ) {
    await interaction.reply({
      content:
        "❌ หมวดหมู่ไม่ถูกต้อง\n\n" +
        categories
          .map(
            (value) =>
              `• \`${value}\``,
          )
          .join("\n"),
      ephemeral: true,
    });
    return;
  }

  product.name = name;
  product.description =
    description;
  product.price = price;
  product.category =
    category as typeof product.category;

  await product.save();

  const embed =
    new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(
        "✅ แก้ไขสินค้าสำเร็จ",
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
