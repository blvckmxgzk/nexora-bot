import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";

export const customId =
  "nexora_marketplace_shop_products:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shopId =
    interaction.customId.split(":")[1];

  if (!shopId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Shop ID",
      ephemeral: true,
    });
    return;
  }

  const shop =
    await Shop.findOne({
      shopId,
      status: "verified",
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ร้านค้านี้ไม่ได้เปิดให้บริการในขณะนี้",
      ephemeral: true,
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

  if (products.length === 0) {
    await interaction.reply({
      content:
        `📦 ร้าน **${shop.name}** ยังไม่มีสินค้าที่พร้อมจำหน่าย`,
      ephemeral: true,
    });
    return;
  }

  const menu =
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
    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(
          product.name.slice(0, 100),
        )
        .setDescription(
          `฿${product.price.toLocaleString("th-TH")} • Stock ${product.stock}`,
        )
        .setValue(
          product.productId,
        )
        .setEmoji("📦"),
    );
  }

  const productLines =
    products.map(
      (product) =>
        [
          `📦 **${product.name}**`,
          `> 💰 ฿${product.price.toLocaleString("th-TH")} • 📊 Stock: ${product.stock.toLocaleString("th-TH")}`,
          `> 🛒 ขายแล้ว: ${product.sold.toLocaleString("th-TH")}`,
        ].join("\n"),
    );

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        `📦 สินค้าของ ${shop.name}`,
      )
      .setDescription(
        [
          "เลือกสินค้าที่ต้องการดูรายละเอียด",
          "",
          productLines.join("\n\n"),
        ].join("\n"),
      )
      .setFooter({
        text:
          `NEXORA Marketplace • ${shop.shopId}`,
      })
      .setTimestamp();

  const menuRow =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(menu);

  const backRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_browse",
          )
          .setLabel("Marketplace")
          .setEmoji("🛍️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.reply({
    embeds: [embed],
    components: [
      menuRow,
      backRow,
    ],
    ephemeral: true,
  });
}
