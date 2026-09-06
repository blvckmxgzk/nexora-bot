import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_manage";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId: interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content: "❌ คุณยังไม่มีร้านค้า",
      ephemeral: true,
    });
    return;
  }

  if (shop.status === "closed") {
    await interaction.reply({
      content:
        "🔒 ร้านค้าถูกปิดอยู่ ไม่สามารถจัดการสินค้าได้",
      ephemeral: true,
    });
    return;
  }

  const products =
    await Product.find({
      shopId: shop.shopId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(25);

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("📦 จัดการสินค้า")
      .setDescription(
        [
          `🏪 **${shop.name}**`,
          "",
          products.length
            ? "เลือกสินค้าที่ต้องการจัดการจากเมนูด้านล่าง"
            : "ยังไม่มีสินค้าในร้านของคุณ",
        ].join("\n"),
      )
      .addFields({
        name: "📊 สรุป",
        value: [
          `📦 สินค้าทั้งหมด: **${products.length}**`,
          `🟢 เปิดขาย: **${products.filter((p) => p.active).length}**`,
          `🔴 ปิดขาย: **${products.filter((p) => !p.active).length}**`,
        ].join("\n"),
        inline: false,
      })
      .setFooter({
        text:
          "NEXORA Marketplace • Product Management",
      })
      .setTimestamp();

  const components = [];

  if (products.length > 0) {
    const options =
      products.map((product) => ({
        label:
          product.name.slice(0, 100),
        description:
          `฿${product.price.toLocaleString("th-TH")} • Stock ${product.stock}`,
        value: product.productId,
        emoji:
          product.active
            ? "🟢"
            : "🔴",
      }));

    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          "nexora_product_manage_select",
        )
        .setPlaceholder(
          "📦 เลือกสินค้าที่ต้องการจัดการ",
        )
        .addOptions(options);

    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(menu),
    );
  }

  const actionRow =
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
            "nexora_shop_manage",
          )
          .setLabel("กลับร้านค้า")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  components.push(actionRow);

  await interaction.update({
    content: "",
    embeds: [embed],
    components,
  });
}
