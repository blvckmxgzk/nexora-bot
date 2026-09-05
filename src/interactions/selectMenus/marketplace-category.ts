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
  "nexora_marketplace_category";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const category = interaction.values[0];

  const shops = await Shop.find({
    category,
    status: "verified",
  })
    .sort({
      rating: -1,
      completedOrders: -1,
      createdAt: -1,
    })
    .limit(25);

  if (shops.length === 0) {
    const embed =
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("🏪 ไม่พบร้านค้า")
        .setDescription(
          [
            `📂 หมวดหมู่: **${categoryNames[category] ?? category}**`,
            "",
            "ยังไม่มีร้านค้าที่ผ่านการตรวจสอบในหมวดหมู่นี้",
            "",
            "ลองเลือกหมวดหมู่อื่นได้เลย",
          ].join("\n"),
        )
        .setFooter({
          text:
            "NEXORA Marketplace • No Shops Found",
        })
        .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [],
    });

    return;
  }

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "nexora_marketplace_shop",
      )
      .setPlaceholder(
        "🏪 เลือกร้านค้าที่ต้องการดู",
      )
      .setMinValues(1)
      .setMaxValues(1);

  for (const shop of shops) {
    const rating =
      shop.reviewCount > 0
        ? `⭐ ${shop.rating.toFixed(1)}`
        : "⭐ ยังไม่มีรีวิว";

    menu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(
          shop.name.slice(0, 100),
        )
        .setDescription(
          `${rating} • ${shop.completedOrders} ออเดอร์สำเร็จ`,
        )
        .setValue(shop.shopId)
        .setEmoji("🏪"),
    );
  }

  const shopLines =
    await Promise.all(
      shops.map(async (shop, index) => {
        const productCount =
          await Product.countDocuments({
            shopId: shop.shopId,
            active: true,
          });

        return [
          `**${index + 1}. 🟢 ${shop.name}**`,
          `> ⭐ ${
            shop.reviewCount > 0
              ? shop.rating.toFixed(1)
              : "ยังไม่มีรีวิว"
          } / 5 • 📦 ${productCount} สินค้า`,
          `> 🛒 ออเดอร์สำเร็จ: ${shop.completedOrders}`,
        ].join("\n");
      }),
    );

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🏪 ร้านค้าใน Marketplace")
      .setDescription(
        [
          `📂 หมวดหมู่: **${categoryNames[category] ?? category}**`,
          "",
          shopLines.join("\n\n"),
          "",
          "เลือกซื้อร้านค้าที่ต้องการจากเมนูด้านล่าง",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Verified Shops",
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
          .setLabel("เปลี่ยนหมวดหมู่")
          .setEmoji("📂")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.update({
    embeds: [embed],
    components: [menuRow, backRow],
  });
}
