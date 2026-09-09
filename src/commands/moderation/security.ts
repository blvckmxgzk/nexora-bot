import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  securityService,
} from "../../services/community/securityService.js";

import {
  NEXORA_SECURITY_POLICY_VERSION,
  SECURITY_THRESHOLDS,
  SECURITY_WINDOW_MS,
} from "../../community/security/securityPolicy.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "security",
    )
    .setDescription(
      "NEXORA Security Core / Anti-Nuke",
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
            "setup",
          )
          .setDescription(
            "ตั้งค่า Security Core",
          )
          .addChannelOption(
            (
              option,
            ) =>
              option
                .setName(
                  "log_channel",
                )
                .setDescription(
                  "ห้อง Security Incident Logs",
                )
                .addChannelTypes(
                  ChannelType
                    .GuildText,
                )
                .setRequired(
                  true,
                ),
          ),
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
            "ดูสถานะระบบ Security",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "enable",
          )
          .setDescription(
            "เปิด Security Core",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "disable",
          )
          .setDescription(
            "ปิด Security Core",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "trust-user",
          )
          .setDescription(
            "เพิ่ม/ลบผู้ใช้จาก Trusted List",
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
                  "Add / Remove",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  {
                    name:
                      "Add",

                    value:
                      "add",
                  },
                  {
                    name:
                      "Remove",

                    value:
                      "remove",
                  },
                ),
          )
          .addUserOption(
            (
              option,
            ) =>
              option
                .setName(
                  "user",
                )
                .setDescription(
                  "ผู้ใช้ที่ไว้ใจให้ทำการเปลี่ยนแปลงระดับสูง",
                )
                .setRequired(
                  true,
                ),
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "trust-role",
          )
          .setDescription(
            "เพิ่ม/ลบ Role จาก Trusted List",
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
                  "Add / Remove",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  {
                    name:
                      "Add",

                    value:
                      "add",
                  },
                  {
                    name:
                      "Remove",

                    value:
                      "remove",
                  },
                ),
          )
          .addRoleOption(
            (
              option,
            ) =>
              option
                .setName(
                  "role",
                )
                .setDescription(
                  "Role ที่ไว้ใจ",
                )
                .setRequired(
                  true,
                ),
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "lockdown",
          )
          .setDescription(
            "Emergency Lockdown ทั้งเซิร์ฟเวอร์",
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
            "unlock",
          )
          .setDescription(
            "คืน Permission หลัง Lockdown",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "incidents",
          )
          .setDescription(
            "ดู Security Incidents ล่าสุด",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "restore-roles",
          )
          .setDescription(
            "คืน Role ที่ Security Core ถอดออกจาก Executor",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "incident_id",
                )
                .setDescription(
                  "Security Incident ID",
                )
                .setRequired(
                  true,
                ),
          ),
    );

function guildOf(
  interaction:
    ChatInputCommandInteraction,
) {
  if (
    !interaction.inGuild() ||
    !interaction.guild
  ) {
    throw new Error(
      "ใช้ Security Core ได้เฉพาะในเซิร์ฟเวอร์",
    );
  }

  return interaction.guild;
}

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const guild =
    guildOf(
      interaction,
    );

  const sub =
    interaction.options
      .getSubcommand();

  if (
    sub ===
    "status"
  ) {
    const config =
      await securityService
        .getConfig(
          guild.id,
        );

    if (!config) {
      await interaction.reply({
        content:
          "ℹ️ Security Core ยังไม่ได้ Setup — ใช้ `/security setup`",
        ephemeral:
          true,
      });

      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(
            config.lockdownActive
              ? 0xed4245
              : config.enabled
                ? 0x57f287
                : 0x747f8d,
          )
          .setTitle(
            "🛡️ NEXORA Security Core",
          )
          .addFields(
            {
              name:
                "Protection",

              value:
                config.enabled
                  ? "🟢 Enabled"
                  : "🔴 Disabled",

              inline:
                true,
            },

            {
              name:
                "Lockdown",

              value:
                config.lockdownActive
                  ? "🚨 ACTIVE"
                  : "🟢 Normal",

              inline:
                true,
            },

            {
              name:
                "Policy",

              value:
                `\`${config.policyVersion ?? NEXORA_SECURITY_POLICY_VERSION}\``,

              inline:
                true,
            },

            {
              name:
                "Trusted Users",

              value:
                `**${config.trustedUserIds?.length ?? 0}**`,

              inline:
                true,
            },

            {
              name:
                "Trusted Roles",

              value:
                `**${config.trustedRoleIds?.length ?? 0}**`,

              inline:
                true,
            },

            {
              name:
                "Security Logs",

              value:
                `<#${config.logChannelId}>`,

              inline:
                true,
            },

            {
              name:
                "⚡ Immediate containment",

              value: [
                "• Unauthorized Bot Add",
                "• Unauthorized Webhook Create",
                "• Dangerous Role Permission Grant",
                "• Dangerous Role assigned to Member",
                "• Discord AutoMod tampering",
              ].join(
                "\n",
              ),
            },

            {
              name:
                `📈 Anti-Nuke Window (${SECURITY_WINDOW_MS / 1000}s)`,

              value: [
                `• Channel delete ×${SECURITY_THRESHOLDS.channelDelete}`,
                `• Role delete ×${SECURITY_THRESHOLDS.roleDelete}`,
                `• Ban ×${SECURITY_THRESHOLDS.memberBan}`,
                `• Kick ×${SECURITY_THRESHOLDS.memberKick}`,
                `• Channel create ×${SECURITY_THRESHOLDS.channelCreate}`,
                `• Role create ×${SECURITY_THRESHOLDS.roleCreate}`,
              ].join(
                "\n",
              ),
            },
          )
          .setFooter({
            text:
              "NEXORA • Anti-Nuke • Incident Response",
          })
          .setTimestamp(),
      ],
      ephemeral:
        true,
    });

    return;
  }

  await interaction.deferReply({
    ephemeral:
      true,
  });

  try {
    if (
      sub ===
      "setup"
    ) {
      const channel =
        interaction.options
          .getChannel(
            "log_channel",
            true,
          );

      const config =
        await securityService
          .setup(
            guild,
            channel.id,
          );

      await interaction.editReply({
        content: [
          "✅ **NEXORA Security Core พร้อมใช้งานแล้ว**",
          "",
          `Logs: <#${config.logChannelId}>`,
          `Policy: \`${NEXORA_SECURITY_POLICY_VERSION}\``,
          "",
          "🚨 Auto Lockdown: ON",
          "🧯 Auto Containment: ON",
          "🤖 Unauthorized Bot Protection: ON",
          "🪝 Unauthorized Webhook Protection: ON",
          "🔐 Permission Escalation Protection: ON",
          "🛡️ AutoMod Tamper Protection: ON",
          "",
          "Server Owner และ NEXORA Bot เป็น Trusted อัตโนมัติ",
          "เพิ่มเฉพาะ Admin ที่ไว้ใจจริงด้วย `/security trust-user` หรือ `/security trust-role`",
        ].join(
          "\n",
        ),
      });

      return;
    }

    if (
      sub ===
      "enable" ||
      sub ===
      "disable"
    ) {
      const enabled =
        sub ===
        "enable";

      await securityService
        .setEnabled(
          guild.id,
          enabled,
        );

      await interaction.editReply({
        content:
          enabled
            ? "✅ เปิด Security Core แล้ว"
            : "⛔ ปิด Security Core แล้ว",
      });

      return;
    }

    if (
      sub ===
      "trust-user"
    ) {
      const user =
        interaction.options
          .getUser(
            "user",
            true,
          );

      const add =
        interaction.options
          .getString(
            "mode",
            true,
          ) ===
        "add";

      await securityService
        .setTrustedUser(
          guild.id,
          user.id,
          add,
        );

      await interaction.editReply({
        content:
          add
            ? `✅ เพิ่ม <@${user.id}> เข้า Trusted Users แล้ว`
            : `✅ นำ <@${user.id}> ออกจาก Trusted Users แล้ว`,
      });

      return;
    }

    if (
      sub ===
      "trust-role"
    ) {
      const role =
        interaction.options
          .getRole(
            "role",
            true,
          );

      const add =
        interaction.options
          .getString(
            "mode",
            true,
          ) ===
        "add";

      await securityService
        .setTrustedRole(
          guild.id,
          role.id,
          add,
        );

      await interaction.editReply({
        content:
          add
            ? `✅ เพิ่ม <@&${role.id}> เข้า Trusted Roles แล้ว`
            : `✅ นำ <@&${role.id}> ออกจาก Trusted Roles แล้ว`,
      });

      return;
    }

    if (
      sub ===
      "lockdown"
    ) {
      const reason =
        interaction.options
          .getString(
            "reason",
          )
          ?.trim() ||
        `Manual lockdown by ${interaction.user.id}`;

      const result =
        await securityService
          .engageLockdown(
            guild,
            reason,
            interaction.user.id,
          );

      await interaction.editReply({
        content:
          `🚨 **Emergency Lockdown ACTIVE**\nLocked/processed **${result.changed}** channel(s).`,
      });

      return;
    }

    if (
      sub ===
      "unlock"
    ) {
      const result =
        await securityService
          .releaseLockdown(
            guild,
            interaction.user.id,
          );

      await interaction.editReply({
        content:
          `🔓 Lockdown released • restored **${result.restored}** channel(s).`,
      });

      return;
    }

    if (
      sub ===
      "incidents"
    ) {
      const incidents =
        await securityService
          .recentIncidents(
            guild.id,
            15,
          );

      const lines =
        incidents.length >
        0
          ? incidents
              .map(
                (
                  incident,
                ) =>
                  `${incident.severity === "critical" ? "🔴" : incident.severity === "high" ? "🟠" : "🟡"} \`${incident.incidentId}\` • **${incident.type}** • ${incident.executorId ? `<@${incident.executorId}>` : "Unknown"} • ${incident.status}`,
              )
              .join(
                "\n",
              )
          : "ยังไม่มี Security Incident";

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(
              0x5865f2,
            )
            .setTitle(
              "🚨 Security Incidents",
            )
            .setDescription(
              lines,
            )
            .setTimestamp(),
        ],
      });

      return;
    }

    if (
      sub ===
      "restore-roles"
    ) {
      const incidentId =
        interaction.options
          .getString(
            "incident_id",
            true,
          )
          .trim()
          .toUpperCase();

      const result =
        await securityService
          .restoreContainedRoles(
            guild,
            incidentId,
            interaction.user.id,
          );

      await interaction.editReply({
        content:
          `✅ Restored **${result.restored.length}** role(s) from \`${incidentId}\``,
      });
    }
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Security operation failed",
    });
  }
}
