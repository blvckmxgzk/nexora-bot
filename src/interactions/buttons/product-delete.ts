import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_delete:";

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

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `nexora_product_delete_confirm:${product.productId}`,
          )
          .setLabel("ยืนยันการลบ")
          .setEmoji("🗑️")
          .setStyle(
            ButtonStyle.Danger,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_product_delete_cancel",
          )
          .setLabel("ยกเลิก")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.reply({
    content:
      `⚠️ **คุณกำลังจะลบสินค้า**\n\n` +
      `📦 สินค้า: **${product.name}**\n` +
      `🆔 Product ID: \`${product.productId}\`\n\n` +
      "**การลบสินค้าจะไม่สามารถย้อนกลับได้**",
    components: [row],
    ephemeral: true,
  });
}
