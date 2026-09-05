import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_toggle:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const productId =
    interaction.customId.split(":")[1];

  if (!productId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Product ID",
      ephemeral: true,
    });
    return;
  }

  const product =
    await Product.findOne({
      productId,
      ownerId: interaction.user.id,
    });

  if (!product) {
    await interaction.reply({
      content:
        "❌ ไม่พบสินค้านี้ หรือสินค้านี้ไม่ใช่ของคุณ",
      ephemeral: true,
    });
    return;
  }

  product.active =
    !product.active;

  await product.save();

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(
          product.active
            ? 0x22c55e
            : 0xef4444,
        )
        .setTitle(
          product.active
            ? "🟢 เปิดขายสินค้าแล้ว"
            : "🔴 ปิดการขายสินค้าแล้ว",
        )
        .setDescription(
          `สินค้า **${product.name}** ${
            product.active
              ? "กลับมาเปิดขาย"
              : "ถูกปิดการขาย"
          } เรียบร้อยแล้ว`,
        )
        .addFields({
          name: "🆔 Product ID",
          value:
            `\`${product.productId}\``,
        }),
    ],
    ephemeral: true,
  });
}
