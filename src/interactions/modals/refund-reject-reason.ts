import {
  type ModalSubmitInteraction,
} from "discord.js";

import {
  refundService,
} from "../../services/refundService.js";

import {
  getMarketplaceDiscordClient,
} from "../../services/marketplace/marketplaceNotificationService.js";

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
      const client =
        getMarketplaceDiscordClient();

      const buyer =
        await client.users.fetch(
          refund.buyerId,
        );

      await buyer.send({
        content:
          [
            "❌ **คำขอคืนเงินถูกปฏิเสธ**",
            "",
            `🧾 Order ID: \`${refund.orderId}\``,
            `💸 Refund ID: \`${refund.refundId}\``,
            "",
            `**เหตุผลจากร้านค้า:**\n${reason}`,
            "",
            "หากคุณคิดว่าการปฏิเสธไม่เป็นธรรม สามารถใช้ปุ่ม 🚨 Report Scam เพื่อส่งเรื่องให้ทีมงานตรวจสอบได้",
          ].join("\n"),
      });
    } catch (notificationError) {
      /*
       * Buyer DM ล้มเหลว
       * แต่ Refund ถูก Reject ในฐานข้อมูลแล้ว
       * จึงไม่ควรทำให้ action หลักล้มเหลว
       */
      console.error(
        "⚠️ Failed to notify buyer about rejected refund:",
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
