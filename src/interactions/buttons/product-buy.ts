import {
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  marketplaceV2Service,
} from "../../services/marketplace/marketplaceV2Service.js";

export const customId =
  "nexora_product_buy:";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  try {
    const productId =
      interaction.customId
        .split(
          ":",
        )[1];

    if (!productId) {
      throw new Error(
        "Product ID ไม่ถูกต้อง",
      );
    }

    const request =
      await marketplaceV2Service
        .createTradeRequest(
          interaction.client,
          interaction.user.id,
          productId,
        );

    await interaction.editReply({
      content: [
        "✅ **ส่งคำขอติดต่อเจ้าของร้านแล้ว**",
        "",
        `📦 **สินค้า:** ${request.productName}`,
        `🔖 **Trade ID:** \`${request.requestId}\``,
        "",
        "Seller ได้รับ DM จาก NEXORA แล้ว",
        "เมื่อ Seller กด **ติดต่อแล้ว** คุณจะได้รับ DM พร้อมข้อมูลติดต่อ",
        "",
        "ℹ️ NEXORA ไม่รับ ถือ หรือประมวลผลเงินจริง",
      ].join(
        "\n",
      ),
    });
  } catch (
    error
  ) {
    await interaction.editReply({
      content:
        `❌ ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
