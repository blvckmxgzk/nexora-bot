import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { productService } from "../../services/productService.js";
import { productDraftService } from "../../services/productDraftService.js";

const categoryNames: Record<string, string> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services: "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

export const customId =
  "nexora_product_confirm";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  const draft =
    productDraftService.get(
      interaction.user.id,
    );

  if (!draft || !draft.category) {
    await interaction.editReply({
      content:
        "❌ ข้อมูลสินค้าไม่ครบหรือหมดอายุแล้ว\n\n" +
        "กรุณากด **➕ เพิ่มสินค้า** ใหม่อีกครั้ง",
      embeds: [],
      components: [],
    });
    return;
  }

  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    productDraftService.delete(
      interaction.user.id,
    );

    await interaction.editReply({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      embeds: [],
      components: [],
    });
    return;
  }

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    productDraftService.delete(
      interaction.user.id,
    );

    await interaction.editReply({
      content:
        shop.status === "closed"
          ? "🔒 ร้านค้าของคุณปิดอยู่"
          : "🚫 ร้านค้าของคุณถูกระงับ",
      embeds: [],
      components: [],
    });
    return;
  }

  try {
    const product =
      await productService.createProduct({
        shopId: shop.shopId,
        ownerId: interaction.user.id,
        name: draft.name,
        description: draft.description,
        price: draft.price,
        category: draft.category,
        stock: draft.stock,
      });

    productDraftService.delete(
      interaction.user.id,
    );

    const embed =
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("✅ เพิ่มสินค้าสำเร็จ")
        .setDescription(
          `สินค้า **${product.name}** ถูกเพิ่มเข้าร้านเรียบร้อยแล้ว 🎉`,
        )
        .addFields(
          {
            name: "🆔 Product ID",
            value: `\`${product.productId}\``,
            inline: true,
          },
          {
            name: "💰 ราคา",
            value:
              `฿${product.price.toLocaleString("th-TH")}`,
            inline: true,
          },
          {
            name: "📊 Stock",
            value:
              product.stock.toLocaleString("th-TH"),
            inline: true,
          },
          {
            name: "📂 หมวดหมู่",
            value:
              categoryNames[product.category] ??
              product.category,
            inline: true,
          },
          {
            name: "🟢 สถานะ",
            value: product.active
              ? "กำลังขาย"
              : "ปิดการขาย",
            inline: true,
          },
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Product Management",
        })
        .setTimestamp();

    await interaction.editReply({
      content: "",
      embeds: [embed],
      components: [],
    });
  } catch (error) {
    console.error(
      "❌ Failed to create product:",
      error,
    );

    await interaction.editReply({
      content:
        "❌ ไม่สามารถสร้างสินค้าได้\n" +
        "กรุณาลองใหม่อีกครั้ง",
      embeds: [],
      components: [],
    });
  }
}
