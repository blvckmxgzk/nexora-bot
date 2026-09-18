import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type Guild,
} from "discord.js";

import {
  randomBytes,
  randomInt,
} from "node:crypto";

import {
  Giveaway,
} from "../models/Giveaway.js";

import {
  communityLoggingService,
} from "./logging/communityLoggingService.js";

const GIVEAWAY_BUTTON_PREFIX =
  "nexora_giveaway_enter:";

const MIN_DURATION_MS =
  10 *
  1000;

const MAX_DURATION_MS =
  30 *
  24 *
  60 *
  60 *
  1000;

const STUCK_PROCESSING_MS =
  2 *
  60 *
  1000;

const STALE_ANNOUNCEMENT_CLAIM_MS =
  5 *
  60 *
  1000;

function generateGiveawayId():
  string {
  return [
    "GW",
    Date.now()
      .toString(
        36,
      )
      .toUpperCase(),
    randomBytes(
      3,
    )
      .toString(
        "hex",
      )
      .toUpperCase(),
  ].join(
    "-",
  );
}

function asDate(
  value:
    unknown,
): Date {
  if (
    value instanceof
    Date
  ) {
    return value;
  }

  return new Date(
    String(
      value,
    ),
  );
}

function discordTimestamp(
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

function uniqueIds(
  values:
    unknown,
): string[] {
  if (
    !Array.isArray(
      values,
    )
  ) {
    return [];
  }

  return [
    ...new Set(
      values
        .filter(
          (
            value,
          ):
            value is string =>
              typeof value ===
                "string" &&
              value.length >
                0,
        ),
    ),
  ];
}

export function parseGiveawayDuration(
  input:
    string,
): number {
  const value =
    input
      .trim()
      .toLowerCase();

  const match =
    /^(\d+)(s|m|h|d|w)$/
      .exec(
        value,
      );

  if (!match) {
    throw new Error(
      "รูปแบบระยะเวลาไม่ถูกต้อง ใช้เช่น 30s, 10m, 2h, 3d หรือ 1w",
    );
  }

  const amount =
    Number(
      match[1],
    );

  const unit =
    match[2];

  const multipliers:
    Record<
      string,
      number
    > = {
      s:
        1000,

      m:
        60 *
        1000,

      h:
        60 *
        60 *
        1000,

      d:
        24 *
        60 *
        60 *
        1000,

      w:
        7 *
        24 *
        60 *
        60 *
        1000,
    };

  const duration =
    amount *
    multipliers[
      unit
    ];

  if (
    !Number.isSafeInteger(
      duration,
    ) ||
    duration <
      MIN_DURATION_MS
  ) {
    throw new Error(
      "Giveaway ต้องมีระยะเวลาอย่างน้อย 10 วินาที",
    );
  }

  if (
    duration >
    MAX_DURATION_MS
  ) {
    throw new Error(
      "Giveaway ตั้งเวลาได้สูงสุด 30 วัน",
    );
  }

  return duration;
}

export function pickGiveawayWinners(
  entrantIds:
    string[],

  winnerCount:
    number,

  excludedIds:
    string[] =
      [],
): string[] {
  const excluded =
    new Set(
      excludedIds,
    );

  const pool =
    [
      ...new Set(
        entrantIds,
      ),
    ]
      .filter(
        (
          userId,
        ) =>
          !excluded.has(
            userId,
          ),
      );

  for (
    let index =
      pool.length -
      1;
    index >
    0;
    index -=
      1
  ) {
    const swapIndex =
      randomInt(
        index +
        1,
      );

    [
      pool[index],
      pool[swapIndex],
    ] = [
      pool[swapIndex],
      pool[index],
    ];
  }

  const count =
    Math.max(
      0,
      Math.min(
        Math.floor(
          winnerCount,
        ),
        pool.length,
      ),
    );

  return pool.slice(
    0,
    count,
  );
}

function buildGiveawayMessage(
  giveaway:
    any,
) {
  const status =
    String(
      giveaway.status,
    );

  const active =
    status ===
      "active" &&
    asDate(
      giveaway.endsAt,
    ).getTime() >
      Date.now();

  const entrants =
    uniqueIds(
      giveaway.entrantIds,
    );

  const winners =
    uniqueIds(
      giveaway.winnerIds,
    );

  let color =
    0x5338e8;

  let statusText =
    "🎉 กำลังดำเนินการ";

  if (
    status ===
    "ending"
  ) {
    color =
      0xf59e0b;

    statusText =
      "⏳ กำลังสรุปผล";
  }

  if (
    status ===
    "ended"
  ) {
    color =
      0x22c55e;

    statusText =
      "🏁 จบแล้ว";
  }

  if (
    status ===
    "cancelled"
  ) {
    color =
      0x6b7280;

    statusText =
      "🚫 ยกเลิกแล้ว";
  }

  const description:
    string[] = [];

  if (
    giveaway.description
  ) {
    description.push(
      String(
        giveaway.description,
      ),
      "",
    );
  }

  description.push(
    `🎁 **รางวัล:** ${giveaway.prize}`,
    "",
    `👤 **ผู้จัด:** <@${giveaway.hostId}>`,
    `🏆 **จำนวนผู้ชนะ:** ${giveaway.winnerCount}`,
    `🎟️ **ผู้เข้าร่วม:** ${entrants.length}`,
    `📌 **สถานะ:** ${statusText}`,
  );

  if (
    status ===
      "active" ||
    status ===
      "ending"
  ) {
    const endsAt =
      asDate(
        giveaway.endsAt,
      );

    description.push(
      `⏰ **สิ้นสุด:** ${discordTimestamp(
        endsAt,
        "F",
      )}`,
      `⌛ **เหลือเวลา:** ${discordTimestamp(
        endsAt,
        "R",
      )}`,
    );
  }

  if (
    status ===
      "ended"
  ) {
    description.push(
      "",
      winners.length >
        0
        ? `🎊 **ผู้ชนะ:** ${winners
            .map(
              (
                userId,
              ) =>
                `<@${userId}>`,
            )
            .join(
              ", ",
            )}`
        : "🎊 **ผู้ชนะ:** ไม่มีผู้เข้าร่วม",
    );
  }

  if (
    status ===
      "cancelled" &&
    giveaway.cancelReason
  ) {
    description.push(
      "",
      `📝 **เหตุผล:** ${giveaway.cancelReason}`,
    );
  }

  const embed =
    new EmbedBuilder()
      .setColor(
        color,
      )
      .setTitle(
        `🎉 GIVEAWAY • ${String(
          giveaway.prize,
        ).slice(
          0,
          200,
        )}`,
      )
      .setDescription(
        description.join(
          "\n",
        ),
      )
      .setFooter({
        text:
          `NEXORA Giveaway • ${giveaway.giveawayId}`,
      })
      .setTimestamp();

  const components:
    ActionRowBuilder<ButtonBuilder>[] =
      [];

  if (
    active
  ) {
    components.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${GIVEAWAY_BUTTON_PREFIX}${giveaway.giveawayId}`,
            )
            .setLabel(
              `เข้าร่วม (${entrants.length})`,
            )
            .setEmoji(
              "🎉",
            )
            .setStyle(
              ButtonStyle.Success,
            ),
        ),
    );
  }

  return {
    embeds: [
      embed,
    ],

    components,

    allowedMentions: {
      parse:
        [],
    },
  };
}

async function resolveGuild(
  client:
    Client,

  guildId:
    string,
): Promise<Guild | null> {
  const cached =
    client.guilds.cache.get(
      guildId,
    );

  if (cached) {
    return cached;
  }

  return client.guilds
    .fetch(
      guildId,
    )
    .catch(
      () =>
        null,
    );
}

async function resolveChannel(
  client:
    Client,

  guildId:
    string,

  channelId:
    string,
): Promise<any | null> {
  const guild =
    await resolveGuild(
      client,
      guildId,
    );

  if (!guild) {
    return null;
  }

  const channel =
    guild.channels.cache.get(
      channelId,
    ) ??
    await guild.channels
      .fetch(
        channelId,
      )
      .catch(
        () =>
          null,
      );

  if (
    !channel ||
    !channel.isTextBased() ||
    typeof (
      channel as any
    ).send !==
      "function"
  ) {
    return null;
  }

  return channel;
}

async function logGiveaway(
  client:
    Client,

  giveaway:
    any,

  payload: {
    event:
      string;

    title:
      string;

    description?:
      string;

    actorId?:
      string |
      null;

    severity?:
      "info" |
      "success" |
      "warning" |
      "error";
  },
): Promise<void> {
  const guild =
    await resolveGuild(
      client,
      giveaway.guildId,
    );

  if (!guild) {
    return;
  }

  await communityLoggingService
    .system(
      guild,
      {
        event:
          payload.event,

        title:
          payload.title,

        description:
          payload.description ??
          null,

        actorId:
          payload.actorId ??
          null,

        channelId:
          giveaway.channelId,

        severity:
          payload.severity ??
          "info",

        fields: [
          {
            name:
              "Giveaway",

            value:
              `\`${giveaway.giveawayId}\``,

            inline:
              true,
          },

          {
            name:
              "Prize",

            value:
              String(
                giveaway.prize,
              ).slice(
                0,
                1024,
              ),

            inline:
              true,
          },
        ],

        metadata: {
          giveawayId:
            giveaway.giveawayId,

          status:
            giveaway.status,

          winnerCount:
            giveaway.winnerCount,

          entrants:
            uniqueIds(
              giveaway.entrantIds,
            ).length,
        },
      },
    );
}

async function syncGiveawayMessage(
  client:
    Client,

  giveaway:
    any,
): Promise<boolean> {
  if (
    !giveaway.messageId
  ) {
    return false;
  }

  const channel =
    await resolveChannel(
      client,
      giveaway.guildId,
      giveaway.channelId,
    );

  if (
    !channel ||
    !channel.messages
  ) {
    return false;
  }

  const message =
    await channel.messages
      .fetch(
        giveaway.messageId,
      )
      .catch(
        () =>
          null,
      );

  if (!message) {
    return false;
  }

  try {
    await message.edit(
      buildGiveawayMessage(
        giveaway,
      ),
    );

    if (
      giveaway.status ===
        "ended" ||
      giveaway.status ===
        "cancelled"
    ) {
      await Giveaway.updateOne(
        {
          _id:
            giveaway._id,
        },
        {
          $set: {
            messageSyncedAt:
              new Date(),
          },
        },
      );
    }

    return true;
  } catch (error) {
    console.error(
      `❌ Giveaway message sync failed • ${giveaway.giveawayId}:`,
      error,
    );

    return false;
  }
}

async function announceResult(
  client:
    Client,

  giveaway:
    any,
): Promise<boolean> {
  const staleBefore =
    new Date(
      Date.now() -
      STALE_ANNOUNCEMENT_CLAIM_MS,
    );

  await Giveaway.updateMany(
    {
      status:
        "ended",

      announcementSentAt:
        null,

      announcementClaimedAt: {
        $ne:
          null,

        $lt:
          staleBefore,
      },
    },
    {
      $set: {
        announcementClaimedAt:
          null,
      },
    },
  );

  const claimed =
    await Giveaway
      .findOneAndUpdate(
        {
          _id:
            giveaway._id,

          status:
            "ended",

          announcementSentAt:
            null,

          announcementClaimedAt:
            null,
        },
        {
          $set: {
            announcementClaimedAt:
              new Date(),
          },
        },
        {
          new:
            true,
        },
      );

  if (!claimed) {
    return false;
  }

  const channel =
    await resolveChannel(
      client,
      claimed.guildId,
      claimed.channelId,
    );

  if (!channel) {
    await Giveaway.updateOne(
      {
        _id:
          claimed._id,
      },
      {
        $set: {
          announcementClaimedAt:
            null,
        },
      },
    );

    return false;
  }

  const winners =
    uniqueIds(
      claimed.winnerIds,
    );

  const content =
    winners.length >
      0
      ? [
          "🎉 **GIVEAWAY ENDED!**",
          "",
          `🎁 **รางวัล:** ${claimed.prize}`,
          `🏆 **ผู้ชนะ:** ${winners
            .map(
              (
                userId,
              ) =>
                `<@${userId}>`,
            )
            .join(
              ", ",
            )}`,
          "",
          `🔖 Giveaway ID: \`${claimed.giveawayId}\``,
          "",
          "ยินดีด้วย! 🎊",
        ].join(
          "\n",
        )
      : [
          "🏁 **GIVEAWAY ENDED**",
          "",
          `🎁 **รางวัล:** ${claimed.prize}`,
          "ไม่มีผู้เข้าร่วม Giveaway นี้",
          "",
          `🔖 Giveaway ID: \`${claimed.giveawayId}\``,
        ].join(
          "\n",
        );

  try {
    await channel.send({
      content,

      allowedMentions: {
        parse:
          [],

        users:
          winners,
      },
    });

    await Giveaway.updateOne(
      {
        _id:
          claimed._id,
      },
      {
        $set: {
          announcementSentAt:
            new Date(),

          announcementClaimedAt:
            null,
        },
      },
    );

    return true;
  } catch (error) {
    await Giveaway.updateOne(
      {
        _id:
          claimed._id,
      },
      {
        $set: {
          announcementClaimedAt:
            null,
        },
      },
    );

    console.error(
      `❌ Giveaway result announcement failed • ${claimed.giveawayId}:`,
      error,
    );

    return false;
  }
}

export const giveawayService = {
  async createGiveaway(
    client:
      Client,

    guild:
      Guild,

    channel:
      any,

    data: {
      hostId:
        string;

      prize:
        string;

      description?:
        string |
        null;

      winnerCount:
        number;

      endsAt:
        Date;
    },
  ) {
    if (
      !channel ||
      typeof channel.send !==
        "function" ||
      !channel.id
    ) {
      throw new Error(
        "ห้องนี้ไม่รองรับการสร้าง Giveaway",
      );
    }

    const prize =
      data.prize
        .trim();

    if (
      prize.length <
        1 ||
      prize.length >
        200
    ) {
      throw new Error(
        "ชื่อรางวัลต้องมีความยาว 1–200 ตัวอักษร",
      );
    }

    const winnerCount =
      Math.floor(
        data.winnerCount,
      );

    if (
      winnerCount <
        1 ||
      winnerCount >
        20
    ) {
      throw new Error(
        "จำนวนผู้ชนะต้องอยู่ระหว่าง 1–20 คน",
      );
    }

    if (
      data.endsAt.getTime() <=
      Date.now()
    ) {
      throw new Error(
        "เวลาสิ้นสุด Giveaway ต้องอยู่ในอนาคต",
      );
    }

    const giveaway =
      await Giveaway.create({
        giveawayId:
          generateGiveawayId(),

        guildId:
          guild.id,

        channelId:
          channel.id,

        messageId:
          null,

        hostId:
          data.hostId,

        prize,

        description:
          data.description
            ?.trim()
            .slice(
              0,
              1500,
            ) ||
          null,

        winnerCount,

        entrantIds:
          [],

        winnerIds:
          [],

        status:
          "active",

        endsAt:
          data.endsAt,
      });

    try {
      const message =
        await channel.send(
          buildGiveawayMessage(
            giveaway,
          ),
        );

      giveaway.messageId =
        message.id;

      await giveaway.save();
    } catch (error) {
      await Giveaway.deleteOne({
        _id:
          giveaway._id,
      });

      throw error;
    }

    await logGiveaway(
      client,
      giveaway,
      {
        event:
          "giveaway_created",

        title:
          "Giveaway Created",

        actorId:
          data.hostId,

        severity:
          "success",
      },
    );

    return giveaway;
  },

  async toggleEntry(
    client:
      Client,

    giveawayId:
      string,

    userId:
      string,
  ) {
    const current =
      await Giveaway.findOne({
        giveawayId,
      });

    if (!current) {
      throw new Error(
        "ไม่พบ Giveaway นี้",
      );
    }

    if (
      current.status !==
      "active"
    ) {
      throw new Error(
        "Giveaway นี้ปิดรับผู้เข้าร่วมแล้ว",
      );
    }

    if (
      asDate(
        current.endsAt,
      ).getTime() <=
      Date.now()
    ) {
      await giveawayService
        .endGiveaway(
          client,
          giveawayId,
          null,
          "scheduled",
        )
        .catch(
          () =>
            undefined,
        );

      throw new Error(
        "Giveaway นี้สิ้นสุดแล้ว",
      );
    }

    if (
      current.hostId ===
      userId
    ) {
      throw new Error(
        "ผู้จัด Giveaway ไม่สามารถเข้าร่วม Giveaway ของตัวเองได้",
      );
    }

    const currentlyJoined =
      uniqueIds(
        current.entrantIds,
      )
        .includes(
          userId,
        );

    const updated =
      await Giveaway
        .findOneAndUpdate(
          {
            giveawayId,

            status:
              "active",

            endsAt: {
              $gt:
                new Date(),
            },
          },
          currentlyJoined
            ? {
                $pull: {
                  entrantIds:
                    userId,
                },
              }
            : {
                $addToSet: {
                  entrantIds:
                    userId,
                },
              },
          {
            new:
              true,
          },
        );

    if (!updated) {
      throw new Error(
        "Giveaway นี้ปิดรับผู้เข้าร่วมแล้ว",
      );
    }

    await syncGiveawayMessage(
      client,
      updated,
    );

    return {
      joined:
        !currentlyJoined,

      entrantCount:
        uniqueIds(
          updated.entrantIds,
        ).length,

      giveaway:
        updated,
    };
  },

  async endGiveaway(
    client:
      Client,

    giveawayId:
      string,

    actorId:
      string |
      null,

    reason =
      "manual",
  ) {
    const claimed =
      await Giveaway
        .findOneAndUpdate(
          {
            giveawayId,

            status:
              "active",
          },
          {
            $set: {
              status:
                "ending",

              processingStartedAt:
                new Date(),
            },
          },
          {
            new:
              true,
          },
        );

    if (!claimed) {
      const existing =
        await Giveaway.findOne({
          giveawayId,
        });

      if (!existing) {
        throw new Error(
          "ไม่พบ Giveaway นี้",
        );
      }

      if (
        existing.status ===
        "ended"
      ) {
        await syncGiveawayMessage(
          client,
          existing,
        );

        await announceResult(
          client,
          existing,
        );

        return existing;
      }

      if (
        existing.status ===
        "ending"
      ) {
        throw new Error(
          "Giveaway นี้กำลังสรุปผลอยู่",
        );
      }

      if (
        existing.status ===
        "cancelled"
      ) {
        throw new Error(
          "Giveaway นี้ถูกยกเลิกแล้ว",
        );
      }

      throw new Error(
        "ไม่สามารถจบ Giveaway นี้ได้",
      );
    }

    try {
      const entrantIds =
        uniqueIds(
          claimed.entrantIds,
        );

      const winnerIds =
        pickGiveawayWinners(
          entrantIds,
          claimed.winnerCount,
        );

      const ended =
        await Giveaway
          .findOneAndUpdate(
            {
              _id:
                claimed._id,

              status:
                "ending",
            },
            {
              $set: {
                status:
                  "ended",

                winnerIds,

                endedAt:
                  new Date(),

                endedBy:
                  actorId,

                endReason:
                  reason,

                processingStartedAt:
                  null,
              },
            },
            {
              new:
                true,
            },
          );

      if (!ended) {
        throw new Error(
          "ไม่สามารถบันทึกผล Giveaway ได้",
        );
      }

      await syncGiveawayMessage(
        client,
        ended,
      );

      await announceResult(
        client,
        ended,
      );

      await logGiveaway(
        client,
        ended,
        {
          event:
            "giveaway_ended",

          title:
            "Giveaway Ended",

          actorId,

          severity:
            "success",

          description:
            winnerIds.length >
              0
              ? `Winners: ${winnerIds.join(
                  ", ",
                )}`
              : "No entrants",
        },
      );

      return ended;
    } catch (error) {
      await Giveaway.updateOne(
        {
          _id:
            claimed._id,

          status:
            "ending",
        },
        {
          $set: {
            status:
              "active",

            processingStartedAt:
              null,
          },
        },
      )
        .catch(
          () =>
            undefined,
        );

      throw error;
    }
  },

  async cancelGiveaway(
    client:
      Client,

    giveawayId:
      string,

    actorId:
      string,

    reason?:
      string |
      null,
  ) {
    const cancelled =
      await Giveaway
        .findOneAndUpdate(
          {
            giveawayId,

            status:
              "active",
          },
          {
            $set: {
              status:
                "cancelled",

              cancelledAt:
                new Date(),

              cancelledBy:
                actorId,

              cancelReason:
                reason
                  ?.trim()
                  .slice(
                    0,
                    500,
                  ) ||
                null,
            },
          },
          {
            new:
              true,
          },
        );

    if (!cancelled) {
      const current =
        await Giveaway.findOne({
          giveawayId,
        });

      if (!current) {
        throw new Error(
          "ไม่พบ Giveaway นี้",
        );
      }

      throw new Error(
        "ยกเลิกได้เฉพาะ Giveaway ที่กำลังเปิดอยู่",
      );
    }

    await syncGiveawayMessage(
      client,
      cancelled,
    );

    await logGiveaway(
      client,
      cancelled,
      {
        event:
          "giveaway_cancelled",

        title:
          "Giveaway Cancelled",

        actorId,

        severity:
          "warning",

        description:
          cancelled.cancelReason ??
          undefined,
      },
    );

    return cancelled;
  },

  async rerollGiveaway(
    client:
      Client,

    giveawayId:
      string,

    actorId:
      string,

    requestedCount?:
      number,
  ) {
    const giveaway =
      await Giveaway.findOne({
        giveawayId,

        status:
          "ended",
      });

    if (!giveaway) {
      throw new Error(
        "Reroll ได้เฉพาะ Giveaway ที่จบแล้ว",
      );
    }

    const oldRerollWinners =
      (
        giveaway.rerollHistory ??
        []
      )
        .flatMap(
          (
            entry:
              any,
          ) =>
            uniqueIds(
              entry.winnerIds,
            ),
        );

    const excludedIds =
      [
        ...uniqueIds(
          giveaway.winnerIds,
        ),

        ...oldRerollWinners,
      ];

    const count =
      Math.max(
        1,
        Math.min(
          20,
          Math.floor(
            requestedCount ??
            giveaway.winnerCount ??
            1,
          ),
        ),
      );

    const winnerIds =
      pickGiveawayWinners(
        uniqueIds(
          giveaway.entrantIds,
        ),
        count,
        excludedIds,
      );

    if (
      winnerIds.length ===
      0
    ) {
      throw new Error(
        "ไม่มีผู้เข้าร่วมคนอื่นที่สามารถ Reroll ได้",
      );
    }

    giveaway.rerollHistory.push({
      winnerIds,

      rerolledBy:
        actorId,

      rerolledAt:
        new Date(),
    });

    await giveaway.save();

    const channel =
      await resolveChannel(
        client,
        giveaway.guildId,
        giveaway.channelId,
      );

    if (channel) {
      await channel.send({
        content: [
          "🔄 **GIVEAWAY REROLL**",
          "",
          `🎁 **รางวัล:** ${giveaway.prize}`,
          `🏆 **ผู้ชนะใหม่:** ${winnerIds
            .map(
              (
                userId,
              ) =>
                `<@${userId}>`,
            )
            .join(
              ", ",
            )}`,
          "",
          `🔖 Giveaway ID: \`${giveaway.giveawayId}\``,
        ].join(
          "\n",
        ),

        allowedMentions: {
          parse:
            [],

          users:
            winnerIds,
        },
      });
    }

    await logGiveaway(
      client,
      giveaway,
      {
        event:
          "giveaway_rerolled",

        title:
          "Giveaway Rerolled",

        actorId,

        severity:
          "success",

        description:
          `New winners: ${winnerIds.join(
            ", ",
          )}`,
      },
    );

    return {
      giveaway,

      winnerIds,
    };
  },

  async getGiveaway(
    giveawayId:
      string,

    guildId?:
      string,
  ) {
    return Giveaway.findOne({
      giveawayId,

      ...(
        guildId
          ? {
              guildId,
            }
          : {}
      ),
    });
  },

  async listGiveaways(
    guildId:
      string,

    status?:
      "active" |
      "ended" |
      "cancelled",
  ) {
    return Giveaway
      .find({
        guildId,

        ...(
          status
            ? {
                status,
              }
            : {}
        ),
      })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        10,
      );
  },

  async recoverStuckProcessing():
    Promise<number> {
    const result =
      await Giveaway.updateMany(
        {
          status:
            "ending",

          processingStartedAt: {
            $lt:
              new Date(
                Date.now() -
                STUCK_PROCESSING_MS,
              ),
          },
        },
        {
          $set: {
            status:
              "active",

            processingStartedAt:
              null,
          },
        },
      );

    return result.modifiedCount;
  },

  async processDueGiveaways(
    client:
      Client,
  ): Promise<number> {
    const due =
      await Giveaway
        .find({
          status:
            "active",

          endsAt: {
            $lte:
              new Date(),
          },
        })
        .sort({
          endsAt:
            1,
        })
        .limit(
          25,
        );

    let processed =
      0;

    for (
      const giveaway of
        due
    ) {
      try {
        await giveawayService
          .endGiveaway(
            client,
            giveaway.giveawayId,
            null,
            "scheduled",
          );

        processed +=
          1;
      } catch (error) {
        console.error(
          `❌ Giveaway auto-end failed • ${giveaway.giveawayId}:`,
          error,
        );
      }
    }

    return processed;
  },

  async reconcileEndedGiveaways(
    client:
      Client,
  ): Promise<number> {
    const giveaways =
      await Giveaway
        .find({
          status:
            "ended",

          $or: [
            {
              messageSyncedAt:
                null,
            },

            {
              announcementSentAt:
                null,
            },
          ],
        })
        .sort({
          endedAt:
            1,
        })
        .limit(
          25,
        );

    let repaired =
      0;

    for (
      const giveaway of
        giveaways
    ) {
      const synced =
        giveaway.messageSyncedAt
          ? true
          : await syncGiveawayMessage(
              client,
              giveaway,
            );

      const announced =
        giveaway.announcementSentAt
          ? true
          : await announceResult(
              client,
              giveaway,
            );

      if (
        synced ||
        announced
      ) {
        repaired +=
          1;
      }
    }

    return repaired;
  },

  async syncGiveawayMessage(
    client:
      Client,

    giveawayId:
      string,
  ) {
    const giveaway =
      await Giveaway.findOne({
        giveawayId,
      });

    if (!giveaway) {
      return false;
    }

    return syncGiveawayMessage(
      client,
      giveaway,
    );
  },
};
