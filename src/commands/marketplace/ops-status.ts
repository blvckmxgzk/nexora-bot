import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  MarketplaceOpsAlert,
} from "../../models/MarketplaceOpsAlert.js";

import {
  marketplaceOpsHealthService,
} from "../../services/marketplace/marketplaceOpsHealthService.js";

import {
  notificationDeliveryService,
} from "../../services/marketplace/notificationDeliveryService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "ops-status",
    )
    .setDescription(
      "ตรวจสอบ Marketplace operational health",
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
            "summary",
          )
          .setDescription(
            "ดู Worker และ stale-operation health",
          ),
    )
    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "alerts",
          )
          .setDescription(
            "ดู Marketplace Ops Alerts ที่ active",
          ),
    )
    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "retry-notification",
          )
          .setDescription(
            "ลองส่ง Notification dead-letter ใหม่",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "delivery_id",
                )
                .setDescription(
                  "Notification Delivery ID",
                )
                .setRequired(
                  true,
                ),
          ),
    );

function formatDate(
  value:
    unknown,
): string {
  if (!value) {
    return "never";
  }

  const date =
    new Date(
      value as
        string |
        number |
        Date,
    );

  if (
    !Number.isFinite(
      date.getTime(),
    )
  ) {
    return "invalid";
  }

  return date
    .toISOString();
}

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

  await interaction.deferReply({
    ephemeral:
      true,
  });

  try {
    if (
      subcommand ===
      "retry-notification"
    ) {
      const deliveryId =
        interaction.options
          .getString(
            "delivery_id",
            true,
          )
          .trim();

      const result =
        await notificationDeliveryService
          .retryDeadLetter(
            deliveryId,
          );

      await interaction
        .editReply({
          content: [
            "📨 **Notification Recovery**",
            "",
            `Delivery ID: \`${deliveryId}\``,
            `Status: **${result?.status ?? "unknown"}**`,
            `Attempts: **${result?.attempts ?? "-"}**`,
          ].join(
            "\n",
          ),
        });

      return;
    }

    if (
      subcommand ===
      "alerts"
    ) {
      const alerts =
        await MarketplaceOpsAlert
          .find({
            status:
              "active",
          })
          .sort({
            severity:
              1,

            lastDetectedAt:
              -1,
          })
          .limit(
            10,
          )
          .lean();

      if (
        alerts.length ===
        0
      ) {
        await interaction
          .editReply({
            content:
              "✅ ไม่มี Marketplace Ops Alert ที่ active",
          });

        return;
      }

      const lines =
        alerts.map(
          (
            alert,
          ) => {
            const icon =
              alert.severity ===
                "critical"
                ? "🔴"
                : "🟠";

            return [
              `${icon} **${alert.code}**`,
              `count=${alert.count}`,
              `last=${formatDate(alert.lastDetectedAt)}`,
            ].join(
              " • ",
            );
          },
        );

      await interaction
        .editReply({
          content: [
            "📡 **Marketplace Ops Alerts**",
            "",
            ...lines,
          ].join(
            "\n",
          ),
        });

      return;
    }

    const [
      readiness,
      snapshot,
      activeCriticalCount,
      activeWarningCount,
    ] =
      await Promise.all([
        marketplaceOpsHealthService
          .getReadiness(),

        marketplaceOpsHealthService
          .getOperationalSnapshot(),

        MarketplaceOpsAlert
          .countDocuments({
            status:
              "active",

            severity:
              "critical",
          }),

        MarketplaceOpsAlert
          .countDocuments({
            status:
              "active",

            severity:
              "warning",
          }),
      ]);

    const workerLines =
      readiness.workers
        ?.workers
        .map(
          (
            worker,
          ) => {
            const icon =
              worker.healthy
                ? "🟢"
                : "🔴";

            return [
              `${icon} ${worker.workerName}`,
              `status=${worker.status}`,
              `failures=${worker.consecutiveFailures ?? 0}`,
              `lastSuccess=${formatDate(worker.lastSuccessAt)}`,
            ].join(
              " • ",
            );
          },
        ) ??
      [
        "🔴 Worker state unavailable",
      ];

    await interaction.editReply({
      content: [
        "📡 **NEXORA Marketplace Ops**",
        "",
        readiness.ready
          ? "🟢 Readiness: **READY**"
          : "🔴 Readiness: **NOT READY**",

        `Database: **${readiness.database}**`,
        "",
        "**Workers**",
        ...workerLines,
        "",
        "**Stale operations**",
        `Webhook processing: **${snapshot.staleWebhookProcessingCount}**`,
        `Recent failed webhooks: **${snapshot.recentFailedWebhookCount}**`,
        `Payment creating: **${snapshot.staleCreatingPaymentCount}**`,
        `Payment overdue: **${snapshot.overduePendingPaymentCount}**`,
        `Refund processing: **${snapshot.staleProcessingRefundCount}**`,
        `Payout reconciliation: **${snapshot.stalePayoutCount}**`,
        `Dispute reconciliation: **${snapshot.staleDisputeCount}**`,
        `Risk reviews >24h: **${snapshot.staleRiskReviewCount}**`,
        "",
        `🔴 Critical alerts: **${activeCriticalCount}**`,
        `🟠 Warning alerts: **${activeWarningCount}**`,
      ].join(
        "\n",
      ),
    });
  } catch (error) {
    await interaction.editReply({
      content:
        `❌ ${
          error instanceof Error
            ? error.message
            : "Ops status failed"
        }`,
    });
  }
}
