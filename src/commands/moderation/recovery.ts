import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  recoveryService,
} from "../../services/community/recoveryService.js";

import {
  NEXORA_RECOVERY_POLICY_VERSION,
  RECOVERY_DEFAULTS,
  type RecoveryMode,
} from "../../community/recovery/recoveryPolicy.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "recovery",
    )
    .setDescription(
      "NEXORA Disaster Recovery / Server Backup",
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
            "ตั้งค่า Disaster Recovery และสร้าง Protected Baseline",
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
                  "ห้องเก็บ Recovery Logs / Backup JSON",
                )
                .addChannelTypes(
                  ChannelType
                    .GuildText,
                )
                .setRequired(
                  true,
                ),
          )
          .addIntegerOption(
            (
              option,
            ) =>
              option
                .setName(
                  "auto_hours",
                )
                .setDescription(
                  "สร้าง Auto Snapshot ทุกกี่ชั่วโมง (default 6)",
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  168,
                ),
          )
          .addIntegerOption(
            (
              option,
            ) =>
              option
                .setName(
                  "retention",
                )
                .setDescription(
                  "เก็บ Auto Snapshot กี่ชุด (default 30)",
                )
                .setMinValue(
                  5,
                )
                .setMaxValue(
                  100,
                ),
          )
          .addBooleanOption(
            (
              option,
            ) =>
              option
                .setName(
                  "external_copies",
                )
                .setDescription(
                  "ส่ง JSON copy เข้า Recovery Log Channel",
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
            "ดูสถานะ Disaster Recovery",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "snapshot",
          )
          .setDescription(
            "สร้าง Manual Snapshot",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "label",
                )
                .setDescription(
                  "ชื่อ/เหตุผลของ Snapshot",
                )
                .setMaxLength(
                  200,
                ),
          )
          .addBooleanOption(
            (
              option,
            ) =>
              option
                .setName(
                  "protected",
                )
                .setDescription(
                  "ป้องกันการถูก Prune/Delete",
                ),
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "list",
          )
          .setDescription(
            "ดู Snapshot ล่าสุด",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "diff",
          )
          .setDescription(
            "เปรียบเทียบเซิร์ฟเวอร์ปัจจุบันกับ Snapshot",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "snapshot_id",
                )
                .setDescription(
                  "เช่น BKP-ABC123",
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
            "restore",
          )
          .setDescription(
            "กู้โครงสร้างจาก Snapshot (ไม่ลบของที่เกินมา)",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "snapshot_id",
                )
                .setDescription(
                  "Snapshot ที่ต้องการกู้",
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
                  "mode",
                )
                .setDescription(
                  "ระดับการ Restore",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  {
                    name:
                      "Missing only — สร้างของที่หาย",

                    value:
                      "missing",
                  },
                  {
                    name:
                      "Permissions — คืน Permission ของของที่ยังอยู่",

                    value:
                      "permissions",
                  },
                  {
                    name:
                      "Repair — Missing + Names + Positions + Permissions",

                    value:
                      "repair",
                  },
                ),
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "confirm",
                )
                .setDescription(
                  "พิมพ์ RESTORE เพื่อยืนยัน",
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
            "export",
          )
          .setDescription(
            "ดาวน์โหลด Snapshot เป็น JSON",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "snapshot_id",
                )
                .setDescription(
                  "Snapshot ID",
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
            "protect",
          )
          .setDescription(
            "Protect / Unprotect Snapshot",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "snapshot_id",
                )
                .setDescription(
                  "Snapshot ID",
                )
                .setRequired(
                  true,
                ),
          )
          .addBooleanOption(
            (
              option,
            ) =>
              option
                .setName(
                  "value",
                )
                .setDescription(
                  "true = protect",
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
            "delete",
          )
          .setDescription(
            "ลบ Snapshot ที่ไม่ได้ Protect",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "snapshot_id",
                )
                .setDescription(
                  "Snapshot ID",
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
                  "confirm",
                )
                .setDescription(
                  "พิมพ์ DELETE เพื่อยืนยัน",
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
            "settings",
          )
          .setDescription(
            "ปรับ Auto Snapshot / Retention",
          )
          .addBooleanOption(
            (
              option,
            ) =>
              option
                .setName(
                  "enabled",
                )
                .setDescription(
                  "เปิด/ปิด Auto Recovery",
                ),
          )
          .addIntegerOption(
            (
              option,
            ) =>
              option
                .setName(
                  "auto_hours",
                )
                .setDescription(
                  "Auto Snapshot ทุกกี่ชั่วโมง",
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  168,
                ),
          )
          .addIntegerOption(
            (
              option,
            ) =>
              option
                .setName(
                  "retention",
                )
                .setDescription(
                  "จำนวน Auto Snapshots ที่เก็บ",
                )
                .setMinValue(
                  5,
                )
                .setMaxValue(
                  100,
                ),
          )
          .addBooleanOption(
            (
              option,
            ) =>
              option
                .setName(
                  "external_copies",
                )
                .setDescription(
                  "ส่ง JSON copy เข้า Recovery Log",
                ),
          ),
    );

function requireGuild(
  interaction:
    ChatInputCommandInteraction,
) {
  if (
    !interaction.inGuild() ||
    !interaction.guild
  ) {
    throw new Error(
      "ใช้ Disaster Recovery ได้เฉพาะในเซิร์ฟเวอร์",
    );
  }

  return interaction.guild;
}

function idOption(
  interaction:
    ChatInputCommandInteraction,
) {
  return interaction.options
    .getString(
      "snapshot_id",
      true,
    )
    .trim()
    .toUpperCase();
}

function formatDate(
  value:
    Date |
    null |
    undefined,
) {
  if (!value) {
    return "-";
  }

  return `<t:${Math.floor(
    value.getTime() /
    1000,
  )}:R>`;
}

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const guild =
    requireGuild(
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
      await recoveryService
        .getConfig(
          guild.id,
        );

    if (!config) {
      await interaction.reply({
        content:
          "ℹ️ Disaster Recovery ยังไม่ได้ Setup — ใช้ `/recovery setup`",
        ephemeral:
          true,
      });

      return;
    }

    const latest =
      await recoveryService
        .list(
          guild.id,
          1,
        );

    const protectedSnapshot =
      await recoveryService
        .latestProtected(
          guild.id,
        );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(
            config.enabled
              ? 0x57f287
              : 0x747f8d,
          )
          .setTitle(
            "💾 NEXORA Disaster Recovery",
          )
          .addFields(
            {
              name:
                "Status",

              value:
                config.enabled
                  ? "🟢 Enabled"
                  : "🔴 Disabled",

              inline:
                true,
            },

            {
              name:
                "Policy",

              value:
                `\`${config.policyVersion ?? NEXORA_RECOVERY_POLICY_VERSION}\``,

              inline:
                true,
            },

            {
              name:
                "Auto Snapshot",

              value:
                `ทุก **${config.autoSnapshotHours}h**`,

              inline:
                true,
            },

            {
              name:
                "Retention",

              value:
                `**${config.retentionCount}** auto snapshots`,

              inline:
                true,
            },

            {
              name:
                "JSON Copies",

              value:
                config.externalCopies
                  ? "✅ Enabled"
                  : "❌ Disabled",

              inline:
                true,
            },

            {
              name:
                "Recovery Log",

              value:
                `<#${config.logChannelId}>`,

              inline:
                true,
            },

            {
              name:
                "Latest Snapshot",

              value:
                latest[0]
                  ? `\`${latest[0].snapshotId}\` • ${formatDate(latest[0].createdAt)}`
                  : "ไม่มี",
            },

            {
              name:
                "Latest Protected Baseline",

              value:
                protectedSnapshot
                  ? `\`${protectedSnapshot.snapshotId}\` • ${formatDate(protectedSnapshot.createdAt)}`
                  : "ไม่มี",
            },

            {
              name:
                "Restore Safety",

              value:
                "ทุก Restore จะสร้าง **Protected pre-restore snapshot** ก่อนเสมอ และระบบ **ไม่ Auto-delete Roles/Channels ที่เกินจาก Backup**",
            },
          )
          .setFooter({
            text:
              "NEXORA • Disaster Recovery",
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

      const result =
        await recoveryService
          .setup(
            guild,
            {
              logChannelId:
                channel.id,

              autoSnapshotHours:
                interaction.options
                  .getInteger(
                    "auto_hours",
                  ) ??
                RECOVERY_DEFAULTS
                  .autoSnapshotHours,

              retentionCount:
                interaction.options
                  .getInteger(
                    "retention",
                  ) ??
                RECOVERY_DEFAULTS
                  .retentionCount,

              externalCopies:
                interaction.options
                  .getBoolean(
                    "external_copies",
                  ) ??
                true,

              actorId:
                interaction.user.id,
            },
          );

      await interaction.editReply({
        content: [
          "✅ **NEXORA Disaster Recovery พร้อมใช้งานแล้ว**",
          "",
          `Initial protected baseline: \`${result.initial.snapshotId}\``,
          `SHA-256: \`${result.initial.hash}\``,
          `Auto Snapshot: ทุก **${result.config.autoSnapshotHours}h**`,
          `Retention: **${result.config.retentionCount}** auto snapshots`,
          `Recovery Log: <#${result.config.logChannelId}>`,
          "",
          "แนะนำให้ใช้ `/recovery export` กับ Protected Baseline แล้วเก็บไฟล์ไว้นอก Discord/MongoDB อีกชุด",
        ].join(
          "\n",
        ),
      });

      return;
    }

    if (
      sub ===
      "snapshot"
    ) {
      const snapshot =
        await recoveryService
          .capture(
            guild,
            {
              type:
                "manual",

              label:
                interaction.options
                  .getString(
                    "label",
                  ) ??
                "Manual snapshot",

              protected:
                interaction.options
                  .getBoolean(
                    "protected",
                  ) ??
                true,

              actorId:
                interaction.user.id,

              sendCopy:
                true,
            },
          );

      await interaction.editReply({
        content: [
          "💾 **Snapshot created**",
          `ID: \`${snapshot.snapshotId}\``,
          `Protected: **${snapshot.protected ? "YES" : "NO"}**`,
          `Roles: **${(snapshot.stats as any)?.roles ?? "?"}**`,
          `Channels: **${(snapshot.stats as any)?.channels ?? "?"}**`,
          `SHA-256: \`${snapshot.hash}\``,
        ].join(
          "\n",
        ),
      });

      return;
    }

    if (
      sub ===
      "list"
    ) {
      const snapshots =
        await recoveryService
          .list(
            guild.id,
            15,
          );

      const lines =
        snapshots.length
          ? snapshots
              .map(
                (
                  snapshot,
                ) =>
                  `${snapshot.protected ? "🔐" : "💾"} \`${snapshot.snapshotId}\` • **${snapshot.type}** • ${snapshot.label ?? "No label"} • ${formatDate(snapshot.createdAt)}`,
              )
              .join(
                "\n",
              )
          : "ยังไม่มี Snapshot";

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(
              0x5865f2,
            )
            .setTitle(
              "💾 Recovery Snapshots",
            )
            .setDescription(
              lines,
            )
            .setFooter({
              text:
                "🔐 = protected",
            })
            .setTimestamp(),
        ],
      });

      return;
    }

    if (
      sub ===
      "diff"
    ) {
      const diff =
        await recoveryService
          .diff(
            guild,
            idOption(
              interaction,
            ),
          );

      await interaction.editReply({
        embeds: [
          recoveryService
            .summaryEmbed(
              diff,
            ),
        ],
      });

      return;
    }

    if (
      sub ===
      "restore"
    ) {
      const confirm =
        interaction.options
          .getString(
            "confirm",
            true,
          );

      if (
        confirm !==
        "RESTORE"
      ) {
        throw new Error(
          "ยืนยันไม่ถูกต้อง — ต้องพิมพ์ `RESTORE` ตัวพิมพ์ใหญ่",
        );
      }

      const mode =
        interaction.options
          .getString(
            "mode",
            true,
          ) as
            RecoveryMode;

      const report =
        await recoveryService
          .restore(
            guild,
            {
              snapshotId:
                idOption(
                  interaction,
                ),

              mode,

              actorId:
                interaction.user.id,
            },
          );

      await interaction.editReply({
        content: [
          "🧯 **Recovery completed**",
          `Source: \`${report.snapshotId}\``,
          `Mode: **${report.mode}**`,
          `Pre-restore backup: \`${report.preRestoreSnapshotId}\` 🔐`,
          "",
          `Created Roles: **${report.createdRoles.length}**`,
          `Created Channels: **${report.createdChannels.length}**`,
          `Updated Roles: **${report.updatedRoles.length}**`,
          `Updated Channels: **${report.updatedChannels.length}**`,
          `Warnings: **${report.warnings.length}**`,
          report.warnings.length
            ? `\n⚠️ ${report.warnings.slice(0, 8).join("\n⚠️ ")}`
            : "",
          "",
          "ระบบไม่ได้ลบ Roles/Channels ที่เกินจาก Snapshot อัตโนมัติ",
        ].join(
          "\n",
        ),
      });

      return;
    }

    if (
      sub ===
      "export"
    ) {
      const snapshot =
        await recoveryService
          .getSnapshot(
            guild.id,
            idOption(
              interaction,
            ),
          );

      await interaction.editReply({
        content: [
          `💾 Snapshot \`${snapshot.snapshotId}\``,
          `SHA-256: \`${snapshot.hash}\``,
          "",
          "เก็บไฟล์นี้ไว้นอก Discord/MongoDB อีกชุดเพื่อ Disaster Recovery ที่แข็งแรงขึ้น",
        ].join(
          "\n",
        ),

        files: [
          recoveryService
            .exportAttachment(
              snapshot,
            ),
        ],
      });

      return;
    }

    if (
      sub ===
      "protect"
    ) {
      const snapshot =
        await recoveryService
          .setProtected(
            guild.id,
            idOption(
              interaction,
            ),
            interaction.options
              .getBoolean(
                "value",
                true,
              ),
          );

      await interaction.editReply({
        content:
          `${snapshot.protected ? "🔐 Protected" : "🔓 Unprotected"} \`${snapshot.snapshotId}\``,
      });

      return;
    }

    if (
      sub ===
      "delete"
    ) {
      const confirm =
        interaction.options
          .getString(
            "confirm",
            true,
          );

      if (
        confirm !==
        "DELETE"
      ) {
        throw new Error(
          "ยืนยันไม่ถูกต้อง — ต้องพิมพ์ `DELETE` ตัวพิมพ์ใหญ่",
        );
      }

      const snapshot =
        await recoveryService
          .deleteSnapshot(
            guild.id,
            idOption(
              interaction,
            ),
          );

      await interaction.editReply({
        content:
          `🗑️ Deleted \`${snapshot.snapshotId}\``,
      });

      return;
    }

    if (
      sub ===
      "settings"
    ) {
      const config =
        await recoveryService
          .updateConfig(
            guild.id,
            {
              enabled:
                interaction.options
                  .getBoolean(
                    "enabled",
                  ) ??
                undefined,

              autoSnapshotHours:
                interaction.options
                  .getInteger(
                    "auto_hours",
                  ) ??
                undefined,

              retentionCount:
                interaction.options
                  .getInteger(
                    "retention",
                  ) ??
                undefined,

              externalCopies:
                interaction.options
                  .getBoolean(
                    "external_copies",
                  ) ??
                undefined,
            },
          );

      await interaction.editReply({
        content: [
          "✅ Recovery settings updated",
          `Enabled: **${config.enabled ? "YES" : "NO"}**`,
          `Auto: **${config.autoSnapshotHours}h**`,
          `Retention: **${config.retentionCount}**`,
          `JSON copies: **${config.externalCopies ? "YES" : "NO"}**`,
        ].join(
          "\n",
        ),
      });
    }
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Recovery operation failed",
    });
  }
}
