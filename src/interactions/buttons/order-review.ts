import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { orderService } from "../../services/orderService.js";
import { reviewService } from "../../services/reviewService.js";

export const customId =
  "nexora_order_review:";

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
    await orderService.getByOrderId(
      orderId,
    );

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
        "❌ คุณไม่มีสิทธิ์รีวิวคำสั่งซื้อนี้",
      ephemeral: true,
    });

    return;
  }

  if (
    order.status !==
    "completed"
  ) {
    await interaction.reply({
      content:
        "❌ สามารถรีวิวได้หลังจากคำสั่งซื้อเสร็จสิ้นเท่านั้น",
      ephemeral: true,
    });

    return;
  }

  const existing =
    await reviewService.getByOrderId(
      orderId,
    );

  if (existing) {
    await interaction.reply({
      content:
        "ℹ️ คุณได้รีวิวคำสั่งซื้อนี้ไปแล้ว",
      ephemeral: true,
    });

    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_order_review_submit:${orderId}`,
      )
      .setTitle(
        "⭐ รีวิวร้านค้า",
      );

  const ratingInput =
    new TextInputBuilder()
      .setCustomId(
        "rating",
      )
      .setLabel(
        "ให้คะแนน 1-5 ดาว",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setPlaceholder(
        "เช่น 5",
      )
      .setRequired(true)
      .setMaxLength(1);

  const commentInput =
    new TextInputBuilder()
      .setCustomId(
        "comment",
      )
      .setLabel(
        "ความคิดเห็น",
      )
      .setStyle(
        TextInputStyle.Paragraph,
      )
      .setPlaceholder(
        "บอกความคิดเห็นของคุณเกี่ยวกับร้านค้า...",
      )
      .setRequired(false)
      .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        ratingInput,
      ),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        commentInput,
      ),
  );

  await interaction.showModal(
    modal,
  );
}
