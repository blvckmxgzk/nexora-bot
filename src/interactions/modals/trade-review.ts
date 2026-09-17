import {
  MessageFlags,
  type ModalSubmitInteraction,
} from "discord.js";

import {
  marketplaceV2Service,
} from "../../services/marketplace/marketplaceV2Service.js";

export const customId =
  "nexora_trade_review_modal:";

export async function execute(
  interaction:
    ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  try {
    const requestId =
      interaction.customId
        .split(
          ":",
        )[1];

    if (!requestId) {
      throw new Error(
        "Trade ID ไม่ถูกต้อง",
      );
    }

    const rating =
      Number(
        interaction.fields
          .getTextInputValue(
            "rating",
          )
          .trim(),
      );

    const comment =
      interaction.fields
        .getTextInputValue(
          "comment",
        )
        .trim();

    const review =
      await marketplaceV2Service
        .createReview(
          interaction.client,
          requestId,
          interaction.user.id,
          rating,
          comment,
        );

    await interaction.editReply({
      content: [
        "⭐ **ส่งรีวิวเรียบร้อยแล้ว**",
        "",
        `${"⭐".repeat(rating)}`,
        comment
          ? `> ${comment}`
          : "",
        "",
        `Review ID: \`${review.reviewId}\``,
      ]
        .filter(
          Boolean,
        )
        .join(
          "\n",
        ),
    });
  } catch (
    error
  ) {
    await interaction.editReply({
      content:
        `❌ ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
