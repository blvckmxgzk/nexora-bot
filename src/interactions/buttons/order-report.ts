import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import {
  Order,
} from "../../models/Order.js";

export const customId =
  "nexora_order_report:";

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
    await Order.findOne({
      orderId,
    });

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
        "❌ คุณไม่มีสิทธิ์รายงานคำสั่งซื้อนี้",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_order_report_reason:${orderId}`,
      )
      .setTitle(
        "🚨 Report Scam",
      );

  const reason =
    new TextInputBuilder()
      .setCustomId(
        "report_reason",
      )
      .setLabel(
        "รายละเอียดปัญหา",
      )
      .setPlaceholder(
        "อธิบายสิ่งที่เกิดขึ้นให้ทีมงานทราบอย่างละเอียด...",
      )
      .setStyle(
        TextInputStyle.Paragraph,
      )
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(2000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      reason,
    ),
  );

  await interaction.showModal(
    modal,
  );
}
