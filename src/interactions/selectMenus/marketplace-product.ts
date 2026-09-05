import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

export const customId =
  "nexora_marketplace_product";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const productId =
    interaction.values[0];

  const product =
    await Product.findOne({
      productId,
      active: true,
      stock: { $gt: 0 },
    });

  if (!product) {
    await interaction.update({
      content:
        "❌ สินค้านี้ไม่มีอยู่แล้ว หรือสินค้าหมด",
      embeds: [],
      components: [],
    });

    return;
  }

  const shop =
    await Shop.findOne({
      shopId: product.shopId,
      status: "verified",
    });

  if (!shop) {
    await interaction.update({
      content:
        "❌ ร้านค้านี้ไม่พร้อมให้บริการในขณะนี้",
      embeds: [],
      components: [],
    });

    return;
  }

  const rating =
    shop.reviewCount > 0
      ? `⭐ ${shop.rating.toFixed(1)} / 5 (${shop.reviewCount} รีวิว)`
      : "⭐ ยังไม่มีรีวิว";

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`📦 ${product.name}`)
      .setDescription(
        product.description ||
          "ไม่มีรายละเอียดสินค้า",
      )
      .addFields(
        {
          name: "🏪 ร้านค้า",
          value:
            `**${shop.name}**`,
          inline: true,
        },
        {
          name: "🛡️ ผู้ขาย",
          value:
            "🟢 Verified Seller",
          inline: true,
        },
        {
          name: "⭐ คะแนนร้าน",
          value: rating,
          inline: true,
        },
        {
          name: "💰 ราคา",
          value:
            `**฿${product.price.toLocaleString("th-TH")}**`,
          inline: true,
        },
        {
          name: "📦 Stock",
          value:
            product.stock.toLocaleString(
              "th-TH",
            ),
          inline: true,
        },
        {
          name: "🛒 ขายแล้ว",
          value:
            product.sold.toLocaleString(
              "th-TH",
            ),
          inline: true,
        },
        {
          name: "🆔 Product ID",
          value:
            `\`${product.productId}\``,
          inline: false,
        },
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Product Details",
      })
      .setTimestamp();

  const buyButton =
    new ButtonBuilder()
      .setCustomId(
        `nexora_product_buy:${product.productId}`,
      )
      .setLabel("ซื้อสินค้า")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Success);

  const backButton =
    new ButtonBuilder()
      .setCustomId(
        "nexora_shop_browse",
      )
      .setLabel("กลับ Marketplace")
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Secondary);

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        buyButton,
        backButton,
      );

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [row],
  });
}
