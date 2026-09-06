import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import {
  Refund,
} from "../../models/Refund.js";

export const customId =
  "nexora_refund_reject:";

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
        "❌ คุณไม่มีสิทธิ์ปฏิเสธคำขอคืนเงินนี้",
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
        "❌ คำขอคืนเงินนี้ถูกดำเนินการไปแล้ว",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_refund_reject_reason:${refundId}`,
      )
      .setTitle(
        "❌ ปฏิเสธคำขอคืนเงิน",
      );

  const reason =
    new TextInputBuilder()
      .setCustomId(
        "rejection_reason",
      )
      .setLabel(
        "เหตุผลที่ปฏิเสธ",
      )
      .setPlaceholder(
        "ระบุเหตุผลให้ผู้ซื้อทราบ...",
      )
      .setStyle(
        TextInputStyle.Paragraph,
      )
      .setRequired(true)
      .setMinLength(5)
      .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      reason,
    ),
  );

  await interaction.showModal(
    modal,
  );
}
