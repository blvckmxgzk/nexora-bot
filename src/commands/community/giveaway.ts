import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  giveawayService,
  parseGiveawayDuration,
} from "../../services/giveawayService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "giveaway",
    )
    .setDescription(
      "จัดการ Giveaway ของ NEXORA",
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
            "create",
          )
          .setDescription(
            "สร้าง Giveaway ใหม่",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "prize",
                )
                .setDescription(
                  "รางวัล",
                )
                .setRequired(
                  true,
                )
                .setMaxLength(
                  200,
                ),
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "duration",
                )
                .setDescription(
                  "ระยะเวลา เช่น 30s, 10m, 2h, 3d, 1w",
                )
                .setRequired(
                  true,
                )
                .setMaxLength(
                  20,
                ),
          )
          .addIntegerOption(
            (
              option,
            ) =>
              option
                .setName(
                  "winners",
                )
                .setDescription(
                  "จำนวนผู้ชนะ",
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  20,
                ),
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "description",
                )
                .setDescription(
                  "รายละเอียดเพิ่มเติม",
                )
                .setMaxLength(
                  1500,
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
                  "ห้องสำหรับ Giveaway",
                )
                .addChannelTypes(
                  ChannelType.GuildText,
                  ChannelType.GuildAnnouncement,
                ),
          ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "end",
          )
          .setDescription(
            "จบ Giveaway และสุ่มผู้ชนะทันที",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "id",
                )
                .setDescription(
                  "Giveaway ID",
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
            "reroll",
          )
          .setDescription(
            "สุ่มผู้ชนะใหม่จาก Giveaway ที่จบแล้ว",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "id",
                )
                .setDescription(
                  "Giveaway ID",
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
                  "winners",
                )
                .setDescription(
                  "จำนวนผู้ชนะใหม่",
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  20,
                ),
          ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "cancel",
          )
          .setDescription(
            "ยกเลิก Giveaway",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "id",
                )
                .setDescription(
                  "Giveaway ID",
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
                  "เหตุผล",
                )
                .setMaxLength(
                  500,
                ),
          ),
    )
    .addSubcommand(
      (
        command,
      ) =>
        command
          .setName(
            "info",
          )
          .setDescription(
            "ดูข้อมูล Giveaway",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "id",
                )
                .setDescription(
                  "Giveaway ID",
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
            "list",
          )
          .setDescription(
            "ดู Giveaway ล่าสุด",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "status",
                )
                .setDescription(
                  "กรองสถานะ",
                )
                .addChoices(
                  {
                    name:
                      "ทั้งหมด",

                    value:
                      "all",
                  },

                  {
                    name:
                      "กำลังดำเนินการ",

                    value:
                      "active",
                  },

                  {
                    name:
                      "จบแล้ว",

                    value:
                      "ended",
                  },

                  {
                    name:
                      "ยกเลิก",

                    value:
                      "cancelled",
                  },
                ),
          ),
    );

function timestamp(
  value:
    Date,
  mode:
    "F" |
    "R" =
      "F",
): string {
  return `<t:${Math.floor(
    value.getTime() /
    1000,
  )}:${mode}>`;
}

const statusNames:
  Record<
    string,
    string
  > = {
    active:
      "🟢 Active",

    ending:
      "🟡 Ending",

    ended:
      "🏁 Ended",

    cancelled:
      "🚫 Cancelled",
  };

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.inGuild() ||
    !interaction.guildId
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
    "create"
  ) {
    const prize =
      interaction.options
        .getString(
          "prize",
          true,
        );

    const durationInput =
      interaction.options
        .getString(
          "duration",
          true,
        );

    const winnerCount =
      interaction.options
        .getInteger(
          "winners",
        ) ??
      1;

    const description =
      interaction.options
        .getString(
          "description",
        );

    const requestedChannel =
      interaction.options
        .getChannel(
          "channel",
        );

    const destination =
      requestedChannel ??
      interaction.channel;

    if (
      !destination ||
      typeof (
        destination as any
      ).send !==
        "function"
    ) {
      throw new Error(
        "ไม่สามารถส่ง Giveaway ในห้องนี้ได้",
      );
    }

    const guild =
      interaction.guild ??
      await interaction.client
        .guilds.fetch(
          interaction.guildId,
        );

    const durationMs =
      parseGiveawayDuration(
        durationInput,
      );

    const giveaway =
      await giveawayService
        .createGiveaway(
          interaction.client,
          guild,
          destination,
          {
            hostId:
              interaction.user.id,

            prize,

            description,

            winnerCount,

            endsAt:
              new Date(
                Date.now() +
                durationMs,
              ),
          },
        );

    const messageUrl =
      giveaway.messageId
        ? `https://discord.com/channels/${giveaway.guildId}/${giveaway.channelId}/${giveaway.messageId}`
        : null;

    await interaction.editReply({
      content: [
        "✅ **สร้าง Giveaway สำเร็จ**",
        "",
        `🔖 ID: \`${giveaway.giveawayId}\``,
        `🎁 รางวัล: **${giveaway.prize}**`,
        `🏆 ผู้ชนะ: **${giveaway.winnerCount} คน**`,
        `⏰ สิ้นสุด: ${timestamp(
          giveaway.endsAt,
          "F",
        )}`,
        messageUrl
          ? `🔗 ${messageUrl}`
          : null,
      ]
        .filter(
          Boolean,
        )
        .join(
          "\n",
        ),
    });

    return;
  }

  if (
    subcommand ===
    "end"
  ) {
    const giveawayId =
      interaction.options
        .getString(
          "id",
          true,
        )
        .trim();

    const giveaway =
      await giveawayService
        .endGiveaway(
          interaction.client,
          giveawayId,
          interaction.user.id,
          "manual",
        );

    const winners =
      Array.isArray(
        giveaway.winnerIds,
      )
        ? giveaway.winnerIds
        : [];

    await interaction.editReply({
      content: [
        "🏁 **Giveaway จบแล้ว**",
        `🔖 \`${giveaway.giveawayId}\``,
        winners.length >
          0
          ? `🏆 ผู้ชนะ: ${winners
              .map(
                (
                  userId:
                    string,
                ) =>
                  `<@${userId}>`,
              )
              .join(
                ", ",
              )}`
          : "🏆 ไม่มีผู้เข้าร่วม",
      ].join(
        "\n",
      ),

      allowedMentions: {
        parse:
          [],
      },
    });

    return;
  }

  if (
    subcommand ===
    "reroll"
  ) {
    const giveawayId =
      interaction.options
        .getString(
          "id",
          true,
        )
        .trim();

    const winnerCount =
      interaction.options
        .getInteger(
          "winners",
        ) ??
      undefined;

    const result =
      await giveawayService
        .rerollGiveaway(
          interaction.client,
          giveawayId,
          interaction.user.id,
          winnerCount,
        );

    await interaction.editReply({
      content: [
        "🔄 **Reroll สำเร็จ**",
        `🔖 \`${giveawayId}\``,
        `🏆 ผู้ชนะใหม่: ${result.winnerIds
          .map(
            (
              userId,
            ) =>
              `<@${userId}>`,
          )
          .join(
            ", ",
          )}`,
      ].join(
        "\n",
      ),

      allowedMentions: {
        parse:
          [],
      },
    });

    return;
  }

  if (
    subcommand ===
    "cancel"
  ) {
    const giveawayId =
      interaction.options
        .getString(
          "id",
          true,
        )
        .trim();

    const reason =
      interaction.options
        .getString(
          "reason",
        );

    const giveaway =
      await giveawayService
        .cancelGiveaway(
          interaction.client,
          giveawayId,
          interaction.user.id,
          reason,
        );

    await interaction.editReply({
      content: [
        "🚫 **ยกเลิก Giveaway แล้ว**",
        `🔖 \`${giveaway.giveawayId}\``,
        reason
          ? `📝 ${reason}`
          : null,
      ]
        .filter(
          Boolean,
        )
        .join(
          "\n",
        ),
    });

    return;
  }

  if (
    subcommand ===
    "info"
  ) {
    const giveawayId =
      interaction.options
        .getString(
          "id",
          true,
        )
        .trim();

    const giveaway =
      await giveawayService
        .getGiveaway(
          giveawayId,
          interaction.guildId,
        );

    if (!giveaway) {
      throw new Error(
        "ไม่พบ Giveaway นี้",
      );
    }

    const entrants =
      Array.isArray(
        giveaway.entrantIds,
      )
        ? giveaway.entrantIds
            .length
        : 0;

    const winners =
      Array.isArray(
        giveaway.winnerIds,
      )
        ? giveaway.winnerIds
        : [];

    const embed =
      new EmbedBuilder()
        .setColor(
          0x5338e8,
        )
        .setTitle(
          `🎉 Giveaway • ${giveaway.prize}`,
        )
        .setDescription(
          [
            `🔖 **ID:** \`${giveaway.giveawayId}\``,
            `📌 **สถานะ:** ${statusNames[giveaway.status] ?? giveaway.status}`,
            `👤 **ผู้จัด:** <@${giveaway.hostId}>`,
            `🎟️ **ผู้เข้าร่วม:** ${entrants}`,
            `🏆 **จำนวนผู้ชนะ:** ${giveaway.winnerCount}`,
            `⏰ **กำหนดจบ:** ${timestamp(
              giveaway.endsAt,
              "F",
            )}`,
            "",
            winners.length >
              0
              ? `🎊 **ผู้ชนะ:** ${winners
                  .map(
                    (
                      userId:
                        string,
                    ) =>
                      `<@${userId}>`,
                  )
                  .join(
                    ", ",
                  )}`
              : "🎊 **ผู้ชนะ:** -",
          ].join(
            "\n",
          ),
        )
        .setFooter({
          text:
            "NEXORA Giveaway",
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
    "list"
  ) {
    const requestedStatus =
      interaction.options
        .getString(
          "status",
        ) ??
      "all";

    const status =
      requestedStatus ===
        "active" ||
      requestedStatus ===
        "ended" ||
      requestedStatus ===
        "cancelled"
        ? requestedStatus
        : undefined;

    const giveaways =
      await giveawayService
        .listGiveaways(
          interaction.guildId,
          status,
        );

    if (
      giveaways.length ===
      0
    ) {
      await interaction.editReply({
        content:
          "🎉 ยังไม่มี Giveaway ที่ตรงกับเงื่อนไข",
      });

      return;
    }

    const lines =
      giveaways.map(
        (
          giveaway,
        ) => {
          return [
            `**${giveaway.prize}**`,
            `└ \`${giveaway.giveawayId}\` • ${statusNames[giveaway.status] ?? giveaway.status}`,
            `└ 🎟️ ${Array.isArray(giveaway.entrantIds) ? giveaway.entrantIds.length : 0} คน • 🏆 ${giveaway.winnerCount} คน`,
          ].join(
            "\n",
          );
        },
      );

    const embed =
      new EmbedBuilder()
        .setColor(
          0x5338e8,
        )
        .setTitle(
          "🎉 NEXORA Giveaways",
        )
        .setDescription(
          lines.join(
            "\n\n",
          ),
        )
        .setFooter({
          text:
            "แสดงสูงสุด 10 รายการล่าสุด",
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
    "ไม่พบ Giveaway subcommand",
  );
}
