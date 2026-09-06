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
  "nexora_order_abort:";

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
        "❌ คุณไม่มีสิทธิ์ดำเนินการกับคำสั่งซื้อนี้",
      ephemeral: true,
    });
    return;
  }

  if (
    ![
      "paid",
      "processing",
      "completed",
    ].includes(order.status)
  ) {
    await interaction.reply({
      content:
        "❌ คำสั่งซื้อนี้ไม่สามารถขอคืนเงินได้ในขณะนี้",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_order_abort_reason:${orderId}`,
      )
      .setTitle(
        "❌ ขอคืนเงิน",
      );

  const reason =
    new TextInputBuilder()
      .setCustomId(
        "refund_reason",
      )
      .setLabel(
        "เหตุผลที่ต้องการคืนเงิน",
      )
      .setPlaceholder(
        "อธิบายปัญหาที่เกิดขึ้น เช่น ยังไม่ได้รับสินค้า / สินค้าไม่ตรง...",
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
