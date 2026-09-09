import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  autoModService,
} from "../../services/community/autoModService.js";

import {
  AUTO_MOD_LIMITS,
  AUTO_MOD_RULE_LABELS,
  NEXORA_AUTOMOD_POLICY_VERSION,
  RULES_AUTOMOD_MAPPING,
} from "../../community/automod/autoModPolicy.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "automod",
    )
    .setDescription(
      "จัดการ NEXORA AutoMod ตามกฎคอมมิวนิตี",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits
        .ManageGuild
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
            "ตั้งค่าและสร้าง AutoMod Rules",
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
                  "ห้องแจ้งเตือน AutoMod",
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
            "ดูสถานะ AutoMod",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "sync",
          )
          .setDescription(
            "Sync กฎ NEXORA ไปยัง Discord AutoMod",
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
            "เปิด AutoMod",
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
            "ปิด AutoMod Rules ของ NEXORA",
          ),
    )

    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "promo-channel",
          )
          .setDescription(
            "กำหนดห้องที่อนุญาต Discord Invite/โปรโมต",
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
                  "เพิ่มหรือลบ",
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
          .addChannelOption(
            (
              option,
            ) =>
              option
                .setName(
                  "channel",
                )
                .setDescription(
                  "ห้องที่อนุญาต",
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
            "exempt-channel",
          )
          .setDescription(
            "ยกเว้น Channel จาก AutoMod ทั้งชุด",
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
                  "เพิ่มหรือลบ",
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
          .addChannelOption(
            (
              option,
            ) =>
              option
                .setName(
                  "channel",
                )
                .setDescription(
                  "Channel",
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
            "exempt-role",
          )
          .setDescription(
            "ยกเว้น Role จาก AutoMod ทั้งชุด",
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
                  "เพิ่มหรือลบ",
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
                  "Role",
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
            "keyword",
          )
          .setDescription(
            "เพิ่ม/ลบคำหรือวลีที่ต้องการ Block เพิ่มเติม",
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
                  "เพิ่มหรือลบ",
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
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "value",
                )
                .setDescription(
                  "คำหรือวลี (สูงสุด 58 ตัวอักษร)",
                )
                .setMinLength(
                  2,
                )
                .setMaxLength(
                  58,
                )
                .setRequired(
                  true,
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
      "ใช้ AutoMod ได้เฉพาะในเซิร์ฟเวอร์",
    );
  }

  return interaction.guild;
}

function modeIsAdd(
  interaction:
    ChatInputCommandInteraction,
) {
  return (
    interaction.options
      .getString(
        "mode",
        true,
      ) ===
    "add"
  );
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
      await autoModService
        .getConfig(
          guild.id,
        );

    if (!config) {
      await interaction.reply({
        content:
          "ℹ️ AutoMod ยังไม่ได้ Setup — ใช้ `/automod setup`",
        ephemeral:
          true,
      });

      return;
    }

    const ruleIds =
      config.discordRuleIds &&
      typeof config
        .discordRuleIds ===
        "object"
        ? Object.keys(
            config.discordRuleIds as
              Record<
                string,
                string
              >,
          )
        : [];

    const automatic =
      RULES_AUTOMOD_MAPPING
        .filter(
          (
            entry,
          ) =>
            entry.automatic,
        )
        .map(
          (
            entry,
          ) =>
            `• กฎ ${entry.rules.join(", ")} → ${entry.feature}`,
        )
        .join(
          "\n",
        );

    const manual =
      RULES_AUTOMOD_MAPPING
        .filter(
          (
            entry,
          ) =>
            !entry.automatic,
        )
        .map(
          (
            entry,
          ) =>
            `• กฎ ${entry.rules.join(", ")} → ${entry.feature}`,
        )
        .join(
          "\n",
        );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(
            config.enabled
              ? 0x57f287
              : 0xed4245,
          )
          .setTitle(
            "🛡️ NEXORA AutoMod",
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
                `\`${config.policyVersion ?? NEXORA_AUTOMOD_POLICY_VERSION}\``,

              inline:
                true,
            },

            {
              name:
                "Discord Rules",

              value:
                `**${ruleIds.length}** managed rule(s)`,

              inline:
                true,
            },

            {
              name:
                "📨 Log",

              value:
                `<#${config.logChannelId}>`,

              inline:
                true,
            },

            {
              name:
                "📢 Promo Channels",

              value:
                config.promoChannelIds
                  ?.length
                  ? config.promoChannelIds
                      .map(
                        (
                          id,
                        ) =>
                          `<#${id}>`,
                      )
                      .join(
                        ", ",
                      )
                  : "ไม่มี",

              inline:
                true,
            },

            {
              name:
                "🧩 Custom Keywords",

              value:
                `**${config.customKeywords?.length ?? 0}**`,

              inline:
                true,
            },

            {
              name:
                "⚙️ Automated",

              value:
                automatic,
            },

            {
              name:
                "👮 Needs context / staff review",

              value:
                manual,
            },

            {
              name:
                "📈 Escalation",

              value: [
                `• ${AUTO_MOD_LIMITS.recentViolationsForTimeout} violations / 10m → Timeout ${AUTO_MOD_LIMITS.repeatTimeoutMinutes}m`,
                `• ${AUTO_MOD_LIMITS.dayViolationsForTimeout} violations / 24h → Timeout ${AUTO_MOD_LIMITS.dayTimeoutMinutes}m`,
                `• Phishing/Malware high-confidence → Timeout ${AUTO_MOD_LIMITS.severeTimeoutMinutes}m`,
                `• AutoMod never auto-kicks/bans; staff decides Level 4–6`,
              ].join(
                "\n",
              ),
            },
          )
          .setFooter({
            text:
              "NEXORA • Community Rules Enforcement",
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
        await autoModService
          .setup(
            guild,
            channel.id,
            interaction.user.id,
          );

      await interaction.editReply({
        content: [
          "✅ **NEXORA AutoMod พร้อมใช้งานแล้ว**",
          "",
          `Logs: <#${config.logChannelId}>`,
          `Policy: \`${NEXORA_AUTOMOD_POLICY_VERSION}\``,
          "",
          "สร้างกฎตาม Community Rules แล้ว:",
          `• ${AUTO_MOD_RULE_LABELS.spam}`,
          `• ${AUTO_MOD_RULE_LABELS.mentionSpam}`,
          `• ${AUTO_MOD_RULE_LABELS.unsafeContent}`,
          `• ${AUTO_MOD_RULE_LABELS.invites}`,
          `• ${AUTO_MOD_RULE_LABELS.security}`,
          "",
          "📢 ถ้ามีห้องโปรโมต ให้ใช้ `/automod promo-channel` เพิ่มห้องนั้น",
        ].join(
          "\n",
        ),
      });

      return;
    }

    if (
      sub ===
      "sync"
    ) {
      const result =
        await autoModService
          .sync(
            guild,
            interaction.user.id,
          );

      await interaction.editReply({
        content:
          `✅ Sync AutoMod แล้ว **${result.count} rule(s)**`,
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

      const result =
        await autoModService
          .setEnabled(
            guild,
            enabled,
            interaction.user.id,
          );

      await interaction.editReply({
        content:
          enabled
            ? `✅ เปิด AutoMod แล้ว • ${result.count} rule(s)`
            : `⛔ ปิด NEXORA AutoMod Rules แล้ว • ${result.count} rule(s)`,
      });

      return;
    }

    if (
      sub ===
      "promo-channel"
    ) {
      const channel =
        interaction.options
          .getChannel(
            "channel",
            true,
          );

      const add =
        modeIsAdd(
          interaction,
        );

      await autoModService
        .setPromoChannel(
          guild,
          channel.id,
          add,
          interaction.user.id,
        );

      await interaction.editReply({
        content:
          add
            ? `✅ <#${channel.id}> เป็นพื้นที่ที่อนุญาต Invite/โปรโมตแล้ว`
            : `✅ นำ <#${channel.id}> ออกจากพื้นที่โปรโมตแล้ว`,
      });

      return;
    }

    if (
      sub ===
      "exempt-channel"
    ) {
      const channel =
        interaction.options
          .getChannel(
            "channel",
            true,
          );

      const add =
        modeIsAdd(
          interaction,
        );

      await autoModService
        .setExemptChannel(
          guild,
          channel.id,
          add,
          interaction.user.id,
        );

      await interaction.editReply({
        content:
          add
            ? `⚠️ ยกเว้น <#${channel.id}> จาก AutoMod ทั้งชุดแล้ว`
            : `✅ นำข้อยกเว้นของ <#${channel.id}> ออกแล้ว`,
      });

      return;
    }

    if (
      sub ===
      "exempt-role"
    ) {
      const role =
        interaction.options
          .getRole(
            "role",
            true,
          );

      const add =
        modeIsAdd(
          interaction,
        );

      await autoModService
        .setExemptRole(
          guild,
          role.id,
          add,
          interaction.user.id,
        );

      await interaction.editReply({
        content:
          add
            ? `⚠️ ยกเว้น <@&${role.id}> จาก AutoMod ทั้งชุดแล้ว`
            : `✅ นำข้อยกเว้นของ <@&${role.id}> ออกแล้ว`,
      });

      return;
    }

    if (
      sub ===
      "keyword"
    ) {
      const value =
        interaction.options
          .getString(
            "value",
            true,
          );

      const add =
        modeIsAdd(
          interaction,
        );

      const config =
        await autoModService
          .setKeyword(
            guild,
            value,
            add,
            interaction.user.id,
          );

      await interaction.editReply({
        content:
          add
            ? `✅ เพิ่ม Keyword \`${value}\` แล้ว • ทั้งหมด ${config.customKeywords?.length ?? 0}`
            : `✅ ลบ Keyword \`${value}\` แล้ว • เหลือ ${config.customKeywords?.length ?? 0}`,
      });

      return;
    }
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ AutoMod operation failed",
    });
  }
}
