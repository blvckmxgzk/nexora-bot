import {
  type ModalSubmitInteraction,
} from "discord.js";

import {
  refundService,
} from "../../services/refundService.js";

import {
  sendSellerRefundRequestDM,
} from "../../services/marketplace/sellerOrderNotificationService.js";

import {
  getMarketplaceDiscordClient,
} from "../../services/marketplace/marketplaceNotificationService.js";

export const customId =
  "nexora_order_abort_reason:";

export async function execute(
  interaction: ModalSubmitInteraction,
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

  const reason =
    interaction.fields
      .getTextInputValue(
        "refund_reason",
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
      await refundService.requestRefund(
        orderId,
        interaction.user.id,
        reason,
      );

    try {
      const client =
        getMarketplaceDiscordClient();

      await sendSellerRefundRequestDM(
        client,
        refund.refundId,
      );
    } catch (notificationError) {
      console.error(
        "⚠️ Failed to notify seller about refund:",
        notificationError,
      );
    }

    await interaction.reply({
      content:
        [
          "✅ **ส่งคำขอคืนเงินแล้ว**",
          "",
          `🧾 Order ID: \`${refund.orderId}\``,
          `💸 Refund ID: \`${refund.refundId}\``,
          "",
          "คำขอของคุณถูกส่งให้ร้านค้าตรวจสอบแล้ว",
          "เมื่อร้านค้าอนุมัติ ระบบจะดำเนินการคืนเงินผ่านช่องทางการชำระเงิน",
        ].join("\n"),
      ephemeral: true,
    });
  } catch (error) {
    console.error(
      "❌ Failed to request refund:",
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถส่งคำขอคืนเงินได้",
      ephemeral: true,
    });
  }
}
