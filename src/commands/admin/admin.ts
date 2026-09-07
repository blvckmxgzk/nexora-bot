import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  marketplaceMaintenanceService,
} from "../../services/community/marketplaceMaintenanceService.js";

import {
  moderationService,
} from "../../services/community/moderationService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "admin",
    )
    .setDescription(
      "NEXORA administration",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits
        .Administrator
        .toString(),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "status",
          )
          .setDescription(
            "ดูสถานะระบบ NEXORA",
          ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "marketplace-maintenance",
          )
          .setDescription(
            "จัดการ Marketplace Maintenance",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "mode",
                )
                .setDescription(
                  "สถานะที่ต้องการ",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  {
                    name:
                      "Status",

                    value:
                      "status",
                  },
                  {
                    name:
                      "Enable",

                    value:
                      "enable",
                  },
                  {
                    name:
                      "Disable",

                    value:
                      "disable",
                  },
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
                  "เหตุผล",
                )
                .setMaxLength(
                  1000,
                ),
          ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "announce",
          )
          .setDescription(
            "ส่งประกาศในห้อง",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "message",
                )
                .setDescription(
                  "ข้อความประกาศ",
                )
                .setRequired(
                  true,
                )
                .setMaxLength(
                  1900,
                ),
          )
          .addChannelOption(
            (
              option,
            ) =>
              option
                .setName(
                  "channel",
                )
                .setDescription(
                  "ห้องปลายทาง",
                ),
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ ใช้คำสั่งนี้ได้เฉพาะในเซิร์ฟเวอร์",

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
    "status"
  ) {
    const maintenance =
      await marketplaceMaintenanceService
        .getState();

    const embed =
      new EmbedBuilder()
        .setTitle(
          "🛡️ NEXORA System Status",
        )
        .addFields(
          {
            name:
              "🤖 Bot",

            value:
              "🟢 Online",

            inline:
              true,
          },
          {
            name:
              "🛍️ Marketplace",

            value:
              maintenance.enabled
                ? "🔧 Maintenance"
                : "🟢 Open",

            inline:
              true,
          },
          {
            name:
              "🔒 Hard Lock",

            value:
              maintenance.hardLocked
                ? "Enabled"
                : "Disabled",

            inline:
              true,
          },
          {
            name:
              "⏱️ Uptime",

            value:
              `${Math.floor(
                (
                  interaction
                    .client
                    .uptime ??
                  0
                ) /
                1000 /
                60
              ).toLocaleString()} นาที`,

            inline:
              true,
          },
        )
        .setFooter({
          text:
            "NEXORA • Administration",
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [
        embed,
      ],

      ephemeral:
        true,
    });

    return;
  }

  if (
    subcommand ===
    "marketplace-maintenance"
  ) {
    const mode =
      interaction.options
        .getString(
          "mode",
          true,
        );

    const reason =
      interaction.options
        .getString(
          "reason",
        ) ??
      "Marketplace maintenance";

    if (
      mode ===
      "status"
    ) {
      const state =
        await marketplaceMaintenanceService
          .getState();

      await interaction.reply({
        content: [
          "🔧 **Marketplace Maintenance**",
          "",
          `Status: **${state.enabled ? "ENABLED" : "DISABLED"}**`,
          `Hard Lock: **${state.hardLocked ? "YES" : "NO"}**`,
          `Reason: ${state.reason}`,
        ].join(
          "\n",
        ),

        ephemeral:
          true,
      });

      return;
    }

    const enabled =
      mode ===
      "enable";

    try {
      await marketplaceMaintenanceService
        .setEnabled(
          enabled,
          interaction.user.id,
          reason,
        );

      const audit =
        await moderationService
          .createCase({
            guildId:
              interaction.guildId,

            targetUserId:
              "SYSTEM",

            moderatorId:
              interaction.user.id,

            action:
              "maintenance",

            reason,

            metadata: {
              marketplaceMaintenance:
                enabled,
            },
          });

      await interaction.reply({
        content: [
          enabled
            ? "🔧 **Marketplace Maintenance เปิดแล้ว**"
            : "✅ **Marketplace Maintenance ปิดแล้ว**",
          "",
          `Audit Case: \`${audit.caseId}\``,
        ].join(
          "\n",
        ),

        ephemeral:
          true,
      });
    } catch (error) {
      await interaction.reply({
        content:
          `❌ ${error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนสถานะได้"}`,

        ephemeral:
          true,
      });
    }

    return;
  }

  const message =
    interaction.options
      .getString(
        "message",
        true,
      );

  const channel =
    interaction.options
      .getChannel(
        "channel",
      ) ??
    interaction.channel;

  if (
    !channel ||
    !(
      "send" in
      channel
    ) ||
    typeof channel.send !==
      "function"
  ) {
    await interaction.reply({
      content:
        "❌ ห้องนี้ไม่รองรับการส่งข้อความ",

      ephemeral:
        true,
    });

    return;
  }

  await channel.send({
    content:
      message,
  });

  await interaction.reply({
    content:
      "✅ ส่งประกาศแล้ว",

    ephemeral:
      true,
  });
}
