import {
  type Guild,
} from "discord.js";

import {
  MemberDailyActivity,
} from "../models/MemberDailyActivity.js";

import {
  ModerationLog,
} from "../models/ModerationLog.js";

import {
  Ticket,
} from "../models/Ticket.js";

import {
  TradeRequest,
} from "../models/TradeRequest.js";

import {
  Giveaway,
} from "../models/Giveaway.js";

import {
  DungeonRun,
} from "../models/DungeonRun.js";

import {
  CommunityLogRecord,
} from "../models/CommunityLogRecord.js";

import {
  AnalyticsSnapshot,
} from "../models/AnalyticsSnapshot.js";

export type AnalyticsPeriod =
  | "today"
  | "7d"
  | "30d";

const DAY_MS =
  24 *
  60 *
  60 *
  1000;

function bangkokParts(
  date:
    Date,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Bangkok",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      },
    );

  const parts =
    formatter
      .formatToParts(
        date,
      );

  const values =
    Object.fromEntries(
      parts.map(
        (
          part,
        ) => [
          part.type,
          part.value,
        ],
      ),
    );

  return {
    year:
      Number(
        values.year,
      ),

    month:
      Number(
        values.month,
      ),

    day:
      Number(
        values.day,
      ),
  };
}

export function analyticsDateKey(
  date =
    new Date(),
): string {
  const parts =
    bangkokParts(
      date,
    );

  return [
    String(
      parts.year,
    )
      .padStart(
        4,
        "0",
      ),

    String(
      parts.month,
    )
      .padStart(
        2,
        "0",
      ),

    String(
      parts.day,
    )
      .padStart(
        2,
        "0",
      ),
  ].join(
    "-",
  );
}

function bangkokDayStart(
  date:
    Date,
): Date {
  const parts =
    bangkokParts(
      date,
    );

  return new Date(
    Date.UTC(
      parts.year,
      parts.month -
        1,
      parts.day,
      -7,
      0,
      0,
      0,
    ),
  );
}

export function getAnalyticsRange(
  period:
    AnalyticsPeriod,

  now =
    new Date(),
) {
  const todayStart =
    bangkokDayStart(
      now,
    );

  const days =
    period ===
      "30d"
      ? 30
      : period ===
          "7d"
        ? 7
        : 1;

  const start =
    new Date(
      todayStart.getTime() -
      (
        days -
        1
      ) *
      DAY_MS,
    );

  return {
    period,

    days,

    start,

    end:
      now,
  };
}

function asNumber(
  value:
    unknown,
): number {
  const number =
    Number(
      value ??
      0,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}

async function activityMetrics(
  guildId:
    string,

  start:
    Date,

  end:
    Date,
) {
  const [
    summary,
    topMembers,
  ] =
    await Promise.all([
      MemberDailyActivity
        .aggregate([
          {
            $match: {
              guildId,

              bucketStart: {
                $gte:
                  start,

                $lte:
                  end,
              },
            },
          },

          {
            $group: {
              _id:
                null,

              messages: {
                $sum:
                  "$messageCount",
              },

              members: {
                $addToSet:
                  "$userId",
              },
            },
          },

          {
            $project: {
              _id:
                0,

              messages:
                1,

              activeMembers: {
                $size:
                  "$members",
              },
            },
          },
        ]),

      MemberDailyActivity
        .aggregate([
          {
            $match: {
              guildId,

              bucketStart: {
                $gte:
                  start,

                $lte:
                  end,
              },
            },
          },

          {
            $group: {
              _id:
                "$userId",

              messages: {
                $sum:
                  "$messageCount",
              },
            },
          },

          {
            $sort: {
              messages:
                -1,
            },
          },

          {
            $limit:
              5,
          },
        ]),
    ]);

  return {
    messages:
      asNumber(
        summary[0]
          ?.messages,
      ),

    activeMembers:
      asNumber(
        summary[0]
          ?.activeMembers,
      ),

    topMembers:
      topMembers.map(
        (
          item:
            any,
        ) => ({
          userId:
            String(
              item._id,
            ),

          messages:
            asNumber(
              item.messages,
            ),
        }),
      ),
  };
}

async function moderationMetrics(
  guildId:
    string,

  start:
    Date,

  end:
    Date,
) {
  const [
    total,
    breakdown,
  ] =
    await Promise.all([
      ModerationLog
        .countDocuments({
          guildId,

          createdAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),

      ModerationLog
        .aggregate([
          {
            $match: {
              guildId,

              createdAt: {
                $gte:
                  start,

                $lte:
                  end,
              },
            },
          },

          {
            $group: {
              _id:
                "$action",

              count: {
                $sum:
                  1,
              },
            },
          },

          {
            $sort: {
              count:
                -1,
            },
          },
        ]),
    ]);

  return {
    total,

    breakdown:
      breakdown.map(
        (
          item:
            any,
        ) => ({
          action:
            String(
              item._id,
            ),

          count:
            asNumber(
              item.count,
            ),
        }),
      ),
  };
}

async function ticketMetrics(
  guildId:
    string,

  start:
    Date,

  end:
    Date,
) {
  const [
    created,
    closed,
    open,
    resolution,
  ] =
    await Promise.all([
      Ticket.countDocuments({
        guildId,

        createdAt: {
          $gte:
            start,

          $lte:
            end,
        },
      }),

      Ticket.countDocuments({
        guildId,

        closedAt: {
          $gte:
            start,

          $lte:
            end,
        },
      }),

      Ticket.countDocuments({
        guildId,

        status: {
          $in: [
            "open",
            "claimed",
          ],
        },
      }),

      Ticket.aggregate([
        {
          $match: {
            guildId,

            closedAt: {
              $gte:
                start,

              $lte:
                end,
            },
          },
        },

        {
          $project: {
            durationMs: {
              $subtract: [
                "$closedAt",
                "$createdAt",
              ],
            },
          },
        },

        {
          $group: {
            _id:
              null,

            averageMs: {
              $avg:
                "$durationMs",
            },
          },
        },
      ]),
    ]);

  return {
    created,

    closed,

    open,

    averageResolutionHours:
      Math.round(
        (
          asNumber(
            resolution[0]
              ?.averageMs,
          ) /
          (
            60 *
            60 *
            1000
          )
        ) *
        10,
      ) /
      10,
  };
}

async function marketplaceMetrics(
  start:
    Date,

  end:
    Date,
) {
  const [
    created,
    completed,
    cancelled,
    expired,
    active,
  ] =
    await Promise.all([
      TradeRequest
        .countDocuments({
          createdAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),

      TradeRequest
        .countDocuments({
          completedAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),

      TradeRequest
        .countDocuments({
          cancelledAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),

      TradeRequest
        .countDocuments({
          expiredAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),

      TradeRequest
        .countDocuments({
          status: {
            $in: [
              "waiting_seller",
              "contacted",
              "buyer_confirmed",
            ],
          },
        }),
    ]);

  return {
    created,

    completed,

    cancelled,

    expired,

    active,

    completionRate:
      created >
        0
        ? Math.round(
            (
              completed /
              created
            ) *
            1000,
          ) /
          10
        : 0,
  };
}

async function giveawayMetrics(
  guildId:
    string,

  start:
    Date,

  end:
    Date,
) {
  const [
    created,
    ended,
    active,
    engagement,
  ] =
    await Promise.all([
      Giveaway.countDocuments({
        guildId,

        createdAt: {
          $gte:
            start,

          $lte:
            end,
        },
      }),

      Giveaway.countDocuments({
        guildId,

        endedAt: {
          $gte:
            start,

          $lte:
            end,
        },
      }),

      Giveaway.countDocuments({
        guildId,

        status:
          "active",
      }),

      Giveaway.aggregate([
        {
          $match: {
            guildId,

            createdAt: {
              $gte:
                start,

              $lte:
                end,
            },
          },
        },

        {
          $project: {
            entrantCount: {
              $size: {
                $ifNull: [
                  "$entrantIds",
                  [],
                ],
              },
            },
          },
        },

        {
          $group: {
            _id:
              null,

            entrants: {
              $sum:
                "$entrantCount",
            },
          },
        },
      ]),
    ]);

  return {
    created,

    ended,

    active,

    entrants:
      asNumber(
        engagement[0]
          ?.entrants,
      ),
  };
}

async function dungeonMetrics(
  start:
    Date,

  end:
    Date,
) {
  const [
    summary,
    players,
  ] =
    await Promise.all([
      DungeonRun.aggregate([
        {
          $match: {
            createdAt: {
              $gte:
                start,

              $lte:
                end,
            },
          },
        },

        {
          $group: {
            _id:
              null,

            runs: {
              $sum:
                1,
            },

            completed: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "completed",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            failed: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$status",
                      "failed",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),

      DungeonRun.aggregate([
        {
          $match: {
            createdAt: {
              $gte:
                start,

              $lte:
                end,
            },
          },
        },

        {
          $group: {
            _id:
              "$discordId",
          },
        },

        {
          $count:
            "count",
        },
      ]),
    ]);

  const runs =
    asNumber(
      summary[0]
        ?.runs,
    );

  const completed =
    asNumber(
      summary[0]
        ?.completed,
    );

  return {
    runs,

    completed,

    failed:
      asNumber(
        summary[0]
          ?.failed,
      ),

    players:
      asNumber(
        players[0]
          ?.count,
      ),

    successRate:
      runs >
        0
        ? Math.round(
            (
              completed /
              runs
            ) *
            1000,
          ) /
          10
        : 0,
  };
}

async function systemMetrics(
  guildId:
    string,

  start:
    Date,

  end:
    Date,
) {
  const [
    logs,
    warnings,
    errors,
  ] =
    await Promise.all([
      CommunityLogRecord
        .countDocuments({
          guildId,

          occurredAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),

      CommunityLogRecord
        .countDocuments({
          guildId,

          severity:
            "warning",

          occurredAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),

      CommunityLogRecord
        .countDocuments({
          guildId,

          severity:
            "error",

          occurredAt: {
            $gte:
              start,

            $lte:
              end,
          },
        }),
    ]);

  return {
    logs,

    warnings,

    errors,
  };
}

export const analyticsService = {
  async aggregate(
    guild:
      Guild,

    period:
      AnalyticsPeriod =
        "7d",
  ) {
    const range =
      getAnalyticsRange(
        period,
      );

    const [
      activity,
      moderation,
      tickets,
      marketplace,
      giveaways,
      dungeons,
      system,
    ] =
      await Promise.all([
        activityMetrics(
          guild.id,
          range.start,
          range.end,
        ),

        moderationMetrics(
          guild.id,
          range.start,
          range.end,
        ),

        ticketMetrics(
          guild.id,
          range.start,
          range.end,
        ),

        marketplaceMetrics(
          range.start,
          range.end,
        ),

        giveawayMetrics(
          guild.id,
          range.start,
          range.end,
        ),

        dungeonMetrics(
          range.start,
          range.end,
        ),

        systemMetrics(
          guild.id,
          range.start,
          range.end,
        ),
      ]);

    return {
      period,

      range,

      server: {
        memberCount:
          guild.memberCount,

        channels:
          guild.channels
            .cache.size,

        roles:
          Math.max(
            0,
            guild.roles
              .cache.size -
            1,
          ),
      },

      activity,

      moderation,

      tickets,

      marketplace,

      giveaways,

      dungeons,

      system,
    };
  },

  async captureSnapshot(
    guild:
      Guild,
  ) {
    const metrics =
      await analyticsService
        .aggregate(
          guild,
          "today",
        );

    const dateKey =
      analyticsDateKey();

    return AnalyticsSnapshot
      .findOneAndUpdate(
        {
          guildId:
            guild.id,

          dateKey,
        },
        {
          $set: {
            metrics,

            capturedAt:
              new Date(),
          },

          $setOnInsert: {
            guildId:
              guild.id,

            dateKey,
          },
        },
        {
          upsert:
            true,

          new:
            true,

          setDefaultsOnInsert:
            true,
        },
      );
  },

  async getHistory(
    guildId:
      string,

    days:
      number,
  ) {
    const safeDays =
      Math.max(
        1,
        Math.min(
          30,
          Math.floor(
            days,
          ),
        ),
      );

    return AnalyticsSnapshot
      .find({
        guildId,
      })
      .sort({
        dateKey:
          -1,
      })
      .limit(
        safeDays,
      );
  },
};
