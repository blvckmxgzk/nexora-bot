import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { orderService } from "../../services/orderService.js";

export const customId =
  "nexora_order_complete:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const orderId =
    interaction.customId.split(":")[1];

  if (!orderId) {
    await interaction.reply({
      content: "❌ ไม่พบ Order ID",
      ephemeral: true,
    });
    return;
  }

  const order =
    await orderService.getByOrderId(
      orderId,
    );

  if (!order) {
    await interaction.reply({
      content: "❌ ไม่พบคำสั่งซื้อ",
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
    order.status ===
    "completed"
  ) {
    await interaction.reply({
      content:
        "ℹ️ คำสั่งซื้อนี้เสร็จสิ้นไปแล้ว",
      ephemeral: true,
    });
    return;
  }

  if (
    order.status !== "paid" &&
    order.status !== "processing"
  ) {
    await interaction.reply({
      content:
        `❌ ไม่สามารถกดเสร็จสิ้นได้\nสถานะปัจจุบัน: \`${order.status}\``,
      ephemeral: true,
    });
    return;
  }

  const completed =
    await orderService.markCompleted(
      orderId,
    );

  const embed =
    new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(
        "✅ การซื้อขายเสร็จสิ้น",
      )
      .setDescription(
        [
          "การซื้อขายของคุณเสร็จสมบูรณ์แล้ว",
          "",
          `🧾 **Order ID:** \`${completed.orderId}\``,
          `📦 **สินค้า:** ${completed.productName}`,
          `🔢 **จำนวน:** ${completed.quantity}`,
          "",
          "สถานะ:",
          "**COMPLETED**",
          "",
          "⭐ ขอบคุณที่ใช้ NEXORA Marketplace",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace",
      })
      .setTimestamp();

  const reviewButton =
    new ButtonBuilder()
      .setCustomId(
        `nexora_order_review:${completed.orderId}`,
      )
      .setLabel(
        "รีวิวร้านค้า",
      )
      .setEmoji("⭐")
      .setStyle(
        ButtonStyle.Primary,
      );

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        reviewButton,
      );

  await interaction.update({
    embeds: [embed],
    components: [row],
  });
}
