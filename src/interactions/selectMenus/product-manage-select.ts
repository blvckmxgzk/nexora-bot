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
  "nexora_product_manage_select";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const productId =
    interaction.values[0];

  const shop =
    await Shop.findOne({
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

  const product =
    await Product.findOne({
      productId,
      shopId: shop.shopId,
      ownerId: interaction.user.id,
    });

  if (!product) {
    await interaction.update({
      content:
        "❌ ไม่พบสินค้านี้ หรือสินค้านี้ไม่ใช่ของคุณ",
      embeds: [],
      components: [],
    });
    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(
        product.active
          ? 0x57f287
          : 0xed4245,
      )
      .setTitle(
        `📦 ${product.name}`,
      )
      .setDescription(
        product.description ||
          "ไม่มีรายละเอียดสินค้า",
      )
      .addFields(
        {
          name: "💰 ราคา",
          value:
            `฿${product.price.toLocaleString("th-TH")}`,
          inline: true,
        },
        {
          name: "📦 Stock",
          value:
            product.stock.toLocaleString("th-TH"),
          inline: true,
        },
        {
          name: "🛒 ขายแล้ว",
          value:
            product.sold.toLocaleString("th-TH"),
          inline: true,
        },
        {
          name: "📊 สถานะ",
          value:
            product.active
              ? "🟢 เปิดขาย"
              : "🔴 ปิดขาย",
          inline: true,
        },
        {
          name: "🏷️ หมวดหมู่",
          value:
            `\`${product.category}\``,
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
          "NEXORA Marketplace • Product Management",
      })
      .setTimestamp();

  const row1 =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `nexora_product_edit:${product.productId}`,
          )
          .setLabel("แก้ไข")
          .setEmoji("✏️")
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `nexora_product_stock:${product.productId}`,
          )
          .setLabel("จัดการ Stock")
          .setEmoji("📦")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  const row2 =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `nexora_product_toggle:${product.productId}`,
          )
          .setLabel(
            product.active
              ? "ปิดการขาย"
              : "เปิดการขาย",
          )
          .setEmoji(
            product.active
              ? "🔴"
              : "🟢",
          )
          .setStyle(
            product.active
              ? ButtonStyle.Danger
              : ButtonStyle.Success,
          ),

        new ButtonBuilder()
          .setCustomId(
            `nexora_product_delete:${product.productId}`,
          )
          .setLabel("ลบสินค้า")
          .setEmoji("🗑️")
          .setStyle(
            ButtonStyle.Danger,
          ),
      );

  const row3 =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_product_manage",
          )
          .setLabel("กลับรายการสินค้า")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [
      row1,
      row2,
      row3,
    ],
  });
}
