import {
  type ButtonInteraction,
} from "discord.js";

import {
  paymentService,
} from "../../services/paymentService.js";

export const customId =
  "nexora_payment_cancel:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const paymentId =
    interaction.customId.split(":")[1];

  if (!paymentId) {
    await interaction.reply({
      content:
        "❌ Payment ID ไม่ถูกต้อง",
      ephemeral: true,
    });

    return;
  }

  const payment =
    await paymentService.getByPaymentId(
      paymentId,
    );

  if (!payment) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Payment",
      ephemeral: true,
    });

    return;
  }

  if (
    payment.buyerId !==
    interaction.user.id
  ) {
    await interaction.reply({
      content:
        "❌ คุณไม่มีสิทธิ์ดำเนินการกับ Payment นี้",
      ephemeral: true,
    });

    return;
  }

  if (
    payment.status !==
    "pending"
  ) {
    await interaction.reply({
      content:
        `ℹ️ Payment นี้อยู่ในสถานะ \`${payment.status}\` แล้ว`,
      ephemeral: true,
    });

    return;
  }

  const expiresAt =
    payment.expiresAt
      instanceof Date
      ? payment.expiresAt
      : new Date(
          payment.expiresAt,
        );

  const timestamp =
    Math.floor(
      expiresAt.getTime() /
        1000,
    );

  await interaction.reply({
    content:
      "⚠️ ไม่สามารถยกเลิก Payment หลังจากสร้าง QR แล้วได้\n\n" +
      "QR จาก Payment Provider อาจยังสามารถใช้ชำระเงินจริงได้ " +
      "ดังนั้นระบบจะไม่คืน Stock จนกว่า Provider จะยืนยันว่ารายการหมดอายุ\n\n" +
      `⏰ หมดอายุประมาณ <t:${timestamp}:R>`,
    ephemeral: true,
  });
}
