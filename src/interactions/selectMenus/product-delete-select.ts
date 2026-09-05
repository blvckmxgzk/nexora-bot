import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_delete_select";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const productId = interaction.values[0];

  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    await interaction.update({
      content: "❌ ไม่พบร้านค้าของคุณ",
      embeds: [],
      components: [],
    });
    return;
  }

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.update({
      content:
        shop.status === "closed"
          ? "🔒 ร้านค้าของคุณปิดอยู่"
          : "🚫 ร้านค้าของคุณถูกระงับ",
      embeds: [],
      components: [],
    });
    return;
  }

  const product = await Product.findOne({
    productId,
    shopId: shop.shopId,
    ownerId: interaction.user.id,
  });

  if (!product) {
    await interaction.update({
      content:
        "❌ ไม่พบสินค้านี้ หรือสินค้านี้ไม่ใช่สินค้าของคุณ",
      embeds: [],
      components: [],
    });
    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("⚠️ ยืนยันการลบสินค้า")
      .setDescription(
        [
          "คุณกำลังจะลบสินค้านี้อย่างถาวร",
          "",
          `📦 **${product.name}**`,
          "",
          "💰 ราคา: " +
            `฿${product.price.toLocaleString("th-TH")}`,
          "📊 Stock: " +
            product.stock.toLocaleString("th-TH"),
          "🛒 ขายแล้ว: " +
            product.sold.toLocaleString("th-TH"),
          "",
          "⚠️ **การกระทำนี้ไม่สามารถย้อนกลับได้**",
          "ข้อมูลสินค้าจะถูกลบออกจากระบบ",
        ].join("\n"),
      )
      .addFields({
        name: "🆔 Product ID",
        value: `\`${product.productId}\``,
        inline: false,
      })
      .setFooter({
        text:
          "NEXORA Marketplace • Permanent Product Deletion",
      })
      .setTimestamp();

  const confirm =
    new ButtonBuilder()
      .setCustomId(
        `nexora_product_delete_confirm:${product.productId}`,
      )
      .setLabel("ยืนยันลบสินค้า")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger);

  const cancel =
    new ButtonBuilder()
      .setCustomId(
        "nexora_product_delete_cancel",
      )
      .setLabel("ยกเลิก")
      .setEmoji("↩️")
      .setStyle(ButtonStyle.Secondary);

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirm, cancel),
    ],
  });
}
