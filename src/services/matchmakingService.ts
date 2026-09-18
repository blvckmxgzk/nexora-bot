import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type Client,
  type Guild,
} from "discord.js";

import {
  randomBytes,
} from "node:crypto";

import {
  MatchmakingProfile,
} from "../models/MatchmakingProfile.js";

import {
  MatchmakingQueue,
} from "../models/MatchmakingQueue.js";

import {
  MatchmakingSession,
} from "../models/MatchmakingSession.js";

import {
  communityLoggingService,
} from "./logging/communityLoggingService.js";

export type MatchmakingMode =
  | "friend"
  | "chat"
  | "gaming";

export type MatchmakingAgeGroup =
  | "13-17"
  | "18+";

export const MATCHMAKING_PREFIX =
  "nexora_matchmaking:";

const MODE_DATA:
  Record<
    MatchmakingMode,
    {
      name:
        string;

      emoji:
        string;

      description:
        string;
    }
  > = {
    friend: {
      name:
        "หาเพื่อน",

      emoji:
        "🫂",

      description:
        "สุ่มสมาชิกใหม่เพื่อทำความรู้จัก",
    },

    chat: {
      name:
        "คุยเล่น",

      emoji:
        "💬",

      description:
        "จับคู่คนที่อยากหาคนคุย",
    },

    gaming: {
      name:
        "เล่นเกม",

      emoji:
        "🎮",

      description:
        "จับคู่หาเพื่อนไปเล่นเกมด้วยกัน",
    },
  };

function createSessionId():
  string {
  return [
    "PAIR",
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

function modeData(
  mode:
    MatchmakingMode,
) {
  return MODE_DATA[
    mode
  ];
}

function isMode(
  value:
    string,
): value is
  MatchmakingMode {
  return (
    value ===
      "friend" ||
    value ===
      "chat" ||
    value ===
      "gaming"
  );
}

async function activeSessionFor(
  guildId:
    string,

  userId:
    string,
) {
  return MatchmakingSession
    .findOne({
      guildId,

      status:
        "active",

      $or: [
        {
          userAId:
            userId,
        },

        {
          userBId:
            userId,
        },
      ],
    });
}

function homeRows(
  profile:
    any |
    null,

  queue:
    any |
    null,

  activeSession:
    any |
    null,
) {
  const rows:
    ActionRowBuilder<any>[] =
      [];

  if (!profile) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${MATCHMAKING_PREFIX}age:13-17`,
            )
            .setLabel(
              "ฉันอายุ 13–17",
            )
            .setEmoji(
              "🟦",
            )
            .setStyle(
              ButtonStyle.Primary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `${MATCHMAKING_PREFIX}age:18+`,
            )
            .setLabel(
              "ฉันอายุ 18+",
            )
            .setEmoji(
              "🟪",
            )
            .setStyle(
              ButtonStyle.Primary,
            ),
        ),
    );

    return rows;
  }

  if (
    !queue &&
    !activeSession
  ) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `${MATCHMAKING_PREFIX}join`,
            )
            .setPlaceholder(
              "เลือกประเภทการจับคู่",
            )
            .addOptions(
              {
                label:
                  "🫂 หาเพื่อน",

                description:
                  MODE_DATA
                    .friend
                    .description,

                value:
                  "friend",
              },

              {
                label:
                  "💬 คุยเล่น",

                description:
                  MODE_DATA
                    .chat
                    .description,

                value:
                  "chat",
              },

              {
                label:
                  "🎮 เล่นเกม",

                description:
                  MODE_DATA
                    .gaming
                    .description,

                value:
                  "gaming",
              },
            ),
        ),
    );
  }

  const buttons =
    new ActionRowBuilder<ButtonBuilder>();

  if (
    queue?.status ===
    "waiting"
  ) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${MATCHMAKING_PREFIX}leave`,
        )
        .setLabel(
          "ออกจากคิว",
        )
        .setEmoji(
          "🚪",
        )
        .setStyle(
          ButtonStyle.Danger,
        ),
    );
  }

  if (activeSession) {
    buttons.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${MATCHMAKING_PREFIX}end`,
        )
        .setLabel(
          "จบการจับคู่",
        )
        .setEmoji(
          "🛑",
        )
        .setStyle(
          ButtonStyle.Danger,
        ),
    );
  }

  buttons.addComponents(
    new ButtonBuilder()
      .setCustomId(
        `${MATCHMAKING_PREFIX}history`,
      )
      .setLabel(
        "ประวัติ",
      )
      .setEmoji(
        "📜",
      )
      .setStyle(
        ButtonStyle.Secondary,
      ),

    new ButtonBuilder()
      .setCustomId(
        `${MATCHMAKING_PREFIX}home`,
      )
      .setLabel(
        "Refresh",
      )
      .setEmoji(
        "🔄",
      )
      .setStyle(
        ButtonStyle.Secondary,
      ),
  );

  rows.push(
    buttons,
  );

  if (
    !queue &&
    !activeSession
  ) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${MATCHMAKING_PREFIX}age:${profile.ageGroup === "13-17" ? "18+" : "13-17"}`,
            )
            .setLabel(
              `เปลี่ยนเป็น ${profile.ageGroup === "13-17" ? "18+" : "13–17"}`,
            )
            .setEmoji(
              "⚙️",
            )
            .setStyle(
              ButtonStyle.Secondary,
            ),
        ),
    );
  }

  return rows;
}

export const matchmakingService = {
  isMode,

  modeData,

  buildPanel() {
    const embed =
      new EmbedBuilder()
        .setColor(
          0x5865f2,
        )
        .setTitle(
          "🫂 NEXORA • จับคู่",
        )
        .setDescription(
          [
            "อยากหาเพื่อนใหม่ คนคุย หรือเพื่อนไปเล่นเกม?",
            "ให้ NEXORA สุ่มจับคู่สมาชิกให้คุณ",
            "",
            "**โหมด**",
            "🫂 **หาเพื่อน** — ทำความรู้จักสมาชิกใหม่",
            "💬 **คุยเล่น** — หาเพื่อนคุยชิล ๆ",
            "🎮 **เล่นเกม** — หาเพื่อนไปเล่นเกมด้วยกัน",
            "",
            "เมื่อจับคู่สำเร็จ ระบบจะส่ง DM ให้ทั้งสองฝ่าย",
            "",
            "🔒 กลุ่มอายุ 13–17 และ 18+ จะแยกคิวออกจากกัน",
          ].join(
            "\n",
          ),
        )
        .setFooter({
          text:
            "NEXORA Matchmaking • Opt-in only",
        })
        .setTimestamp();

    return {
      embeds: [
        embed,
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${MATCHMAKING_PREFIX}home`,
              )
              .setLabel(
                "เปิดระบบจับคู่",
              )
              .setEmoji(
                "🫂",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),
          ),
      ],
    };
  },

  async home(
    guildId:
      string,

    userId:
      string,

    notice?:
      string,
  ) {
    const [
      profile,
      queue,
      session,
    ] =
      await Promise.all([
        MatchmakingProfile
          .findOne({
            guildId,
            userId,
          }),

        MatchmakingQueue
          .findOne({
            guildId,
            userId,

            status: {
              $in: [
                "waiting",
                "matching",
              ],
            },
          }),

        activeSessionFor(
          guildId,
          userId,
        ),
      ]);

    let description:
      string;

    if (!profile) {
      description = [
        "ก่อนเริ่มใช้งาน เลือกกลุ่มอายุของคุณ",
        "",
        "ระบบใช้ข้อมูลนี้เพื่อแยกคิว **13–17** และ **18+** ออกจากกัน",
        "",
        "ข้อมูลนี้เป็นข้อมูลที่สมาชิกเลือกเองและเปลี่ยนได้เมื่อไม่ได้อยู่ในคิว",
      ].join(
        "\n",
      );
    } else if (session) {
      const otherUserId =
        session.userAId ===
        userId
          ? session.userBId
          : session.userAId;

      const mode =
        modeData(
          session.mode as
            MatchmakingMode,
        );

      description = [
        "✅ **จับคู่สำเร็จแล้ว**",
        "",
        `${mode.emoji} โหมด: **${mode.name}**`,
        `👤 คู่ของคุณ: <@${otherUserId}>`,
        `🎂 กลุ่มอายุ: **${session.ageGroup}**`,
        "",
        "ระบบส่งรายละเอียดทาง DM ให้แล้ว",
      ].join(
        "\n",
      );
    } else if (
      queue?.status ===
      "waiting"
    ) {
      const mode =
        modeData(
          queue.mode as
            MatchmakingMode,
        );

      description = [
        "🔎 **กำลังค้นหาคู่...**",
        "",
        `${mode.emoji} โหมด: **${mode.name}**`,
        `🎂 กลุ่มอายุ: **${profile.ageGroup}**`,
        `⏰ เข้าคิว: <t:${Math.floor(
          new Date(
            queue.joinedAt,
          ).getTime() /
          1000,
        )}:R>`,
        "",
        "ระบบจะจับคู่ให้อัตโนมัติเมื่อมีสมาชิกที่ตรงกัน",
      ].join(
        "\n",
      );
    } else if (
      queue?.status ===
      "matching"
    ) {
      description = [
        "⏳ **กำลังยืนยันการจับคู่...**",
        "",
        "อีกนิดเดียว ระบบกำลังสร้าง Session ให้คุณ",
      ].join(
        "\n",
      );
    } else {
      description = [
        `🎂 กลุ่มอายุ: **${profile.ageGroup}**`,
        "",
        "เลือกโหมดที่ต้องการจากเมนูด้านล่าง",
        "",
        "🫂 หาเพื่อน",
        "💬 คุยเล่น",
        "🎮 เล่นเกม",
      ].join(
        "\n",
      );
    }

    return {
      content:
        notice ??
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0x5865f2,
          )
          .setTitle(
            "🫂 NEXORA Matchmaking",
          )
          .setDescription(
            description,
          )
          .setFooter({
            text:
              "จับคู่เฉพาะผู้ที่สมัครใจเข้าคิว",
          })
          .setTimestamp(),
      ],

      components:
        homeRows(
          profile,
          queue,
          session,
        ),

      allowedMentions: {
        parse:
          [],
      },
    };
  },

  async setAgeGroup(
    guildId:
      string,

    userId:
      string,

    ageGroup:
      MatchmakingAgeGroup,
  ) {
    const [
      queue,
      session,
    ] =
      await Promise.all([
        MatchmakingQueue
          .findOne({
            guildId,
            userId,

            status: {
              $in: [
                "waiting",
                "matching",
              ],
            },
          }),

        activeSessionFor(
          guildId,
          userId,
        ),
      ]);

    if (
      queue ||
      session
    ) {
      throw new Error(
        "ไม่สามารถเปลี่ยนกลุ่มอายุขณะอยู่ในคิวหรือมีคู่ที่ Active",
      );
    }

    return MatchmakingProfile
      .findOneAndUpdate(
        {
          guildId,
          userId,
        },
        {
          $set: {
            ageGroup,
          },

          $setOnInsert: {
            guildId,
            userId,
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

  async joinQueue(
    guildId:
      string,

    userId:
      string,

    mode:
      MatchmakingMode,
  ) {
    const profile =
      await MatchmakingProfile
        .findOne({
          guildId,
          userId,
        });

    if (!profile) {
      throw new Error(
        "กรุณาเลือกกลุ่มอายุก่อนเข้าคิว",
      );
    }

    const activeSession =
      await activeSessionFor(
        guildId,
        userId,
      );

    if (activeSession) {
      throw new Error(
        "คุณมีคู่ที่ Active อยู่แล้ว กรุณาจบ Session เดิมก่อน",
      );
    }

    return MatchmakingQueue
      .findOneAndUpdate(
        {
          guildId,
          userId,
        },
        {
          $set: {
            ageGroup:
              profile.ageGroup,

            mode,

            status:
              "waiting",

            sessionId:
              null,

            joinedAt:
              new Date(),

            matchingStartedAt:
              null,
          },

          $setOnInsert: {
            guildId,
            userId,
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

  async leaveQueue(
    guildId:
      string,

    userId:
      string,
  ) {
    const result =
      await MatchmakingQueue
        .findOneAndUpdate(
          {
            guildId,
            userId,

            status:
              "waiting",
          },
          {
            $set: {
              status:
                "cancelled",

              sessionId:
                null,

              matchingStartedAt:
                null,
            },
          },
          {
            new:
              true,
          },
        );

    if (!result) {
      throw new Error(
        "คุณไม่ได้อยู่ในคิว",
      );
    }

    return result;
  },

  async endSession(
    guildId:
      string,

    userId:
      string,
  ) {
    const session =
      await MatchmakingSession
        .findOneAndUpdate(
          {
            guildId,

            status:
              "active",

            $or: [
              {
                userAId:
                  userId,
              },

              {
                userBId:
                  userId,
              },
            ],
          },
          {
            $set: {
              status:
                "ended",

              endedAt:
                new Date(),

              endedBy:
                userId,
            },
          },
          {
            new:
              true,
          },
        );

    if (!session) {
      throw new Error(
        "ไม่มี Matchmaking Session ที่ Active",
      );
    }

    await MatchmakingQueue
      .updateMany(
        {
          guildId,

          sessionId:
            session.sessionId,
        },
        {
          $set: {
            status:
              "cancelled",

            sessionId:
              null,

            matchingStartedAt:
              null,
          },
        },
      );

    return session;
  },

  async history(
    guildId:
      string,

    userId:
      string,
  ) {
    const sessions =
      await MatchmakingSession
        .find({
          guildId,

          $or: [
            {
              userAId:
                userId,
            },

            {
              userBId:
                userId,
            },
          ],
        })
        .sort({
          startedAt:
            -1,
        })
        .limit(
          10,
        );

    const lines =
      sessions.length >
      0
        ? sessions.map(
            (
              session:
                any,

              index:
                number,
            ) => {
              const other =
                session.userAId ===
                userId
                  ? session.userBId
                  : session.userAId;

              const mode =
                modeData(
                  session.mode as
                    MatchmakingMode,
                );

              return [
                `${index + 1}. ${mode.emoji} <@${other}>`,
                `   ${mode.name} • ${session.status === "active" ? "🟢 Active" : "⚫ Ended"} • <t:${Math.floor(
                  new Date(
                    session.startedAt,
                  ).getTime() /
                  1000,
                )}:R>`,
              ].join(
                "\n",
              );
            },
          )
          .join(
            "\n\n",
          )
        : "ยังไม่มีประวัติการจับคู่";

    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0x5865f2,
          )
          .setTitle(
            "📜 Matchmaking History",
          )
          .setDescription(
            lines,
          )
          .setFooter({
            text:
              "แสดง 10 Session ล่าสุด",
          }),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${MATCHMAKING_PREFIX}home`,
              )
              .setLabel(
                "หน้าหลัก",
              )
              .setEmoji(
                "🏠",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),
          ),
      ],

      allowedMentions: {
        parse:
          [],
      },
    };
  },

  async recoverStuckQueues():
    Promise<number> {
    const result =
      await MatchmakingQueue
        .updateMany(
          {
            status:
              "matching",

            matchingStartedAt: {
              $lt:
                new Date(
                  Date.now() -
                  60_000,
                ),
            },
          },
          {
            $set: {
              status:
                "waiting",

              sessionId:
                null,

              matchingStartedAt:
                null,
            },
          },
        );

    return result.modifiedCount;
  },

  async processQueues(
    client:
      Client,
  ): Promise<number> {
    const waiting =
      await MatchmakingQueue
        .find({
          status:
            "waiting",
        })
        .sort({
          joinedAt:
            1,
        })
        .limit(
          200,
        );

    const groups =
      new Map<
        string,
        any[]
      >();

    for (
      const queue of
      waiting
    ) {
      const key =
        [
          queue.guildId,
          queue.ageGroup,
          queue.mode,
        ].join(
          ":",
        );

      const group =
        groups.get(
          key,
        ) ??
        [];

      group.push(
        queue,
      );

      groups.set(
        key,
        group,
      );
    }

    let paired =
      0;

    for (
      const group of
      groups.values()
    ) {
      while (
        group.length >=
        2
      ) {
        const first =
          group.shift()!;

        const second =
          group.shift()!;

        const sessionId =
          createSessionId();

        const firstClaim =
          await MatchmakingQueue
            .updateOne(
              {
                _id:
                  first._id,

                status:
                  "waiting",
              },
              {
                $set: {
                  status:
                    "matching",

                  sessionId,

                  matchingStartedAt:
                    new Date(),
                },
              },
            );

        if (
          firstClaim.modifiedCount !==
          1
        ) {
          continue;
        }

        const secondClaim =
          await MatchmakingQueue
            .updateOne(
              {
                _id:
                  second._id,

                status:
                  "waiting",
              },
              {
                $set: {
                  status:
                    "matching",

                  sessionId,

                  matchingStartedAt:
                    new Date(),
                },
              },
            );

        if (
          secondClaim.modifiedCount !==
          1
        ) {
          await MatchmakingQueue
            .updateOne(
              {
                _id:
                  first._id,

                sessionId,

                status:
                  "matching",
              },
              {
                $set: {
                  status:
                    "waiting",

                  sessionId:
                    null,

                  matchingStartedAt:
                    null,
                },
              },
            );

          continue;
        }

        try {
          const existingActive =
            await MatchmakingSession
              .findOne({
                guildId:
                  first.guildId,

                status:
                  "active",

                $or: [
                  {
                    userAId: {
                      $in: [
                        first.userId,
                        second.userId,
                      ],
                    },
                  },

                  {
                    userBId: {
                      $in: [
                        first.userId,
                        second.userId,
                      ],
                    },
                  },
                ],
              });

          if (existingActive) {
            await MatchmakingQueue
              .updateMany(
                {
                  sessionId,

                  status:
                    "matching",
                },
                {
                  $set: {
                    status:
                      "cancelled",

                    sessionId:
                      null,

                    matchingStartedAt:
                      null,
                  },
                },
              );

            continue;
          }

          const session =
            await MatchmakingSession
              .create({
                sessionId,

                guildId:
                  first.guildId,

                mode:
                  first.mode,

                ageGroup:
                  first.ageGroup,

                userAId:
                  first.userId,

                userBId:
                  second.userId,

                status:
                  "active",

                startedAt:
                  new Date(),
              });

          await MatchmakingQueue
            .updateMany(
              {
                sessionId,

                status:
                  "matching",
              },
              {
                $set: {
                  status:
                    "matched",

                  matchingStartedAt:
                    null,
                },
              },
            );

          await matchmakingService
            .notifyPair(
              client,
              session,
            );

          paired +=
            1;
        } catch (error) {
          console.error(
            `❌ Matchmaking pair creation failed • ${sessionId}:`,
            error,
          );

          await MatchmakingQueue
            .updateMany(
              {
                sessionId,

                status:
                  "matching",
              },
              {
                $set: {
                  status:
                    "waiting",

                  sessionId:
                    null,

                  matchingStartedAt:
                    null,
                },
              },
            );
        }
      }
    }

    return paired;
  },

  async notifyPair(
    client:
      Client,

    session:
      any,
  ): Promise<void> {
    const mode =
      modeData(
        session.mode as
          MatchmakingMode,
      );

    const safety =
      session.ageGroup ===
      "13-17"
        ? [
            "",
            "🛡️ **Safety:** อย่าแชร์ที่อยู่ โรงเรียน ตารางเวลา หรือข้อมูลส่วนตัวละเอียดกับคนที่เพิ่งรู้จัก",
          ].join(
            "\n",
          )
        : "";

    const first =
      await client.users
        .fetch(
          session.userAId,
        )
        .catch(
          () =>
            null,
        );

    const second =
      await client.users
        .fetch(
          session.userBId,
        )
        .catch(
          () =>
            null,
        );

    await first
      ?.send({
        content: [
          "🫂 **NEXORA จับคู่สำเร็จ!**",
          "",
          `${mode.emoji} โหมด: **${mode.name}**`,
          `👤 คู่ของคุณ: <@${session.userBId}>`,
          `🎂 กลุ่มอายุ: **${session.ageGroup}**`,
          "",
          "ทักไปทำความรู้จักกันได้เลย 👋",
          safety,
        ]
          .filter(
            Boolean,
          )
          .join(
            "\n",
          ),

        allowedMentions: {
          users: [
            session.userBId,
          ],
        },
      })
      .catch(
        () =>
          undefined,
      );

    await second
      ?.send({
        content: [
          "🫂 **NEXORA จับคู่สำเร็จ!**",
          "",
          `${mode.emoji} โหมด: **${mode.name}**`,
          `👤 คู่ของคุณ: <@${session.userAId}>`,
          `🎂 กลุ่มอายุ: **${session.ageGroup}**`,
          "",
          "ทักไปทำความรู้จักกันได้เลย 👋",
          safety,
        ]
          .filter(
            Boolean,
          )
          .join(
            "\n",
          ),

        allowedMentions: {
          users: [
            session.userAId,
          ],
        },
      })
      .catch(
        () =>
          undefined,
      );

    const guild =
      client.guilds
        .cache.get(
          session.guildId,
        );

    if (guild) {
      await communityLoggingService
        .system(
          guild,
          {
            event:
              "matchmaking_pair",

            title:
              "Matchmaking Pair Created",

            severity:
              "success",

            actorId:
              session.userAId,

            metadata: {
              sessionId:
                session.sessionId,

              mode:
                session.mode,

              ageGroup:
                session.ageGroup,

              userAId:
                session.userAId,

              userBId:
                session.userBId,
            },
          },
        )
        .catch(
          () =>
            undefined,
        );
    }
  },
};
