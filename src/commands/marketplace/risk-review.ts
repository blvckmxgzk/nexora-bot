import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  RiskReview,
} from "../../models/RiskReview.js";

import {
  marketplaceRiskReviewService,
} from "../../services/marketplace/marketplaceRiskReviewService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "risk-review",
    )
    .setDescription(
      "จัดการ Marketplace Risk Reviews",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits
        .Administrator
        .toString(),
    )
    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "list",
          )
          .setDescription(
            "ดู Risk Reviews ที่รอการตรวจสอบ",
          ),
    )
    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "approve",
          )
          .setDescription(
            "อนุมัติ Risk Review",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "review_id",
                )
                .setDescription(
                  "Risk Review ID",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "reason",
                )
                .setDescription(
                  "เหตุผลในการอนุมัติ",
                )
                .setMinLength(
                  10,
                )
                .setMaxLength(
                  1000,
                )
                .setRequired(
                  true,
                ),
          ),
    )
    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "reject",
          )
          .setDescription(
            "ปฏิเสธ Risk Review",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "review_id",
                )
                .setDescription(
                  "Risk Review ID",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "reason",
                )
                .setDescription(
                  "เหตุผลในการปฏิเสธ",
                )
                .setMinLength(
                  10,
                )
                .setMaxLength(
                  1000,
                )
                .setRequired(
                  true,
                ),
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.guild ||
    !interaction
      .memberPermissions
      ?.has(
        PermissionFlagsBits
          .Administrator,
      )
  ) {
    await interaction.reply({
      content:
        "❌ ต้องมีสิทธิ์ Administrator",

      ephemeral:
        true,
    });

    return;
  }

  const subcommand =
    interaction.options
      .getSubcommand();

  if (
    subcommand ===
    "list"
  ) {
    const reviews =
      await RiskReview
        .find({
          status:
            "pending",
        })
        .sort({
          createdAt:
            1,
        })
        .limit(
          20,
        );

    if (
      reviews.length ===
      0
    ) {
      await interaction.reply({
        content:
          "✅ ไม่มี Risk Review ที่รอดำเนินการ",

        ephemeral:
          true,
      });

      return;
    }

    const lines =
      reviews.map(
        (
          review,
        ) =>
          [
            `**${review.reviewId}**`,
            `Type: \`${review.resourceType}\``,
            `Resource: \`${review.resourceId}\``,
            `Score: **${review.score}/100**`,
            `Reasons: \`${review.reasonCodes.join(", ") || "none"}\``,
          ].join(
            " • ",
          ),
      );

    await interaction.reply({
      content:
        [
          "🛡️ **Pending Marketplace Risk Reviews**",
          "",
          ...lines,
        ].join(
          "\n",
        ),

      ephemeral:
        true,
    });

    return;
  }

  const reviewId =
    interaction.options
      .getString(
        "review_id",
        true,
      );

  const reason =
    interaction.options
      .getString(
        "reason",
        true,
      );

  await interaction.deferReply({
    ephemeral:
      true,
  });

  try {
    const result =
      await marketplaceRiskReviewService
        .resolveReview({
          reviewId,

          action:
            subcommand ===
              "approve"
              ? "approve"
              : "reject",

          actorId:
            interaction.user.id,

          reason,
        });

    await interaction.editReply({
      content:
        [
          result.review.status ===
            "approved"
            ? "✅ **Risk Review approved**"
            : "🚫 **Risk Review rejected**",

          `Review: \`${result.review.reviewId}\``,

          `Resource: \`${result.review.resourceType}:${result.review.resourceId}\``,

          result.alreadyResolved
            ? "ℹ️ Review นี้ถูก resolve ไว้แล้ว"
            : "🧾 Immutable RiskReviewAction ถูกบันทึกแล้ว",
        ].join(
          "\n",
        ),
    });
  } catch (error) {
    await interaction.editReply({
      content:
        `❌ ${
          error instanceof
            Error
            ? error.message
            : "Risk Review failed"
        }`,
    });
  }
}
