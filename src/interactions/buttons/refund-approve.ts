import {
  type ButtonInteraction,
} from "discord.js";

import {
  Refund,
} from "../../models/Refund.js";

import {
  refundService,
} from "../../services/refundService.js";

import {
  Order,
} from "../../models/Order.js";

import {
  notificationDeliveryService,
} from "../../services/marketplace/notificationDeliveryService.js";

export const customId =
  "nexora_refund_approve:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const refundId =
    interaction.customId.split(":")[1];

  if (!refundId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Refund ID",
      ephemeral: true,
    });
    return;
  }

  const refund =
    await Refund.findOne({
      refundId,
    });

  if (!refund) {
    await interaction.reply({
      content:
        "❌ ไม่พบคำขอคืนเงิน",
      ephemeral: true,
    });
    return;
  }

  if (
    refund.sellerId !==
    interaction.user.id
  ) {
    await interaction.reply({
      content:
        "❌ คุณไม่มีสิทธิ์อนุมัติคำขอคืนเงินนี้",
      ephemeral: true,
    });
    return;
  }

  if (
    refund.status !==
    "requested"
  ) {
    await interaction.reply({
      content:
        `❌ คำขอคืนเงินนี้อยู่ในสถานะ \`${refund.status}\` แล้ว`,
      ephemeral: true,
    });
    return;
  }

  try {
    await refundService.approveRefund(
      refundId,
      interaction.user.id,
    );

    await interaction.update({
      content:
        "⏳ กำลังดำเนินการคืนเงินผ่าน Payment Provider...",
      embeds: [],
      components: [],
    });

    const completed =
      await refundService.processRefund(
        refundId,
      );

    try {
      await notificationDeliveryService
        .enqueueAndAttempt({
          eventType:
            "refund_completed_buyer",

          resourceId:
            completed.refundId,
        });
    } catch (notificationError) {
      console.error(
        "⚠️ Failed to enqueue completed Refund notification:",
        notificationError,
      );
    }

    await interaction.editReply({
      content:
        [
          "✅ **คืนเงินสำเร็จ**",
          "",
          `Refund ID: \`${completed.refundId}\``,
          `Order ID: \`${completed.orderId}\``,
          "",
          "Payment ถูกคืนเงินและ Order ถูกเปลี่ยนเป็น refunded แล้ว",
        ].join("\n"),
    });
  } catch (error) {
    console.error(
      "❌ Failed to process refund:",
      error,
    );

    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ คืนเงินไม่สำเร็จ: ${error.message}`
          : "❌ คืนเงินไม่สำเร็จ",
    });
  }
}
