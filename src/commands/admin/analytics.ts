import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  analyticsService,
  type AnalyticsPeriod,
} from "../../services/analyticsService.js";

function addPeriodOption(
  command:
    any,
) {
  return command
    .addStringOption(
      (
        option:
          any,
      ) =>
        option
          .setName(
            "period",
          )
          .setDescription(
            "ช่วงเวลาที่ต้องการดู",
          )
          .addChoices(
            {
              name:
                "วันนี้",

              value:
                "today",
            },

            {
              name:
                "7 วัน",

              value:
                "7d",
            },

            {
              name:
                "30 วัน",

              value:
                "30d",
            },
          ),
    );
}

export const data =
  new SlashCommandBuilder()
    .setName(
      "analytics",
    )
    .setDescription(
      "ดู Analytics ของ NEXORA",
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
        addPeriodOption(
          command
            .setName(
              "overview",
            )
            .setDescription(
              "ภาพรวมเซิร์ฟเวอร์",
            ),
        ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        addPeriodOption(
          command
            .setName(
              "activity",
            )
            .setDescription(
              "สถิติข้อความและสมาชิกที่ active",
            ),
        ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        addPeriodOption(
          command
            .setName(
              "marketplace",
            )
            .setDescription(
              "สถิติ Marketplace v2",
            ),
        ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        addPeriodOption(
          command
            .setName(
              "operations",
            )
            .setDescription(
              "Tickets, Moderation, Giveaway, RPG และระบบ",
            ),
        ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "history",
          )
          .setDescription(
            "ดู Daily Analytics snapshots",
          )
          .addIntegerOption(
            (
              option,
            ) =>
              option
                .setName(
                  "days",
                )
                .setDescription(
                  "จำนวนวันที่ต้องการดู",
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  30,
                ),
          ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "refresh",
          )
          .setDescription(
            "บันทึก Analytics snapshot ล่าสุดทันที",
          ),
    );

function periodLabel(
  period:
    AnalyticsPeriod,
): string {
  if (
    period ===
    "today"
  ) {
    return "วันนี้";
  }

  if (
    period ===
    "30d"
  ) {
    return "30 วัน";
  }

  return "7 วัน";
}

function number(
  value:
    number,
): string {
  return value
    .toLocaleString(
      "th-TH",
    );
}

function percent(
  value:
    number,
): string {
  return `${value.toFixed(
    1,
  )}%`;
}

function field(
  name:
    string,

  lines:
    string[],
) {
  return {
    name,

    value:
      lines.join(
        "\n",
      ) ||
      "-",
  };
}

function resolvePeriod(
  interaction:
    ChatInputCommandInteraction,
): AnalyticsPeriod {
  const value =
    interaction.options
      .getString(
        "period",
      );

  if (
    value ===
      "today" ||
    value ===
      "30d"
  ) {
    return value;
  }

  return "7d";
}

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
        "❌ ใช้คำสั่งนี้ได้เฉพาะในเซิร์ฟเวอร์",

      ephemeral:
        true,
    });

    return;
  }

  await interaction.deferReply({
    ephemeral:
      true,
  });

  const subcommand =
    interaction.options
      .getSubcommand();

  if (
    subcommand ===
    "refresh"
  ) {
    const snapshot =
      await analyticsService
        .captureSnapshot(
          interaction.guild,
        );

    await interaction.editReply({
      content: [
        "✅ **Analytics snapshot updated**",
        `📅 Date: \`${snapshot.dateKey}\``,
        `🕒 ${snapshot.capturedAt.toLocaleString(
          "th-TH",
          {
            timeZone:
              "Asia/Bangkok",
          },
        )}`,
      ].join(
        "\n",
      ),
    });

    return;
  }

  if (
    subcommand ===
    "history"
  ) {
    const days =
      interaction.options
        .getInteger(
          "days",
        ) ??
      7;

    const snapshots =
      await analyticsService
        .getHistory(
          interaction.guild.id,
          days,
        );

    if (
      snapshots.length ===
      0
    ) {
      await interaction.editReply({
        content:
          "📊 ยังไม่มี Daily Analytics snapshot",
      });

      return;
    }

    const lines =
      snapshots
        .map(
          (
            snapshot:
              any,
          ) => {
            const metrics =
              snapshot.metrics ??
              {};

            return [
              `**${snapshot.dateKey}**`,
              `└ 💬 ${number(
                Number(
                  metrics.activity
                    ?.messages ??
                  0,
                ),
              )} msgs`,
              ` • 👥 ${number(
                Number(
                  metrics.activity
                    ?.activeMembers ??
                  0,
                ),
              )} active`,
              ` • 🤝 ${number(
                Number(
                  metrics.marketplace
                    ?.completed ??
                  0,
                ),
              )} trades`,
              ` • ⚔️ ${number(
                Number(
                  metrics.dungeons
                    ?.runs ??
                  0,
                ),
              )} runs`,
            ].join(
              "",
            );
          },
        )
        .join(
          "\n\n",
        );

    const embed =
      new EmbedBuilder()
        .setColor(
          0x5338e8,
        )
        .setTitle(
          "📈 NEXORA Analytics History",
        )
        .setDescription(
          lines,
        )
        .setFooter({
          text:
            "Asia/Bangkok • Snapshot อัปเดตทุกชั่วโมง",
        })
        .setTimestamp();

    await interaction.editReply({
      embeds: [
        embed,
      ],
    });

    return;
  }

  const period =
    resolvePeriod(
      interaction,
    );

  const metrics =
    await analyticsService
      .aggregate(
        interaction.guild,
        period,
      );

  if (
    subcommand ===
    "overview"
  ) {
    const activityRate =
      metrics.server
        .memberCount >
      0
        ? (
            metrics.activity
              .activeMembers /
            metrics.server
              .memberCount
          ) *
          100
        : 0;

    const embed =
      new EmbedBuilder()
        .setColor(
          0x5338e8,
        )
        .setTitle(
          "📊 NEXORA Analytics • Overview",
        )
        .setDescription(
          `ช่วงเวลา: **${periodLabel(
            period,
          )}**`,
        )
        .addFields(
          field(
            "👥 Community",
            [
              `สมาชิก: **${number(
                metrics.server
                  .memberCount,
              )}**`,
              `Active: **${number(
                metrics.activity
                  .activeMembers,
              )}** (${percent(
                activityRate,
              )})`,
              `ข้อความ: **${number(
                metrics.activity
                  .messages,
              )}**`,
            ],
          ),

          field(
            "🤝 Marketplace",
            [
              `Trade Requests: **${number(
                metrics.marketplace
                  .created,
              )}**`,
              `Completed: **${number(
                metrics.marketplace
                  .completed,
              )}**`,
              `Completion: **${percent(
                metrics.marketplace
                  .completionRate,
              )}**`,
              `Active ตอนนี้: **${number(
                metrics.marketplace
                  .active,
              )}**`,
            ],
          ),

          field(
            "🎫 Operations",
            [
              `Tickets ใหม่: **${number(
                metrics.tickets
                  .created,
              )}**`,
              `Tickets ปิด: **${number(
                metrics.tickets
                  .closed,
              )}**`,
              `Moderation: **${number(
                metrics.moderation
                  .total,
              )}**`,
              `System Errors: **${number(
                metrics.system
                  .errors,
              )}**`,
            ],
          ),

          field(
            "🎉 Engagement",
            [
              `Giveaways: **${number(
                metrics.giveaways
                  .created,
              )}**`,
              `Entries: **${number(
                metrics.giveaways
                  .entrants,
              )}**`,
              `Dungeon Runs: **${number(
                metrics.dungeons
                  .runs,
              )}**`,
              `RPG Players: **${number(
                metrics.dungeons
                  .players,
              )}**`,
            ],
          ),
        )
        .setFooter({
          text:
            `NEXORA Analytics • ${metrics.server.channels} channels • ${metrics.server.roles} roles`,
        })
        .setTimestamp();

    await interaction.editReply({
      embeds: [
        embed,
      ],
    });

    return;
  }

  if (
    subcommand ===
    "activity"
  ) {
    const top =
      metrics.activity
        .topMembers.length >
      0
        ? metrics.activity
            .topMembers
            .map(
              (
                item,
                index,
              ) =>
                `${index + 1}. <@${item.userId}> — **${number(
                  item.messages,
                )}** ข้อความ`,
            )
            .join(
              "\n",
            )
        : "ยังไม่มีข้อมูล";

    const embed =
      new EmbedBuilder()
        .setColor(
          0x168bff,
        )
        .setTitle(
          "💬 NEXORA Analytics • Activity",
        )
        .setDescription(
          `ช่วงเวลา: **${periodLabel(
            period,
          )}**`,
        )
        .addFields(
          {
            name:
              "📨 Messages",

            value:
              `**${number(
                metrics.activity
                  .messages,
              )}**`,

            inline:
              true,
          },

          {
            name:
              "👥 Active Members",

            value:
              `**${number(
                metrics.activity
                  .activeMembers,
              )}**`,

            inline:
              true,
          },

          {
            name:
              "🏆 Top Activity",

            value:
              top,
          },
        )
        .setFooter({
          text:
            "นับจาก MemberDailyActivity",
        })
        .setTimestamp();

    await interaction.editReply({
      embeds: [
        embed,
      ],

      allowedMentions: {
        parse:
          [],
      },
    });

    return;
  }

  if (
    subcommand ===
    "marketplace"
  ) {
    const embed =
      new EmbedBuilder()
        .setColor(
          0x8247ff,
        )
        .setTitle(
          "🛒 NEXORA Analytics • Marketplace v2",
        )
        .setDescription(
          `ช่วงเวลา: **${periodLabel(
            period,
          )}**`,
        )
        .addFields(
          field(
            "🤝 Trades",
            [
              `สร้าง: **${number(
                metrics.marketplace
                  .created,
              )}**`,
              `สำเร็จ: **${number(
                metrics.marketplace
                  .completed,
              )}**`,
              `ยกเลิก: **${number(
                metrics.marketplace
                  .cancelled,
              )}**`,
              `หมดอายุ: **${number(
                metrics.marketplace
                  .expired,
              )}**`,
              `กำลังดำเนินการ: **${number(
                metrics.marketplace
                  .active,
              )}**`,
              `Completion Rate: **${percent(
                metrics.marketplace
                  .completionRate,
              )}**`,
            ],
          ),

          field(
            "🎉 Giveaway",
            [
              `สร้าง: **${number(
                metrics.giveaways
                  .created,
              )}**`,
              `จบแล้ว: **${number(
                metrics.giveaways
                  .ended,
              )}**`,
              `กำลังเปิด: **${number(
                metrics.giveaways
                  .active,
              )}**`,
              `Entries: **${number(
                metrics.giveaways
                  .entrants,
              )}**`,
            ],
          ),
        )
        .setFooter({
          text:
            "Marketplace v2 • ไม่มีการนับเงินจริง",
        })
        .setTimestamp();

    await interaction.editReply({
      embeds: [
        embed,
      ],
    });

    return;
  }

  if (
    subcommand ===
    "operations"
  ) {
    const moderationBreakdown =
      metrics.moderation
        .breakdown
        .slice(
          0,
          8,
        )
        .map(
          (
            item,
          ) =>
            `• ${item.action}: **${number(
              item.count,
            )}**`,
        )
        .join(
          "\n",
        ) ||
      "ยังไม่มีข้อมูล";

    const embed =
      new EmbedBuilder()
        .setColor(
          0x315cff,
        )
        .setTitle(
          "⚙️ NEXORA Analytics • Operations",
        )
        .setDescription(
          `ช่วงเวลา: **${periodLabel(
            period,
          )}**`,
        )
        .addFields(
          field(
            "🎫 Tickets",
            [
              `สร้าง: **${number(
                metrics.tickets
                  .created,
              )}**`,
              `ปิด: **${number(
                metrics.tickets
                  .closed,
              )}**`,
              `ค้างตอนนี้: **${number(
                metrics.tickets
                  .open,
              )}**`,
              `เวลาเฉลี่ยก่อนปิด: **${metrics.tickets.averageResolutionHours.toFixed(
                1,
              )} ชม.**`,
            ],
          ),

          {
            name:
              "🛡️ Moderation",

            value: [
              `รวม: **${number(
                metrics.moderation
                  .total,
              )}**`,
              "",
              moderationBreakdown,
            ].join(
              "\n",
            ),
          },

          field(
            "⚔️ Dungeon RPG",
            [
              `Runs: **${number(
                metrics.dungeons
                  .runs,
              )}**`,
              `สำเร็จ: **${number(
                metrics.dungeons
                  .completed,
              )}**`,
              `ล้มเหลว: **${number(
                metrics.dungeons
                  .failed,
              )}**`,
              `ผู้เล่น: **${number(
                metrics.dungeons
                  .players,
              )}**`,
              `Success Rate: **${percent(
                metrics.dungeons
                  .successRate,
              )}**`,
            ],
          ),

          field(
            "🖥️ System Logs",
            [
              `Logs: **${number(
                metrics.system
                  .logs,
              )}**`,
              `Warnings: **${number(
                metrics.system
                  .warnings,
              )}**`,
              `Errors: **${number(
                metrics.system
                  .errors,
              )}**`,
            ],
          ),
        )
        .setFooter({
          text:
            "NEXORA Analytics • Operational Metrics",
        })
        .setTimestamp();

    await interaction.editReply({
      embeds: [
        embed,
      ],
    });

    return;
  }

  throw new Error(
    "ไม่พบ Analytics subcommand",
  );
}
