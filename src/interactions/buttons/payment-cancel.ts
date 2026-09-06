import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { paymentService } from "../../services/paymentService.js";

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

  try {
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
          "❌ คุณไม่มีสิทธิ์ยกเลิก Payment นี้",
        ephemeral: true,
      });
      return;
    }

    await paymentService.cancelPayment(
      paymentId,
    );

    const embed =
      new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(
          "❌ ยกเลิกการชำระเงินแล้ว",
        )
        .setDescription(
          [
            `🧾 **Order ID:** \`${payment.orderId}\``,
            `💳 **Payment ID:** \`${payment.paymentId}\``,
            "",
            "Stock ที่ถูกกันไว้สำหรับคำสั่งซื้อนี้จะถูกคืนตามระบบ Order",
          ].join("\n"),
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Payment Cancelled",
        })
        .setTimestamp();

    await interaction.update({
      embeds: [embed],
      components: [],
    });
  } catch (error) {
    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถยกเลิก Payment ได้",
      ephemeral: true,
    });
  }
}
