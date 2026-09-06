import {
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

export const customId =
  "nexora_product_delete_confirm:";

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
    await interaction.update({
      content:
        "❌ ไม่พบสินค้า หรือสินค้านี้ไม่ใช่ของคุณ",
      embeds: [],
      components: [],
    });
    return;
  }

  product.active = false;
  product.stock = 0;

  await product.save();

  await interaction.update({
    content:
      `🗑️ ลบสินค้า **${product.name}** ออกจาก Marketplace แล้ว`,
    embeds: [],
    components: [],
  });
}
