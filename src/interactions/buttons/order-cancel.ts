import {
  type ButtonInteraction,
} from "discord.js";

import { orderService } from "../../services/orderService.js";

export const customId =
  "nexora_order_cancel:";

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
        "❌ คุณไม่มีสิทธิ์ยกเลิกคำสั่งซื้อนี้",
      ephemeral: true,
    });
    return;
  }

  if (
    order.status !==
      "pending" &&
    order.status !==
      "awaiting_payment"
  ) {
    await interaction.reply({
      content:
        "❌ คำสั่งซื้อนี้ไม่สามารถยกเลิกได้แล้ว",
      ephemeral: true,
    });
    return;
  }

  const cancelled =
    await orderService.cancelOrder(
      orderId,
      "ยกเลิกโดยผู้ซื้อ",
    );

  await interaction.update({
    content:
      `✅ ยกเลิกคำสั่งซื้อ \`${cancelled.orderId}\` แล้ว\n🔓 Stock ถูกคืนให้ร้านค้าเรียบร้อย`,
    embeds: [],
    components: [],
  });
}
