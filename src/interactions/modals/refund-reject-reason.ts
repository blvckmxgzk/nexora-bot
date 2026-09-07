import {
  type ModalSubmitInteraction,
} from "discord.js";

import {
  refundService,
} from "../../services/refundService.js";

import {
  notificationDeliveryService,
} from "../../services/marketplace/notificationDeliveryService.js";

export const customId =
  "nexora_refund_reject_reason:";

export async function execute(
  interaction: ModalSubmitInteraction,
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

  const reason =
    interaction.fields
      .getTextInputValue(
        "rejection_reason",
      )
      .trim();

  if (reason.length < 5) {
    await interaction.reply({
      content:
        "❌ กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร",
      ephemeral: true,
    });
    return;
  }

  try {
    const refund =
      await refundService.rejectRefund(
        refundId,
        interaction.user.id,
        reason,
      );

    try {
      await notificationDeliveryService
        .enqueueAndAttempt({
          eventType:
            "refund_rejected_buyer",

          resourceId:
            refund.refundId,
        });
    } catch (notificationError) {
      console.error(
        "⚠️ Failed to enqueue rejected Refund notification:",
        notificationError,
      );
    }

    /*
     * ModalSubmitInteraction ไม่มี update()
     *
     * ใช้ reply() เพื่อส่งผลลัพธ์กลับไปยัง interaction
     */
    await interaction.reply({
      content:
        [
          "❌ **ปฏิเสธคำขอคืนเงินแล้ว**",
          "",
          `Refund ID: \`${refund.refundId}\``,
          `Order ID: \`${refund.orderId}\``,
          "",
          `เหตุผล: ${reason}`,
        ].join("\n"),
      ephemeral: true,
    });
  } catch (error) {
    console.error(
      "❌ Failed to reject refund:",
      error,
    );

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction.editReply({
        content:
          error instanceof Error
            ? `❌ ${error.message}`
            : "❌ ไม่สามารถปฏิเสธ Refund ได้",
      });
      return;
    }

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถปฏิเสธ Refund ได้",
      ephemeral: true,
    });
  }
}
