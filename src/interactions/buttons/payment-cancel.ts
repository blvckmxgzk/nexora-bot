import {
  type ButtonInteraction,
} from "discord.js";

import { Payment } from "../../models/Payment.js";
import { orderService } from "../../services/orderService.js";
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
        "❌ ไม่พบ Payment ID",
      ephemeral: true,
    });
    return;
  }

  const payment =
    await Payment.findOne({
      paymentId,
    });

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

  if (
    payment.status !==
    "pending"
  ) {
    await interaction.reply({
      content:
        "❌ Payment นี้ไม่สามารถยกเลิกได้",
      ephemeral: true,
    });
    return;
  }

  await paymentService.cancelPayment(
    paymentId,
  );

  const order =
    await orderService.cancelOrder(
      payment.orderId,
      "ยกเลิกการชำระเงินโดยผู้ซื้อ",
    );

  await interaction.update({
    content:
      `✅ ยกเลิกการชำระเงินแล้ว\nคำสั่งซื้อ \`${order.orderId}\` ถูกยกเลิก และคืน Stock ให้ร้านค้าแล้ว`,
    embeds: [],
    components: [],
  });
}
