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
  getMarketplaceDiscordClient,
} from "../../services/marketplace/marketplaceNotificationService.js";

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

    const client =
      getMarketplaceDiscordClient();

    try {
      const buyer =
        await client.users.fetch(
          refund.buyerId,
        );

      await buyer.send({
        content:
          [
            "💰 **คืนเงินสำเร็จ**",
            "",
            `🧾 Order ID: \`${refund.orderId}\``,
            `💸 Refund ID: \`${refund.refundId}\``,
            `💰 จำนวน: ฿${refund.amount.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
            })}`,
            "",
            "ระบบได้ดำเนินการคืนเงินผ่าน Payment Provider แล้ว",
          ].join("\n"),
      });
    } catch (buyerError) {
      console.error(
        "⚠️ Failed to notify buyer about refund:",
        buyerError,
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
