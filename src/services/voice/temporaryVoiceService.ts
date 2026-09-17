import {
  ChannelType,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type VoiceChannel,
} from "discord.js";

import {
  TemporaryVoiceConfig,
} from "../../models/TemporaryVoiceConfig.js";

import {
  TemporaryVoiceRoom,
} from "../../models/TemporaryVoiceRoom.js";

const CATEGORY_NAME =
  "NEXORA TEMP VOICE";

const HUB_NAME =
  "➕・สร้างห้องส่วนตัว";

const ROOM_PREFIX =
  "🔊・";

const MAX_ACCESS_USERS =
  25;

const createCooldowns =
  new Map<
    string,
    number
  >();

function uniqueIds(
  values:
    unknown[],
): string[] {
  return [
    ...new Set(
      values
        .map(
          String,
        )
        .filter(
          Boolean,
        ),
    ),
  ].slice(
    0,
    MAX_ACCESS_USERS,
  );
}

function sanitizeRoomName(
  value:
    string,
): string {
  const clean =
    value
      .replace(
        /@everyone/gi,
        "everyone",
      )
      .replace(
        /@here/gi,
        "here",
      )
      .replace(
        /[\u0000-\u001f\u007f]/g,
        "",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim()
      .slice(
        0,
        36,
      );

  return (
    clean ||
    "Private Room"
  );
}

async function fetchCategory(
  guild:
    Guild,

  channelId:
    string |
    null |
    undefined,
): Promise<
  CategoryChannel |
  null
> {
  if (!channelId) {
    return null;
  }

  const channel =
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
    channel.type !==
      ChannelType
        .GuildCategory
  ) {
    return null;
  }

  return channel;
}

async function fetchVoiceChannel(
  guild:
    Guild,

  channelId:
    string |
    null |
    undefined,
): Promise<
  VoiceChannel |
  null
> {
  if (!channelId) {
    return null;
  }

  const channel =
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
    channel.type !==
      ChannelType
        .GuildVoice
  ) {
    return null;
  }

  return channel;
}

function requireBotPermissions(
  guild:
    Guild,
): void {
  const me =
    guild.members.me;

  if (!me) {
    throw new Error(
      "ไม่พบ NEXORA member ใน Server",
    );
  }

  if (
    !me.permissions.has(
      PermissionFlagsBits
        .ManageChannels,
    )
  ) {
    throw new Error(
      "NEXORA ต้องมีสิทธิ์ Manage Channels",
    );
  }

  if (
    !me.permissions.has(
      PermissionFlagsBits
        .MoveMembers,
    )
  ) {
    throw new Error(
      "NEXORA ต้องมีสิทธิ์ Move Members",
    );
  }
}

function guildMaximumBitrate(
  guild:
    Guild,
): number {
  const value =
    Number(
      (
        guild as any
      ).maximumBitrate ??
      96_000,
    );

  if (
    !Number.isFinite(
      value,
    ) ||
    value <
      8_000
  ) {
    return 96_000;
  }

  return value;
}

async function applyRoomPermissions(
  guild:
    Guild,

  channel:
    VoiceChannel,

  room:
    any,
): Promise<void> {
  await channel
    .permissionOverwrites
    .edit(
      guild.roles
        .everyone,
      {
        ViewChannel:
          room.hidden
            ? false
            : null,

        Connect:
          room.locked
            ? false
            : null,
      },
      {
        reason:
          "NEXORA Temporary Voice state sync",
      },
    );

  await channel
    .permissionOverwrites
    .edit(
      String(
        room.ownerId,
      ),
      {
        ViewChannel:
          true,

        Connect:
          true,

        Speak:
          true,
      },
      {
        reason:
          "NEXORA Temporary Voice owner",
      },
    );

  const allowed =
    uniqueIds(
      room
        .allowedUserIds ??
      [],
    );

  const banned =
    uniqueIds(
      room
        .bannedUserIds ??
      [],
    );

  for (
    const userId of
      allowed
  ) {
    if (
      userId ===
      String(
        room.ownerId,
      )
    ) {
      continue;
    }

    await channel
      .permissionOverwrites
      .edit(
        userId,
        {
          ViewChannel:
            true,

          Connect:
            true,
        },
        {
          reason:
            "NEXORA Temporary Voice access",
        },
      )
      .catch(
        () =>
          undefined,
      );
  }

  for (
    const userId of
      banned
  ) {
    if (
      userId ===
      String(
        room.ownerId,
      )
    ) {
      continue;
    }

    await channel
      .permissionOverwrites
      .edit(
        userId,
        {
          ViewChannel:
            false,

          Connect:
            false,
        },
        {
          reason:
            "NEXORA Temporary Voice ban",
        },
      )
      .catch(
        () =>
          undefined,
      );
  }
}

async function requireOwnedRoom(
  guild:
    Guild,

  actorId:
    string,

  channelId:
    string,
) {
  const room =
    await TemporaryVoiceRoom
      .findOne({
        guildId:
          guild.id,

        channelId,
      });

  if (!room) {
    throw new Error(
      "ไม่พบ Temporary Voice Room นี้",
    );
  }

  if (
    String(
      room.ownerId,
    ) !==
    actorId
  ) {
    throw new Error(
      "เฉพาะเจ้าของห้องเท่านั้นที่ใช้คำสั่งนี้ได้",
    );
  }

  const channel =
    await fetchVoiceChannel(
      guild,
      channelId,
    );

  if (!channel) {
    await TemporaryVoiceRoom
      .deleteOne({
        _id:
          room._id,
      });

    throw new Error(
      "ห้องนี้ถูกลบไปแล้ว",
    );
  }

  return {
    room,
    channel,
  };
}

async function transferInternal(
  guild:
    Guild,

  room:
    any,

  channel:
    VoiceChannel,

  newOwnerId:
    string,
): Promise<any> {
  if (
    String(
      room.ownerId,
    ) ===
    newOwnerId
  ) {
    return room;
  }

  const newOwner =
    channel.members.get(
      newOwnerId,
    );

  if (
    !newOwner ||
    newOwner.user.bot
  ) {
    throw new Error(
      "เจ้าของใหม่ต้องอยู่ในห้องนี้และต้องไม่ใช่ Bot",
    );
  }

  const existing =
    await TemporaryVoiceRoom
      .findOne({
        guildId:
          guild.id,

        ownerId:
          newOwnerId,

        channelId: {
          $ne:
            channel.id,
        },
      });

  if (existing) {
    throw new Error(
      "สมาชิกคนนี้มี Temporary Voice Room ของตัวเองอยู่แล้ว",
    );
  }

  const previousOwnerId =
    String(
      room.ownerId,
    );

  const allowed =
    new Set(
      uniqueIds(
        room
          .allowedUserIds ??
        [],
      ),
    );

  const banned =
    new Set(
      uniqueIds(
        room
          .bannedUserIds ??
        [],
      ),
    );

  allowed.add(
    previousOwnerId,
  );

  allowed.delete(
    newOwnerId,
  );

  banned.delete(
    newOwnerId,
  );

  room.ownerId =
    newOwnerId;

  room.allowedUserIds =
    [
      ...allowed,
    ].slice(
      0,
      MAX_ACCESS_USERS,
    );

  room.bannedUserIds =
    [
      ...banned,
    ].slice(
      0,
      MAX_ACCESS_USERS,
    );

  room.lastOwnerChangeAt =
    new Date();

  await room.save();

  await applyRoomPermissions(
    guild,
    channel,
    room,
  );

  return room;
}

export const temporaryVoiceService = {
  async getConfig(
    guildId:
      string,
  ) {
    return TemporaryVoiceConfig
      .findOne({
        guildId,
      });
  },

  async ensureSetup(
    guild:
      Guild,
  ) {
    requireBotPermissions(
      guild,
    );

    let config =
      await TemporaryVoiceConfig
        .findOne({
          guildId:
            guild.id,
        });

    if (!config) {
      config =
        await TemporaryVoiceConfig
          .create({
            guildId:
              guild.id,

            enabled:
              true,
          });
    }

    let category =
      await fetchCategory(
        guild,
        config.categoryId,
      );

    if (!category) {
      const existing =
        guild.channels
          .cache
          .find(
            (
              channel,
            ) =>
              channel.type ===
                ChannelType
                  .GuildCategory &&
              channel.name ===
                CATEGORY_NAME,
          );

      if (
        existing &&
        existing.type ===
          ChannelType
            .GuildCategory
      ) {
        category =
          existing;
      } else {
        category =
          await guild.channels
            .create({
              name:
                CATEGORY_NAME,

              type:
                ChannelType
                  .GuildCategory,

              reason:
                "NEXORA Temporary Voice setup",
            });
      }

      config.categoryId =
        category.id;
    }

    let hub =
      await fetchVoiceChannel(
        guild,
        config.hubChannelId,
      );

    if (!hub) {
      const existing =
        guild.channels
          .cache
          .find(
            (
              channel,
            ) =>
              channel.type ===
                ChannelType
                  .GuildVoice &&
              channel.name ===
                HUB_NAME,
          );

      if (
        existing &&
        existing.type ===
          ChannelType
            .GuildVoice
      ) {
        hub =
          existing;
      } else {
        hub =
          await guild.channels
            .create({
              name:
                HUB_NAME,

              type:
                ChannelType
                  .GuildVoice,

              parent:
                category.id,

              reason:
                "NEXORA Join-to-Create hub",
            });
      }

      config.hubChannelId =
        hub.id;
    }

    if (
      hub.parentId !==
      category.id
    ) {
      await hub.setParent(
        category.id,
        {
          lockPermissions:
            false,
        },
      );
    }

    config.enabled =
      true;

    await config.save();

    return {
      config,
      category,
      hub,
    };
  },

  async createOrMoveRoom(
    member:
      GuildMember,
  ) {
    if (
      member.user.bot
    ) {
      return null;
    }

    const guild =
      member.guild;

    const {
      config,
      category,
    } =
      await this.ensureSetup(
        guild,
      );

    const existing =
      await TemporaryVoiceRoom
        .findOne({
          guildId:
            guild.id,

          ownerId:
            member.id,
        });

    if (existing) {
      const existingChannel =
        await fetchVoiceChannel(
          guild,
          existing.channelId,
        );

      if (existingChannel) {
        await member.voice
          .setChannel(
            existingChannel,
            "NEXORA: move owner to existing Temporary Voice Room",
          );

        return {
          room:
            existing,

          channel:
            existingChannel,

          existing:
            true,
        };
      }

      await TemporaryVoiceRoom
        .deleteOne({
          _id:
            existing._id,
        });
    }

    const cooldownKey =
      `${guild.id}:${member.id}`;

    const previous =
      createCooldowns.get(
        cooldownKey,
      ) ??
      0;

    if (
      Date.now() -
        previous <
      3_000
    ) {
      return null;
    }

    createCooldowns.set(
      cooldownKey,
      Date.now(),
    );

    const channel =
      await guild.channels
        .create({
          name:
            `${ROOM_PREFIX}${sanitizeRoomName(member.displayName)}`,

          type:
            ChannelType
              .GuildVoice,

          parent:
            category.id,

          userLimit:
            config.defaultUserLimit,

          permissionOverwrites: [
            {
              id:
                member.id,

              allow: [
                PermissionFlagsBits
                  .ViewChannel,

                PermissionFlagsBits
                  .Connect,

                PermissionFlagsBits
                  .Speak,
              ],
            },
          ],

          reason:
            `NEXORA Temporary Voice for ${member.user.tag}`,
        });

    try {
      const room =
        await TemporaryVoiceRoom
          .create({
            guildId:
              guild.id,

            channelId:
              channel.id,

            ownerId:
              member.id,

            locked:
              false,

            hidden:
              false,

            userLimit:
              config.defaultUserLimit,

            bitrate:
              channel.bitrate,

            allowedUserIds:
              [],

            bannedUserIds:
              [],
          });

      await member.voice
        .setChannel(
          channel,
          "NEXORA Join-to-Create",
        );

      void member.send(
        [
          "🔊 **NEXORA Temporary Voice**",
          "",
          `สร้างห้อง **${channel.name}** ให้แล้ว`,
          "ใช้ `/voice panel` เพื่อเปิด Control Panel",
          "",
          "ห้องจะถูกลบทันทีเมื่อไม่มีสมาชิกอยู่ในห้อง",
        ].join(
          "\n",
        ),
      )
        .catch(
          () =>
            undefined,
        );

      return {
        room,
        channel,
        existing:
          false,
      };
    } catch (
      error
    ) {
      await channel.delete(
        "NEXORA Temporary Voice rollback",
      )
        .catch(
          () =>
            undefined,
        );

      throw error;
    }
  },

  async getOwnedRoomState(
    guild:
      Guild,

    ownerId:
      string,
  ) {
    const room =
      await TemporaryVoiceRoom
        .findOne({
          guildId:
            guild.id,

          ownerId,
        });

    if (!room) {
      return null;
    }

    const channel =
      await fetchVoiceChannel(
        guild,
        room.channelId,
      );

    if (!channel) {
      await TemporaryVoiceRoom
        .deleteOne({
          _id:
            room._id,
        });

      return null;
    }

    return {
      room,
      channel,
    };
  },

  async findRoomByChannel(
    guildId:
      string,

    channelId:
      string,
  ) {
    return TemporaryVoiceRoom
      .findOne({
        guildId,
        channelId,
      });
  },

  async listRooms(
    guildId:
      string,
  ) {
    return TemporaryVoiceRoom
      .find({
        guildId,
      });
  },

  async rename(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,

    name:
      string,
  ) {
    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    const clean =
      sanitizeRoomName(
        name,
      );

    if (
      clean.length <
      2
    ) {
      throw new Error(
        "ชื่อห้องต้องมีอย่างน้อย 2 ตัวอักษร",
      );
    }

    await channel.setName(
      `${ROOM_PREFIX}${clean}`,
      "NEXORA Temporary Voice rename",
    );

    return {
      room,
      channel,
    };
  },

  async setUserLimit(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,

    value:
      number,
  ) {
    if (
      !Number.isInteger(
        value,
      ) ||
      value <
        0 ||
      value >
        99
    ) {
      throw new Error(
        "User Limit ต้องอยู่ระหว่าง 0–99 (0 = ไม่จำกัด)",
      );
    }

    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    await channel.setUserLimit(
      value,
      "NEXORA Temporary Voice user limit",
    );

    room.userLimit =
      value;

    await room.save();

    return {
      room,
      channel,
    };
  },

  async setBitrate(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,

    kbps:
      number,
  ) {
    if (
      !Number.isFinite(
        kbps,
      )
    ) {
      throw new Error(
        "Bitrate ไม่ถูกต้อง",
      );
    }

    const bitrate =
      Math.round(
        kbps *
        1_000,
      );

    const maximum =
      guildMaximumBitrate(
        guild,
      );

    if (
      bitrate <
      8_000 ||
      bitrate >
      maximum
    ) {
      throw new Error(
        `Bitrate ต้องอยู่ระหว่าง 8–${Math.floor(maximum / 1000)} kbps`,
      );
    }

    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    await channel.setBitrate(
      bitrate,
      "NEXORA Temporary Voice bitrate",
    );

    room.bitrate =
      bitrate;

    await room.save();

    return {
      room,
      channel,
    };
  },

  async toggleLock(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,
  ) {
    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    room.locked =
      !room.locked;

    await room.save();

    await applyRoomPermissions(
      guild,
      channel,
      room,
    );

    return {
      room,
      channel,
    };
  },

  async toggleHide(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,
  ) {
    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    room.hidden =
      !room.hidden;

    await room.save();

    await applyRoomPermissions(
      guild,
      channel,
      room,
    );

    return {
      room,
      channel,
    };
  },

  async allowUser(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,

    userId:
      string,
  ) {
    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    if (
      userId ===
      actorId
    ) {
      throw new Error(
        "เจ้าของห้องมีสิทธิ์อยู่แล้ว",
      );
    }

    const allowed =
      new Set(
        uniqueIds(
          room
            .allowedUserIds ??
          [],
        ),
      );

    const banned =
      new Set(
        uniqueIds(
          room
            .bannedUserIds ??
          [],
        ),
      );

    allowed.add(
      userId,
    );

    banned.delete(
      userId,
    );

    room.allowedUserIds =
      [
        ...allowed,
      ].slice(
        0,
        MAX_ACCESS_USERS,
      );

    room.bannedUserIds =
      [
        ...banned,
      ];

    await room.save();

    await channel
      .permissionOverwrites
      .edit(
        userId,
        {
          ViewChannel:
            true,

          Connect:
            true,
        },
        {
          reason:
            "NEXORA Temporary Voice allow",
        },
      );

    return {
      room,
      channel,
    };
  },

  async removeAccess(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,

    userId:
      string,
  ) {
    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    if (
      userId ===
      actorId
    ) {
      throw new Error(
        "ไม่สามารถลบสิทธิ์เจ้าของห้องได้",
      );
    }

    room.allowedUserIds =
      uniqueIds(
        room
          .allowedUserIds ??
        [],
      ).filter(
        (
          id,
        ) =>
          id !==
          userId,
      );

    await room.save();

    const isBanned =
      uniqueIds(
        room
          .bannedUserIds ??
        [],
      ).includes(
        userId,
      );

    if (!isBanned) {
      await channel
        .permissionOverwrites
        .delete(
          userId,
          "NEXORA Temporary Voice remove explicit access",
        )
        .catch(
          () =>
            undefined,
        );
    }

    if (
      (
        room.locked ||
        room.hidden
      ) &&
      channel.members.has(
        userId,
      )
    ) {
      const member =
        channel.members.get(
          userId,
        );

      await member?.voice
        .setChannel(
          null,
          "NEXORA Temporary Voice access removed",
        )
        .catch(
          () =>
            undefined,
        );
    }

    return {
      room,
      channel,
    };
  },

  async banUser(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,

    userId:
      string,
  ) {
    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    if (
      userId ===
      actorId
    ) {
      throw new Error(
        "ไม่สามารถ Ban เจ้าของห้องได้",
      );
    }

    const banned =
      new Set(
        uniqueIds(
          room
            .bannedUserIds ??
          [],
        ),
      );

    banned.add(
      userId,
    );

    room.bannedUserIds =
      [
        ...banned,
      ].slice(
        0,
        MAX_ACCESS_USERS,
      );

    room.allowedUserIds =
      uniqueIds(
        room
          .allowedUserIds ??
        [],
      ).filter(
        (
          id,
        ) =>
          id !==
          userId,
      );

    await room.save();

    await channel
      .permissionOverwrites
      .edit(
        userId,
        {
          ViewChannel:
            false,

          Connect:
            false,
        },
        {
          reason:
            "NEXORA Temporary Voice ban",
        },
      );

    const member =
      channel.members.get(
        userId,
      );

    if (member) {
      await member.voice
        .setChannel(
          null,
          "NEXORA Temporary Voice ban",
        )
        .catch(
          () =>
            undefined,
        );
    }

    return {
      room,
      channel,
    };
  },

  async transferOwnership(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,

    newOwnerId:
      string,
  ) {
    const {
      room,
      channel,
    } =
      await requireOwnedRoom(
        guild,
        actorId,
        channelId,
      );

    await transferInternal(
      guild,
      room,
      channel,
      newOwnerId,
    );

    return {
      room,
      channel,
    };
  },

  async transferOwnershipSystem(
    guild:
      Guild,

    channelId:
      string,

    newOwnerId:
      string,
  ) {
    const room =
      await TemporaryVoiceRoom
        .findOne({
          guildId:
            guild.id,

          channelId,
        });

    if (!room) {
      return null;
    }

    const channel =
      await fetchVoiceChannel(
        guild,
        channelId,
      );

    if (!channel) {
      await TemporaryVoiceRoom
        .deleteOne({
          _id:
            room._id,
        });

      return null;
    }

    await transferInternal(
      guild,
      room,
      channel,
      newOwnerId,
    );

    return {
      room,
      channel,
    };
  },

  async deleteOwnedRoom(
    guild:
      Guild,

    actorId:
      string,

    channelId:
      string,
  ) {
    await requireOwnedRoom(
      guild,
      actorId,
      channelId,
    );

    return this.deleteRoomByChannel(
      guild,
      channelId,
      "NEXORA Temporary Voice owner delete",
    );
  },

  async deleteRoomByChannel(
    guild:
      Guild,

    channelId:
      string,

    reason =
      "NEXORA Temporary Voice cleanup",
  ) {
    const room =
      await TemporaryVoiceRoom
        .findOne({
          guildId:
            guild.id,

          channelId,
        });

    const channel =
      await fetchVoiceChannel(
        guild,
        channelId,
      );

    if (channel) {
      await channel.delete(
        reason,
      )
        .catch(
          () =>
            undefined,
        );
    }

    await TemporaryVoiceRoom
      .deleteOne({
        guildId:
          guild.id,

        channelId,
      });

    return room;
  },

  async reconcileGuild(
    guild:
      Guild,
  ) {
    const {
      category,
    } =
      await this.ensureSetup(
        guild,
      );

    const rooms =
      await TemporaryVoiceRoom
        .find({
          guildId:
            guild.id,
        });

    let deleted =
      0;

    let synced =
      0;

    for (
      const room of
        rooms
    ) {
      const channel =
        await fetchVoiceChannel(
          guild,
          room.channelId,
        );

      if (!channel) {
        await TemporaryVoiceRoom
          .deleteOne({
            _id:
              room._id,
          });

        deleted +=
          1;

        continue;
      }

      if (
        channel.members.size ===
        0
      ) {
        await this
          .deleteRoomByChannel(
            guild,
            channel.id,
            "NEXORA Temporary Voice startup empty cleanup",
          );

        deleted +=
          1;

        continue;
      }

      if (
        channel.parentId !==
        category.id
      ) {
        await channel
          .setParent(
            category.id,
            {
              lockPermissions:
                false,
            },
          )
          .catch(
            () =>
              undefined,
          );
      }

      room.userLimit =
        channel.userLimit;

      room.bitrate =
        channel.bitrate;

      await room.save();

      await applyRoomPermissions(
        guild,
        channel,
        room,
      );

      synced +=
        1;
    }

    return {
      scanned:
        rooms.length,

      synced,

      deleted,
    };
  },

  async clearDeletedInfrastructure(
    guild:
      Guild,

    channelId:
      string,
  ) {
    const config =
      await TemporaryVoiceConfig
        .findOne({
          guildId:
            guild.id,
        });

    if (!config) {
      return false;
    }

    let changed =
      false;

    if (
      config.hubChannelId ===
      channelId
    ) {
      config.hubChannelId =
        null;

      changed =
        true;
    }

    if (
      config.categoryId ===
      channelId
    ) {
      config.categoryId =
        null;

      changed =
        true;
    }

    if (changed) {
      await config.save();
    }

    return changed;
  },

  async isBanned(
    guildId:
      string,

    channelId:
      string,

    userId:
      string,
  ): Promise<boolean> {
    const room =
      await TemporaryVoiceRoom
        .findOne({
          guildId,
          channelId,
        });

    if (!room) {
      return false;
    }

    return uniqueIds(
      room
        .bannedUserIds ??
      [],
    ).includes(
      userId,
    );
  },
};
