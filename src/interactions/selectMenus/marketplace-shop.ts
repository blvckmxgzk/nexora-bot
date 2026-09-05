import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";

const categoryNames: Record<string, string> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services: "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

export const customId =
  "nexora_marketplace_shop";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const shopId = interaction.values[0];

  const shop = await Shop.findOne({
    shopId,
    status: "verified",
  });

  if (!shop) {
    await interaction.update({
      content:
        "❌ ไม่พบร้านค้านี้ หรือร้านค้าไม่ได้เปิดให้บริการ",
      embeds: [],
      components: [],
    });

    return;
  }

  const products =
    await Product.find({
      shopId: shop.shopId,
      active: true,
      stock: { $gt: 0 },
    })
      .sort({
        sold: -1,
        createdAt: -1,
      })
      .limit(25);

  const rating =
    shop.reviewCount > 0
      ? `⭐ ${shop.rating.toFixed(1)} / 5 (${shop.reviewCount} รีวิว)`
      : "⭐ ยังไม่มีรีวิว";

  const embed =
    new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle(`🏪 ${shop.name}`)
      .setDescription(
        [
          shop.description || "ไม่มีคำอธิบายร้าน",
          "",
          `🛡️ **Verified Seller**`,
          "ร้านค้านี้ผ่านการตรวจสอบจากทีมงาน NEXORA",
        ].join("\n"),
      )
      .addFields(
        {
          name: "📂 หมวดหมู่",
          value:
            categoryNames[shop.category] ??
            shop.category,
          inline: true,
        },
        {
          name: "⭐ คะแนน",
          value: rating,
          inline: true,
        },
        {
          name: "🛒 ออเดอร์สำเร็จ",
          value:
            shop.completedOrders.toLocaleString(
              "th-TH",
            ),
          inline: true,
        },
        {
          name: "📦 สินค้าที่พร้อมขาย",
          value: String(products.length),
          inline: true,
        },
      )
      .setFooter({
        text:
          `NEXORA Marketplace • ${shop.shopId}`,
      })
      .setTimestamp();

  if (products.length === 0) {
    embed.addFields({
      name: "📦 สินค้า",
      value:
        "ร้านค้านี้ยังไม่มีสินค้าที่พร้อมจำหน่าย",
      inline: false,
    });

    const backRow =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              "nexora_shop_browse",
            )
            .setLabel("กลับ Marketplace")
            .setEmoji("↩️")
            .setStyle(
              ButtonStyle.Secondary,
            ),
        );

    await interaction.update({
      content: "",
      embeds: [embed],
      components: [backRow],
    });

    return;
  }

  const productMenu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "nexora_marketplace_product",
      )
      .setPlaceholder(
        "📦 เลือกสินค้าที่ต้องการดู",
      )
      .setMinValues(1)
      .setMaxValues(1);

  for (const product of products) {
    productMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(
          product.name.slice(0, 100),
        )
        .setDescription(
          `฿${product.price.toLocaleString("th-TH")} • Stock ${product.stock} • ขายแล้ว ${product.sold}`,
        )
        .setValue(product.productId)
        .setEmoji("📦"),
    );
  }

  const productLines =
    products.map(
      (product) =>
        [
          `📦 **${product.name}**`,
          `> 💰 ฿${product.price.toLocaleString("th-TH")}`,
          `> 📊 Stock: ${product.stock.toLocaleString("th-TH")} • 🛒 ขายแล้ว: ${product.sold.toLocaleString("th-TH")}`,
        ].join("\n"),
    );

  embed.addFields({
    name: "📦 สินค้าของร้าน",
    value: productLines.join("\n\n"),
    inline: false,
  });

  const menuRow =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(productMenu);

  const backRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_browse",
          )
          .setLabel("กลับ Marketplace")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [menuRow, backRow],
  });
}
