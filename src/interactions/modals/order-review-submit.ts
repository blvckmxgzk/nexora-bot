import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { reviewService } from "../../services/reviewService.js";

export const customId =
  "nexora_order_review_submit:";

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

  const ratingText =
    interaction.fields
      .getTextInputValue(
        "rating",
      )
      .trim();

  const comment =
    interaction.fields
      .getTextInputValue(
        "comment",
      )
      .trim();

  const rating =
    Number(ratingText);

  if (
    !Number.isInteger(
      rating,
    ) ||
    rating < 1 ||
    rating > 5
  ) {
    await interaction.reply({
      content:
        "❌ กรุณาให้คะแนนเป็นตัวเลข 1–5 เท่านั้น",
      ephemeral: true,
    });

    return;
  }

  try {
    const review =
      await reviewService.createReview({
        orderId,
        buyerId:
          interaction.user.id,
        rating,
        comment,
      });

    const stars =
      "⭐".repeat(
        review.rating,
      );

    const embed =
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(
          "⭐ รีวิวถูกส่งเรียบร้อยแล้ว",
        )
        .setDescription(
          [
            `🧾 **Order ID:** \`${review.orderId}\``,
            "",
            `**คะแนน:** ${stars}`,
            "",
            review.comment
              ? `💬 **ความคิดเห็น**\n${review.comment}`
              : "💬 ไม่มีความคิดเห็นเพิ่มเติม",
            "",
            "ขอบคุณที่ช่วยให้คะแนนร้านค้าใน NEXORA Marketplace ❤️",
          ].join("\n"),
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Review",
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error(
      "❌ Failed to create review:",
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถส่งรีวิวได้",
      ephemeral: true,
    });
  }
}
