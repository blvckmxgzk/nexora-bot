import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

export const customId =
  "nexora_product_delete:";

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

  if (
    product.sold > 0
  ) {
    const confirmRow =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_product_delete_confirm:${product.productId}`,
            )
            .setLabel("ยืนยันลบสินค้า")
            .setEmoji("🗑️")
            .setStyle(
              ButtonStyle.Danger,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_product_manage`,
            )
            .setLabel("ยกเลิก")
            .setEmoji("↩️")
            .setStyle(
              ButtonStyle.Secondary,
            ),
        );

    await interaction.update({
      content: "",
      embeds: [
        new EmbedBuilder()
          .setColor(0xfee75c)
          .setTitle(
            "⚠️ ยืนยันการลบสินค้า",
          )
          .setDescription(
            [
              `คุณกำลังจะลบ **${product.name}**`,
              "",
              `🛒 สินค้านี้ขายไปแล้ว **${product.sold.toLocaleString("th-TH")} รายการ**`,
              "",
              "ระบบจะใช้ **Soft Delete** เพื่อรักษาประวัติคำสั่งซื้อ",
              "สินค้าเดิมจะไม่สามารถซื้อได้อีก",
              "",
              "กด **ยืนยันลบสินค้า** หากต้องการดำเนินการต่อ",
            ].join("\n"),
          ),
      ],
      components: [
        confirmRow,
      ],
    });

    return;
  }

  product.active = false;
  product.stock = 0;

  await product.save();

  await interaction.update({
    content:
      "🗑️ ลบสินค้าออกจาก Marketplace แล้ว",
    embeds: [],
    components: [],
  });
}
