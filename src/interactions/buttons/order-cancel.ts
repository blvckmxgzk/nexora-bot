import {
  type ButtonInteraction,
} from "discord.js";

import {
  orderService,
} from "../../services/orderService.js";

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
    order.status ===
    "awaiting_payment"
  ) {
    const expiresAt =
      order.paymentExpiresAt
        ? new Date(
            order.paymentExpiresAt,
          )
        : null;

    const expiresText =
      expiresAt &&
      Number.isFinite(
        expiresAt.getTime(),
      )
        ? `\n⏰ Payment หมดอายุประมาณ <t:${Math.floor(
            expiresAt.getTime() /
              1000,
          )}:R>`
        : "";

    await interaction.reply({
      content:
        "⚠️ ไม่สามารถยกเลิก Order หลังจากสร้าง Payment แล้วได้\n" +
        "ระบบต้องรอให้ Payment Provider ยืนยันว่ารายการหมดอายุก่อนจึงจะคืน Stock" +
        expiresText,
      ephemeral: true,
    });

    return;
  }

  if (
    order.status !==
    "pending"
  ) {
    await interaction.reply({
      content:
        "❌ คำสั่งซื้อนี้ไม่สามารถยกเลิกได้แล้ว",
      ephemeral: true,
    });

    return;
  }

  try {
    const cancelled =
      await orderService.cancelOrder(
        orderId,
        "ยกเลิกโดยผู้ซื้อก่อนสร้าง Payment",
      );

    await interaction.update({
      content:
        `✅ ยกเลิกคำสั่งซื้อ \`${cancelled.orderId}\` แล้ว\n🔓 Stock ถูกคืนให้ร้านค้าเรียบร้อย`,
      embeds: [],
      components: [],
    });
  } catch (error) {
    console.error(
      `❌ Failed to cancel Order ${orderId}:`,
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถยกเลิกคำสั่งซื้อได้",
      ephemeral: true,
    });
  }
}
