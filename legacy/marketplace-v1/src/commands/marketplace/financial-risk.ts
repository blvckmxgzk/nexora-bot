import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  Dispute,
} from "../../models/Dispute.js";

import {
  disputeService,
} from "../../services/disputeService.js";

import {
  reconcileDisputes,
} from "../../services/disputeReconciliationService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "financial-risk",
    )
    .setDescription(
      "จัดการ Financial Risk ของ NEXORA Marketplace",
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
            "ดู Dispute / Financial Risk ที่ยังไม่ resolve",
          ),
    )
    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "resolve",
          )
          .setDescription(
            "ปลด LOST Dispute หลัง Seller ชำระ liability ครบแล้ว",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "dispute_id",
                )
                .setDescription(
                  "NEXORA Dispute ID",
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
                  "เหตุผลในการปลด Financial Risk",
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
            "reconcile",
          )
          .setDescription(
            "รัน Provider Dispute reconciliation ตอนนี้",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.guild
  ) {
    await interaction.reply({
      content:
        "❌ คำสั่งนี้ใช้ได้เฉพาะใน Server",

      ephemeral:
        true,
    });

    return;
  }

  if (
    !interaction
      .memberPermissions
      ?.has(
        PermissionFlagsBits
          .Administrator,
      )
  ) {
    await interaction.reply({
      content:
        "❌ ต้องมีสิทธิ์ Administrator เพื่อจัดการ Financial Risk",

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
    const disputes =
      await Dispute
        .find({
          $or: [
            {
              status: {
                $in: [
                  "open",
                  "pending",
                ],
              },
            },

            {
              status:
                "lost",

              riskResolvedAt:
                null,
            },

            {
              status:
                "won",

              "metadata.providerCreditConfirmed": {
                $ne:
                  true,
              },
            },
          ],
        })
        .sort({
          updatedAt:
            -1,
        })
        .limit(
          20,
        );

    if (
      disputes.length ===
      0
    ) {
      await interaction.reply({
        content:
          "✅ ไม่มี Financial Risk ที่ยัง unresolved",

        ephemeral:
          true,
      });

      return;
    }

    const lines =
      disputes.map(
        (
          dispute,
        ) =>
          [
            `**${dispute.disputeId}**`,
            `Provider: \`${dispute.providerDisputeId}\``,
            `Seller: <@${dispute.sellerId}>`,
            `Status: \`${dispute.status}\``,
            `Liability: ฿${(
              dispute.sellerLiabilitySatang /
              100
            ).toFixed(2)}`,
          ].join(
            " • ",
          ),
      );

    await interaction.reply({
      content:
        [
          "🛡️ **NEXORA Financial Risk**",
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

  if (
    subcommand ===
    "reconcile"
  ) {
    await interaction.deferReply({
      ephemeral:
        true,
    });

    const result =
      await reconcileDisputes(
        200,
      );

    await interaction.editReply({
      content:
        [
          "🛡️ **Dispute reconciliation complete**",
          "",
          `Checked: ${result.checked}`,
          `Reconciled: ${result.reconciled}`,
          `Discovered: ${result.discovered}`,
          `Ignored: ${result.ignored}`,
          `Failed: ${result.failed}`,
        ].join(
          "\n",
        ),
    });

    return;
  }

  const disputeId =
    interaction.options
      .getString(
        "dispute_id",
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
      await disputeService
        .resolveLostDisputeRisk({
          disputeId,

          actorId:
            interaction.user.id,

          reason,
        });

    await interaction.editReply({
      content:
        [
          "✅ **Financial Risk resolution recorded**",
          "",
          `Dispute: \`${result.dispute.disputeId}\``,
          `Provider status: \`${result.dispute.status}\``,
          `Seller: <@${result.dispute.sellerId}>`,
          `Payout frozen: \`${result.financialState.payoutFrozen}\``,
          `Risk status: \`${result.financialState.riskStatus}\``,
          "",
          result.alreadyResolved
            ? "ℹ️ Dispute นี้ถูก resolve ไว้แล้ว"
            : "🧾 Immutable FinancialRiskAction ถูกบันทึกแล้ว",
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
            : "Financial Risk resolution failed"
        }`,
    });
  }
}
