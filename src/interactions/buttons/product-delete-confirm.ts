import {
  type ButtonInteraction,
} from "discord.js";

import { productService } from "../../services/productService.js";

export const customId =
  "nexora_product_delete_confirm:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const productId =
    interaction.customId.split(":")[1];

  if (!productId) {
    await interaction.update({
      content:
        "❌ ไม่พบ Product ID",
      components: [],
    });
    return;
  }

  const product =
    await productService.deleteProduct(
      productId,
      interaction.user.id,
    );

  if (!product) {
    await interaction.update({
      content:
        "❌ ไม่พบสินค้า หรือสินค้านี้ไม่ใช่ของคุณ",
      components: [],
    });
    return;
  }

  await interaction.update({
    content:
      `🗑️ **ลบสินค้าสำเร็จ**\n\n` +
      `📦 **${product.name}**\n` +
      `🆔 \`${product.productId}\``,
    components: [],
  });
}
