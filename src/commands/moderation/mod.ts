import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";

import {
  moderationService,
} from "../../services/community/moderationService.js";

function reason(
  interaction:
    ChatInputCommandInteraction,
) {
  return (
    interaction.options
      .getString(
        "reason",
      )
      ?.trim() ||
    "ไม่ระบุเหตุผล"
  );
}

function requirePermission(
  interaction:
    ChatInputCommandInteraction,

  permission:
    bigint,
) {
  return (
    interaction
      .memberPermissions
      ?.has(
        PermissionFlagsBits
          .Administrator,
      ) ===
      true ||
    interaction
      .memberPermissions
      ?.has(
        permission,
      ) ===
      true
  );
}

function assertHierarchy(
  interaction:
    ChatInputCommandInteraction,

  target:
    GuildMember,
): void {
  const guild =
    interaction.guild!;

  const executor =
    interaction.member as
      GuildMember;

  const bot =
    guild.members.me;

  if (
    target.id ===
    interaction.user.id
  ) {
    throw new Error(
      "ไม่สามารถ Moderation ตัวเองได้",
    );
  }

  if (
    target.id ===
    guild.ownerId
  ) {
    throw new Error(
      "ไม่สามารถ Moderation Server Owner ได้",
    );
  }

  if (
    interaction.user.id !==
      guild.ownerId &&
    target.roles.highest
      .position >=
      executor.roles.highest
        .position
  ) {
    throw new Error(
      "Role ของสมาชิกคนนี้สูงกว่าหรือเท่ากับคุณ",
    );
  }

  if (
    bot &&
    target.roles.highest
      .position >=
      bot.roles.highest
        .position
  ) {
    throw new Error(
      "Role ของ NEXORA ต้องอยู่สูงกว่า Role ของสมาชิกเป้าหมาย",
    );
  }
}

async function fetchTargetMember(
  interaction:
    ChatInputCommandInteraction,
) {
  const user =
    interaction.options
      .getUser(
        "user",
        true,
      );

  const member =
    await interaction.guild!
      .members
      .fetch(
        user.id,
      );

  assertHierarchy(
    interaction,
    member,
  );

  return {
    user,
    member,
  };
}

export const data =
  new SlashCommandBuilder()
    .setName(
      "mod",
    )
    .setDescription(
      "NEXORA moderation",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits
        .ModerateMembers
        .toString(),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "warn",
          )
          .setDescription(
            "เตือนสมาชิก",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
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
        c,
      ) =>
        c
          .setName(
            "warnings",
          )
          .setDescription(
            "ดู Warning ของสมาชิก",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                )
                .setRequired(
                  true,
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "clear-warning",
          )
          .setDescription(
            "ยกเลิก Warning Case",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "case_id",
                )
                .setDescription(
                  "Moderation Case ID",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "reason",
                )
                .setDescription(
                  "เหตุผล",
                )
                .setRequired(
                  true,
                )
                .setMaxLength(
                  1000,
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "timeout",
          )
          .setDescription(
            "Timeout สมาชิก",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                )
                .setRequired(
                  true,
                ),
          )
          .addIntegerOption(
            (
              o,
            ) =>
              o
                .setName(
                  "minutes",
                )
                .setDescription(
                  "จำนวนนาที",
                )
                .setRequired(
                  true,
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  40320,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
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
        c,
      ) =>
        c
          .setName(
            "untimeout",
          )
          .setDescription(
            "ยกเลิก Timeout",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
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
        c,
      ) =>
        c
          .setName(
            "kick",
          )
          .setDescription(
            "เตะสมาชิก",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
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
        c,
      ) =>
        c
          .setName(
            "ban",
          )
          .setDescription(
            "แบนสมาชิก",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
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
        c,
      ) =>
        c
          .setName(
            "unban",
          )
          .setDescription(
            "ปลดแบน User ID",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user_id",
                )
                .setDescription(
                  "Discord User ID",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
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
        c,
      ) =>
        c
          .setName(
            "history",
          )
          .setDescription(
            "ดูประวัติ Moderation",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "purge",
          )
          .setDescription(
            "ลบข้อความจำนวนมาก",
          )
          .addIntegerOption(
            (
              o,
            ) =>
              o
                .setName(
                  "amount",
                )
                .setDescription(
                  "จำนวนข้อความ",
                )
                .setRequired(
                  true,
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  100,
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "slowmode",
          )
          .setDescription(
            "ตั้ง Slowmode",
          )
          .addIntegerOption(
            (
              o,
            ) =>
              o
                .setName(
                  "seconds",
                )
                .setDescription(
                  "0 เพื่อปิด",
                )
                .setRequired(
                  true,
                )
                .setMinValue(
                  0,
                )
                .setMaxValue(
                  21600,
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "lock",
          )
          .setDescription(
            "ล็อกห้องปัจจุบัน",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "unlock",
          )
          .setDescription(
            "ปลดล็อกห้องปัจจุบัน",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.inGuild() ||
    !interaction.guild
  ) {
    await interaction.reply({
      content:
        "❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์",

      ephemeral:
        true,
    });

    return;
  }

  const sub =
    interaction.options
      .getSubcommand();

  if (
    sub ===
    "warnings"
  ) {
    const user =
      interaction.options
        .getUser(
          "user",
          true,
        );

    const warnings =
      await moderationService
        .getActiveWarnings(
          interaction.guildId,
          user.id,
        );

    const lines =
      warnings.length
        ? warnings
            .map(
              (
                warning,
              ) =>
                `• \`${warning.caseId}\` — ${warning.reason}`,
            )
            .join(
              "\n",
            )
        : "ไม่มี Warning ที่ active";

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `⚠️ Warnings — ${user.username}`,
          )
          .setDescription(
            lines,
          )
          .setTimestamp(),
      ],

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
    "clear-warning"
  ) {
    const result =
      await moderationService
        .clearWarning({
          guildId:
            interaction.guildId,

          caseId:
            interaction.options
              .getString(
                "case_id",
                true,
              ),

          moderatorId:
            interaction.user.id,

          reason:
            reason(
              interaction,
            ),
        });

    await interaction.reply({
      content:
        `✅ ยกเลิก Warning \`${result.warning.caseId}\` แล้ว`,

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
    "history"
  ) {
    const target =
      interaction.options
        .getUser(
          "user",
        );

    const history =
      await moderationService
        .getHistory(
          interaction.guildId,
          target?.id,
          10,
        );

    const lines =
      history.length
        ? history
            .map(
              (
                item,
              ) =>
                `\`${item.caseId ?? "-"}\` • **${item.action}** • <@${item.targetUserId}> • ${item.reason}`,
            )
            .join(
              "\n",
            )
        : "ยังไม่มีประวัติ";

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🛡️ Moderation History",
          )
          .setDescription(
            lines,
          )
          .setTimestamp(),
      ],

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
    "purge"
  ) {
    if (
      !requirePermission(
        interaction,
        PermissionFlagsBits
          .ManageMessages,
      )
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ Manage Messages",
      );
    }

    const amount =
      interaction.options
        .getInteger(
          "amount",
          true,
        );

    const channel =
      interaction.channel;

    if (
      !channel ||
      !(
        "bulkDelete" in
        channel
      )
    ) {
      throw new Error(
        "ห้องนี้ไม่รองรับ Purge",
      );
    }

    const deleted =
      await (
        channel as any
      ).bulkDelete(
        amount,
        true,
      );

    const audit =
      await moderationService
        .createCase({
          guildId:
            interaction.guildId,

          targetUserId:
            `CHANNEL:${interaction.channelId}`,

          moderatorId:
            interaction.user.id,

          action:
            "purge",

          reason:
            `Purge ${deleted.size} messages`,

          metadata: {
            channelId:
              interaction.channelId,

            amount:
              deleted.size,
          },
        });

    await interaction.reply({
      content:
        `🧹 ลบ **${deleted.size}** ข้อความแล้ว • Case \`${audit.caseId}\``,

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
      "slowmode" ||
    sub ===
      "lock" ||
    sub ===
      "unlock"
  ) {
    if (
      !requirePermission(
        interaction,
        PermissionFlagsBits
          .ManageChannels,
      )
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ Manage Channels",
      );
    }

    const channel:
      any =
        interaction.channel;

    if (
      !channel
    ) {
      throw new Error(
        "ไม่พบ Channel",
      );
    }

    if (
      sub ===
      "slowmode"
    ) {
      if (
        typeof channel
          .setRateLimitPerUser !==
        "function"
      ) {
        throw new Error(
          "ห้องนี้ไม่รองรับ Slowmode",
        );
      }

      const seconds =
        interaction.options
          .getInteger(
            "seconds",
            true,
          );

      await channel
        .setRateLimitPerUser(
          seconds,
          `Changed by ${interaction.user.id}`,
        );

      await moderationService
        .createCase({
          guildId:
            interaction.guildId,

          targetUserId:
            `CHANNEL:${interaction.channelId}`,

          moderatorId:
            interaction.user.id,

          action:
            "slowmode",

          reason:
            `${seconds} seconds`,
        });

      await interaction.reply({
        content:
          `🐢 Slowmode = **${seconds}s**`,

        ephemeral:
          true,
      });

      return;
    }

    if (
      !channel
        .permissionOverwrites
    ) {
      throw new Error(
        "ห้องนี้ไม่รองรับ Permission Overwrites",
      );
    }

    const locked =
      sub ===
      "lock";

    await channel
      .permissionOverwrites
      .edit(
        interaction.guild
          .roles
          .everyone,
        {
          SendMessages:
            locked
              ? false
              : null,
        },
        {
          reason:
            `${sub} by ${interaction.user.id}`,
        },
      );

    await moderationService
      .createCase({
        guildId:
          interaction.guildId,

        targetUserId:
          `CHANNEL:${interaction.channelId}`,

        moderatorId:
          interaction.user.id,

        action:
          locked
            ? "lock"
            : "unlock",

        reason:
          reason(
            interaction,
          ),
      });

    await interaction.reply({
      content:
        locked
          ? "🔒 ล็อกห้องแล้ว"
          : "🔓 ปลดล็อกห้องแล้ว",

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
    "unban"
  ) {
    if (
      !requirePermission(
        interaction,
        PermissionFlagsBits
          .BanMembers,
      )
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ Ban Members",
      );
    }

    const userId =
      interaction.options
        .getString(
          "user_id",
          true,
        )
        .trim();

    await interaction.guild
      .members
      .unban(
        userId,
        reason(
          interaction,
        ),
      );

    const audit =
      await moderationService
        .createCase({
          guildId:
            interaction.guildId,

          targetUserId:
            userId,

          moderatorId:
            interaction.user.id,

          action:
            "unban",

          reason:
            reason(
              interaction,
            ),
        });

    await interaction.reply({
      content:
        `✅ ปลดแบน <@${userId}> • Case \`${audit.caseId}\``,

      ephemeral:
        true,
    });

    return;
  }

  const {
    user,
    member,
  } =
    await fetchTargetMember(
      interaction,
    );

  if (
    sub ===
    "warn"
  ) {
    const audit =
      await moderationService
        .createCase({
          guildId:
            interaction.guildId,

          targetUserId:
            user.id,

          moderatorId:
            interaction.user.id,

          action:
            "warn",

          reason:
            reason(
              interaction,
            ),
        });

    await interaction.reply({
      content:
        `⚠️ เตือน <@${user.id}> แล้ว • Case \`${audit.caseId}\``,

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
      "timeout" ||
    sub ===
      "untimeout"
  ) {
    if (
      !requirePermission(
        interaction,
        PermissionFlagsBits
          .ModerateMembers,
      )
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ Moderate Members",
      );
    }

    if (
      !member.moderatable
    ) {
      throw new Error(
        "NEXORA ไม่สามารถ Timeout สมาชิกคนนี้ได้",
      );
    }

    const minutes =
      sub ===
      "timeout"
        ? interaction.options
            .getInteger(
              "minutes",
              true,
            )
        : null;

    await member.timeout(
      minutes
        ? minutes *
          60_000
        : null,

      reason(
        interaction,
      ),
    );

    const audit =
      await moderationService
        .createCase({
          guildId:
            interaction.guildId,

          targetUserId:
            user.id,

          moderatorId:
            interaction.user.id,

          action:
            sub,

          reason:
            reason(
              interaction,
            ),

          duration:
            minutes
              ? minutes *
                60_000
              : null,
        });

    await interaction.reply({
      content:
        `${sub === "timeout" ? "⏳ Timeout" : "✅ ยกเลิก Timeout"} <@${user.id}> • Case \`${audit.caseId}\``,

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
    "kick"
  ) {
    if (
      !requirePermission(
        interaction,
        PermissionFlagsBits
          .KickMembers,
      )
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ Kick Members",
      );
    }

    if (
      !member.kickable
    ) {
      throw new Error(
        "NEXORA ไม่สามารถ Kick สมาชิกคนนี้ได้",
      );
    }

    const audit =
      await moderationService
        .createCase({
          guildId:
            interaction.guildId,

          targetUserId:
            user.id,

          moderatorId:
            interaction.user.id,

          action:
            "kick",

          reason:
            reason(
              interaction,
            ),
        });

    await member.kick(
      reason(
        interaction,
      ),
    );

    await interaction.reply({
      content:
        `👢 Kick <@${user.id}> แล้ว • Case \`${audit.caseId}\``,

      ephemeral:
        true,
    });

    return;
  }

  if (
    sub ===
    "ban"
  ) {
    if (
      !requirePermission(
        interaction,
        PermissionFlagsBits
          .BanMembers,
      )
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ Ban Members",
      );
    }

    if (
      !member.bannable
    ) {
      throw new Error(
        "NEXORA ไม่สามารถ Ban สมาชิกคนนี้ได้",
      );
    }

    const audit =
      await moderationService
        .createCase({
          guildId:
            interaction.guildId,

          targetUserId:
            user.id,

          moderatorId:
            interaction.user.id,

          action:
            "ban",

          reason:
            reason(
              interaction,
            ),
        });

    await member.ban({
      reason:
        reason(
          interaction,
        ),
    });

    await interaction.reply({
      content:
        `🔨 Ban <@${user.id}> แล้ว • Case \`${audit.caseId}\``,

      ephemeral:
        true,
    });
  }
}
