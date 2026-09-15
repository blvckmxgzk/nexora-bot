import {
  AuditLogEvent,
  Events,
  PermissionFlagsBits,
  type AutoModerationActionExecution,
  type Client,
  type GuildBan,
  type GuildMember,
  type Message,
  type PartialGuildMember,
  type PartialMessage,
  type VoiceState,
} from "discord.js";

import {
  communityLoggingService,
} from "./communityLoggingService.js";

const AUDIT_MATCH_WINDOW_MS =
  7_500;

function unix(
  date:
    Date |
    null |
    undefined,
): number | null {
  if (!date) {
    return null;
  }

  return Math.floor(
    date.getTime() /
      1000,
  );
}

class CommunityLoggingRuntime {
  private started =
    false;

  private client:
    Client | null =
    null;

  private readonly onReady =
    (
      readyClient:
        Client<true>,
    ): void => {
      void (
        async () => {
          for (
            const guild of
              readyClient.guilds
                .cache.values()
          ) {
            try {
              await communityLoggingService.ensureInfrastructure(
                guild,
              );

              await communityLoggingService.system(
                guild,
                {
                  event:
                    "bot_ready",

                  title:
                    "NEXORA Online",

                  severity:
                    "success",

                  description:
                    `บอทออนไลน์และระบบ Logging พร้อมทำงานแล้ว`,

                  fields: [
                    {
                      name:
                        "Guild",

                      value:
                        `${guild.name}\n\`${guild.id}\``,

                      inline:
                        true,
                    },

                    {
                      name:
                        "สมาชิก",

                      value:
                        guild.memberCount.toLocaleString(),

                      inline:
                        true,
                    },
                  ],
                },
              );
            } catch (error) {
              console.error(
                `❌ Logging bootstrap failed for ${guild.id}:`,
                error,
              );
            }
          }

          console.log(
            "📝 NEXORA Community Logging runtime started",
          );
        }
      )();
    };

  private readonly onGuildMemberAdd =
    (
      member:
        GuildMember,
    ): void => {
      if (
        member.user.bot
      ) {
        return;
      }

      const created =
        unix(
          member.user
            .createdAt,
        );

      void communityLoggingService.member(
        member.guild,
        {
          event:
            "member_join",

          title:
            "สมาชิกเข้าเซิร์ฟเวอร์",

          severity:
            "success",

          userId:
            member.id,

          fields: [
            ...(created
              ? [
                  {
                    name:
                      "สร้างบัญชี",

                    value:
                      `<t:${created}:F>\n<t:${created}:R>`,

                    inline:
                      false,
                  },
                ]
              : []),

            {
              name:
                "จำนวนสมาชิก",

              value:
                member.guild
                  .memberCount
                  .toLocaleString(),

              inline:
                true,
            },
          ],
        },
      );
    };

  private readonly onGuildMemberRemove =
    (
      member:
        GuildMember |
        PartialGuildMember,
    ): void => {
      if (
        member.user.bot
      ) {
        return;
      }

      void (
        async () => {
          const joined =
            unix(
              member.joinedAt,
            );

          await communityLoggingService.member(
            member.guild,
            {
              event:
                "member_leave",

              title:
                "สมาชิกออกจากเซิร์ฟเวอร์",

              severity:
                "warning",

              userId:
                member.id,

              fields: [
                ...(joined
                  ? [
                      {
                        name:
                          "เข้าร่วมเมื่อ",

                        value:
                          `<t:${joined}:F>\n<t:${joined}:R>`,

                        inline:
                          false,
                      },
                    ]
                  : []),

                {
                  name:
                    "จำนวนสมาชิก",

                  value:
                    member.guild
                      .memberCount
                      .toLocaleString(),

                  inline:
                    true,
                },
              ],
            },
          );

          const me =
            member.guild
              .members.me;

          if (
            !me?.permissions.has(
              PermissionFlagsBits.ViewAuditLog,
            )
          ) {
            return;
          }

          try {
            const audit =
              await member.guild.fetchAuditLogs(
                {
                  type:
                    AuditLogEvent.MemberKick,

                  limit:
                    5,
                },
              );

            const entry =
              audit.entries.find(
                (candidate) =>
                  candidate.target?.id ===
                    member.id &&
                  Date.now() -
                    candidate.createdTimestamp <=
                    AUDIT_MATCH_WINDOW_MS,
              );

            if (!entry) {
              return;
            }

            await communityLoggingService.moderation(
              member.guild,
              {
                event:
                  "member_kick",

                title:
                  "สมาชิกถูก Kick",

                severity:
                  "warning",

                userId:
                  member.id,

                actorId:
                  entry.executorId ??
                  null,

                fields: [
                  {
                    name:
                      "เหตุผล",

                    value:
                      entry.reason ??
                      "ไม่ได้ระบุ",

                    inline:
                      false,
                  },
                ],
              },
            );
          } catch {
            // Audit Log เป็น enhancement
            // การไม่มีสิทธิ์ต้องไม่ทำให้ระบบหลักล้ม
          }
        }
      )();
    };

  private readonly onGuildMemberUpdate =
    (
      oldMember:
        GuildMember |
        PartialGuildMember,

      newMember:
        GuildMember,
    ): void => {
      if (
        newMember.user.bot
      ) {
        return;
      }

      void (
        async () => {
          const oldRoleIds =
            new Set(
              oldMember.roles.cache
                .filter(
                  (role) =>
                    role.id !==
                    oldMember.guild.id,
                )
                .map(
                  (role) =>
                    role.id,
                ),
            );

          const newRoleIds =
            new Set(
              newMember.roles.cache
                .filter(
                  (role) =>
                    role.id !==
                    newMember.guild.id,
                )
                .map(
                  (role) =>
                    role.id,
                ),
            );

          const added =
            Array.from(
              newRoleIds,
            ).filter(
              (id) =>
                !oldRoleIds.has(
                  id,
                ),
            );

          const removed =
            Array.from(
              oldRoleIds,
            ).filter(
              (id) =>
                !newRoleIds.has(
                  id,
                ),
            );

          if (
            added.length > 0 ||
            removed.length > 0
          ) {
            await communityLoggingService.member(
              newMember.guild,
              {
                event:
                  "member_roles_update",

                title:
                  "Role ของสมาชิกเปลี่ยนแปลง",

                userId:
                  newMember.id,

                fields: [
                  ...(added.length > 0
                    ? [
                        {
                          name:
                            "เพิ่ม Role",

                          value:
                            added
                              .map(
                                (id) =>
                                  `<@&${id}>`,
                              )
                              .join(
                                "\n",
                              ),

                          inline:
                            false,
                        },
                      ]
                    : []),

                  ...(removed.length > 0
                    ? [
                        {
                          name:
                            "ถอด Role",

                          value:
                            removed
                              .map(
                                (id) =>
                                  `<@&${id}>`,
                              )
                              .join(
                                "\n",
                              ),

                          inline:
                            false,
                        },
                      ]
                    : []),
                ],

                metadata: {
                  addedRoleIds:
                    added,

                  removedRoleIds:
                    removed,
                },
              },
            );
          }

          if (
            oldMember.nickname !==
            newMember.nickname
          ) {
            await communityLoggingService.member(
              newMember.guild,
              {
                event:
                  "nickname_update",

                title:
                  "Nickname เปลี่ยนแปลง",

                userId:
                  newMember.id,

                fields: [
                  {
                    name:
                      "ก่อน",

                    value:
                      oldMember.nickname ??
                      oldMember.user
                        .username,

                    inline:
                      true,
                  },

                  {
                    name:
                      "หลัง",

                    value:
                      newMember.nickname ??
                      newMember.user
                        .username,

                    inline:
                      true,
                  },
                ],
              },
            );
          }

          const oldTimeout =
            oldMember
              .communicationDisabledUntilTimestamp ??
            null;

          const newTimeout =
            newMember
              .communicationDisabledUntilTimestamp ??
            null;

          if (
            oldTimeout !==
            newTimeout
          ) {
            if (
              newTimeout &&
              newTimeout >
                Date.now()
            ) {
              await communityLoggingService.moderation(
                newMember.guild,
                {
                  event:
                    "member_timeout",

                  title:
                    "สมาชิกถูก Timeout",

                  severity:
                    "warning",

                  userId:
                    newMember.id,

                  fields: [
                    {
                      name:
                        "หมดเวลา",

                      value:
                        `<t:${Math.floor(
                          newTimeout /
                            1000,
                        )}:F>\n<t:${Math.floor(
                          newTimeout /
                            1000,
                        )}:R>`,

                      inline:
                        false,
                    },
                  ],
                },
              );
            } else {
              await communityLoggingService.moderation(
                newMember.guild,
                {
                  event:
                    "member_timeout_removed",

                  title:
                    "Timeout ถูกยกเลิก",

                  severity:
                    "success",

                  userId:
                    newMember.id,
                },
              );
            }
          }
        }
      )();
    };

  private readonly onGuildBanAdd =
    (
      ban:
        GuildBan,
    ): void => {
      void communityLoggingService.moderation(
        ban.guild,
        {
          event:
            "member_ban",

          title:
            "สมาชิกถูก Ban",

          severity:
            "error",

          userId:
            ban.user.id,

          fields: [
            {
              name:
                "เหตุผล",

              value:
                ban.reason ??
                "ไม่ได้ระบุ",

              inline:
                false,
            },
          ],
        },
      );
    };

  private readonly onGuildBanRemove =
    (
      ban:
        GuildBan,
    ): void => {
      void communityLoggingService.moderation(
        ban.guild,
        {
          event:
            "member_unban",

          title:
            "สมาชิกถูก Unban",

          severity:
            "success",

          userId:
            ban.user.id,
        },
      );
    };

  private readonly onMessageDelete =
    (
      message:
        Message |
        PartialMessage,
    ): void => {
      const guild =
        message.guild;

      if (!guild) {
        return;
      }

      if (
        message.author?.bot
      ) {
        return;
      }

      void communityLoggingService.moderation(
        guild,
        {
          event:
            "message_delete",

          title:
            "ข้อความถูกลบ",

          userId:
            message.author?.id ??
            null,

          channelId:
            message.channelId,

          fields: [
            {
              name:
                "Message ID",

              value:
                `\`${message.id}\``,

              inline:
                false,
            },

            {
              name:
                "หมายเหตุ",

              value:
                "ไม่ได้เปิด Message Content Intent จึงเก็บเฉพาะ metadata ของข้อความ",

              inline:
                false,
            },
          ],

          metadata: {
            messageId:
              message.id,
          },
        },
      );
    };

  private readonly onMessageUpdate =
    (
      oldMessage:
        Message |
        PartialMessage,

      newMessage:
        Message |
        PartialMessage,
    ): void => {
      const guild =
        newMessage.guild;

      if (!guild) {
        return;
      }

      if (
        newMessage.author?.bot
      ) {
        return;
      }

      void communityLoggingService.moderation(
        guild,
        {
          event:
            "message_update",

          title:
            "ข้อความถูกแก้ไข",

          userId:
            newMessage.author?.id ??
            oldMessage.author?.id ??
            null,

          channelId:
            newMessage.channelId,

          fields: [
            {
              name:
                "Message ID",

              value:
                `\`${newMessage.id}\``,

              inline:
                false,
            },
          ],

          metadata: {
            messageId:
              newMessage.id,
          },
        },
      );
    };

  private readonly onVoiceStateUpdate =
    (
      oldState:
        VoiceState,

      newState:
        VoiceState,
    ): void => {
      const member =
        newState.member ??
        oldState.member;

      if (
        member?.user.bot
      ) {
        return;
      }

      const guild =
        newState.guild;

      void (
        async () => {
          if (
            oldState.channelId !==
            newState.channelId
          ) {
            if (
              !oldState.channelId &&
              newState.channelId
            ) {
              await communityLoggingService.voice(
                guild,
                {
                  event:
                    "voice_join",

                  title:
                    "เข้าห้อง Voice",

                  userId:
                    newState.id,

                  channelId:
                    newState.channelId,
                },
              );
            } else if (
              oldState.channelId &&
              !newState.channelId
            ) {
              await communityLoggingService.voice(
                guild,
                {
                  event:
                    "voice_leave",

                  title:
                    "ออกจากห้อง Voice",

                  userId:
                    oldState.id,

                  channelId:
                    oldState.channelId,
                },
              );
            } else if (
              oldState.channelId &&
              newState.channelId
            ) {
              await communityLoggingService.voice(
                guild,
                {
                  event:
                    "voice_move",

                  title:
                    "ย้ายห้อง Voice",

                  userId:
                    newState.id,

                  fields: [
                    {
                      name:
                        "จาก",

                      value:
                        `<#${oldState.channelId}>`,

                      inline:
                        true,
                    },

                    {
                      name:
                        "ไป",

                      value:
                        `<#${newState.channelId}>`,

                      inline:
                        true,
                    },
                  ],

                  metadata: {
                    oldChannelId:
                      oldState.channelId,

                    newChannelId:
                      newState.channelId,
                  },
                },
              );
            }
          }

          const changedStates:
            string[] = [];

          if (
            oldState.serverMute !==
            newState.serverMute
          ) {
            changedStates.push(
              `Server Mute: **${newState.serverMute ? "ON" : "OFF"}**`,
            );
          }

          if (
            oldState.serverDeaf !==
            newState.serverDeaf
          ) {
            changedStates.push(
              `Server Deaf: **${newState.serverDeaf ? "ON" : "OFF"}**`,
            );
          }

          if (
            changedStates.length >
            0
          ) {
            await communityLoggingService.voice(
              guild,
              {
                event:
                  "voice_moderation_state",

                title:
                  "สถานะ Voice เปลี่ยนแปลง",

                userId:
                  newState.id,

                channelId:
                  newState.channelId ??
                  oldState.channelId,

                fields: [
                  {
                    name:
                      "การเปลี่ยนแปลง",

                    value:
                      changedStates.join(
                        "\n",
                      ),

                    inline:
                      false,
                  },
                ],
              },
            );
          }
        }
      )();
    };

  private readonly onAutoModerationAction =
    (
      execution:
        AutoModerationActionExecution,
    ): void => {
      void communityLoggingService.moderation(
        execution.guild,
        {
          event:
            "automod_action",

          title:
            "AutoMod ดำเนินการ",

          severity:
            "warning",

          userId:
            execution.userId,

          channelId:
            execution.channelId,

          fields: [
            {
              name:
                "Rule ID",

              value:
                `\`${execution.ruleId}\``,

              inline:
                true,
            },

            {
              name:
                "Action",

              value:
                String(
                  execution.action
                    .type,
                ),

              inline:
                true,
            },
          ],

          metadata: {
            ruleId:
              execution.ruleId,

            actionType:
              execution.action
                .type,
          },
        },
      );
    };

  public start(
    client:
      Client,
  ): void {
    if (this.started) {
      return;
    }

    this.started =
      true;

    this.client =
      client;

    client.once(
      Events.ClientReady,
      this.onReady,
    );

    client.on(
      Events.GuildMemberAdd,
      this.onGuildMemberAdd,
    );

    client.on(
      Events.GuildMemberRemove,
      this.onGuildMemberRemove,
    );

    client.on(
      Events.GuildMemberUpdate,
      this.onGuildMemberUpdate,
    );

    client.on(
      Events.GuildBanAdd,
      this.onGuildBanAdd,
    );

    client.on(
      Events.GuildBanRemove,
      this.onGuildBanRemove,
    );

    client.on(
      Events.MessageDelete,
      this.onMessageDelete,
    );

    client.on(
      Events.MessageUpdate,
      this.onMessageUpdate,
    );

    client.on(
      Events.VoiceStateUpdate,
      this.onVoiceStateUpdate,
    );

    client.on(
      Events.AutoModerationActionExecution,
      this.onAutoModerationAction,
    );
  }

  public stop(): void {
    const client =
      this.client;

    if (client) {
      client.off(
        Events.ClientReady,
        this.onReady,
      );

      client.off(
        Events.GuildMemberAdd,
        this.onGuildMemberAdd,
      );

      client.off(
        Events.GuildMemberRemove,
        this.onGuildMemberRemove,
      );

      client.off(
        Events.GuildMemberUpdate,
        this.onGuildMemberUpdate,
      );

      client.off(
        Events.GuildBanAdd,
        this.onGuildBanAdd,
      );

      client.off(
        Events.GuildBanRemove,
        this.onGuildBanRemove,
      );

      client.off(
        Events.MessageDelete,
        this.onMessageDelete,
      );

      client.off(
        Events.MessageUpdate,
        this.onMessageUpdate,
      );

      client.off(
        Events.VoiceStateUpdate,
        this.onVoiceStateUpdate,
      );

      client.off(
        Events.AutoModerationActionExecution,
        this.onAutoModerationAction,
      );
    }

    this.client =
      null;

    this.started =
      false;
  }
}

export const communityLoggingRuntime =
  new CommunityLoggingRuntime();
