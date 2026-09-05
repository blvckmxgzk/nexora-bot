import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_manage";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ คุณยังไม่มีร้านค้า",
      ephemeral: true,
    });
    return;
  }

  const products = await Product.find({
    shopId: shop.shopId,
  }).sort({
    createdAt: -1,
  });

  const activeCount = products.filter(
    (product) => product.active,
  ).length;

  const inStockCount = products.filter(
    (product) =>
      product.active &&
      product.stock > 0,
  ).length;

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("📦 จัดการสินค้า")
      .setDescription(
        [
          `🏪 ร้าน: **${shop.name}**`,
          "",
          "จัดการสินค้าทั้งหมดของร้านคุณได้จากเมนูด้านล่าง",
          "",
          "➕ **เพิ่มสินค้า**",
          "└─ สร้างสินค้าใหม่สำหรับร้านของคุณ",
          "",
          "📋 **รายการสินค้า**",
          "└─ ดู แก้ไข ลบ และเปิด/ปิดสินค้า",
        ].join("\n"),
      )
      .addFields(
        {
          name: "📦 สินค้าทั้งหมด",
          value: String(products.length),
          inline: true,
        },
        {
          name: "🟢 เปิดขาย",
          value: String(activeCount),
          inline: true,
        },
        {
          name: "📈 มีสินค้า",
          value: String(inStockCount),
          inline: true,
        },
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Product Management",
      })
      .setTimestamp();

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_product_create",
          )
          .setLabel("เพิ่มสินค้า")
          .setEmoji("➕")
          .setStyle(
            ButtonStyle.Success,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_product_list",
          )
          .setLabel("รายการสินค้า")
          .setEmoji("📋")
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_manage",
          )
          .setLabel("กลับ")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
