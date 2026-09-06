import {
  type ButtonInteraction,
} from "discord.js";

import {
  orderService,
} from "../../services/orderService.js";

export const customId =
  "nexora_order_complete:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const orderId =
    interaction.customId.split(":")[1];

  if (!orderId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Order ID",
      ephemeral: true,
    });
    return;
  }

  const order =
    await orderService.getByOrderId(
      orderId,
    );

  if (!order) {
    await interaction.reply({
      content:
        "❌ ไม่พบคำสั่งซื้อ",
      ephemeral: true,
    });
    return;
  }

  if (
    order.buyerId !==
    interaction.user.id
  ) {
    await interaction.reply({
      content:
        "❌ คุณไม่มีสิทธิ์ยืนยันคำสั่งซื้อนี้",
      ephemeral: true,
    });
    return;
  }

  if (
    order.status !==
      "paid" &&
    order.status !==
      "processing"
  ) {
    if (
      order.status ===
      "completed"
    ) {
      await interaction.reply({
        content:
          "ℹ️ คำสั่งซื้อนี้ถูกยืนยันสำเร็จไปแล้ว",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content:
        "❌ คำสั่งซื้อนี้ไม่สามารถยืนยันได้ในขณะนี้",
      ephemeral: true,
    });
    return;
  }

  try {
    const completed =
      await orderService.markCompleted(
        orderId,
      );

    await interaction.update({
      content:
        [
          "🟢 **ยืนยันการรับสินค้าเรียบร้อยแล้ว**",
          "",
          `📦 Order ID: \`${completed.orderId}\``,
          `สินค้า: **${completed.productName}**`,
          "",
          "ขอบคุณที่ใช้ NEXORA Marketplace ❤️",
        ].join("\n"),
      embeds: [],
      components: [],
    });
  } catch (error) {
    console.error(
      "❌ Failed to complete order:",
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถยืนยันคำสั่งซื้อได้",
      ephemeral: true,
    });
  }
}
