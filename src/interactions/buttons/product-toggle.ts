import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

import {
  syncShopForumSafe,
} from "../../services/shopForumService.js";

export const customId =
  "nexora_product_toggle:";

export async function execute(
  interaction: ButtonInteraction,
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
        "❌ ร้านค้านี้ไม่สามารถเปลี่ยนสถานะสินค้าได้",
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

  product.active =
    !product.active;

  await product.save();

  await syncShopForumSafe(
    interaction.client,
    shop.shopId,
    "product_toggled",
  );

  const statusText =
    product.active
      ? "🟢 เปิดขาย"
      : "🔴 ปิดขาย";

  const embed =
    new EmbedBuilder()
      .setColor(
        product.active
          ? 0x57f287
          : 0xed4245,
      )
      .setTitle(
        product.active
          ? "🟢 เปิดขายสินค้าแล้ว"
          : "🔴 ปิดการขายสินค้าแล้ว",
      )
      .setDescription(
        [
          `📦 **${product.name}**`,
          "",
          `สถานะใหม่: **${statusText}**`,
          "",
          `🆔 Product ID: \`${product.productId}\``,
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace",
      })
      .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [],
    content: "",
  });
}
