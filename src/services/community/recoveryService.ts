import crypto from "node:crypto";

import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  OverwriteType,
  PermissionFlagsBits,
  type Client,
  type Guild,
} from "discord.js";

import {
  GuildRecoveryConfig,
} from "../../models/GuildRecoveryConfig.js";

import {
  GuildSnapshot,
} from "../../models/GuildSnapshot.js";

import {
  NEXORA_RECOVERY_POLICY_VERSION,
  NEXORA_RECOVERY_SCHEMA_VERSION,
  RECOVERY_DEFAULTS,
  type RecoveryMode,
} from "../../community/recovery/recoveryPolicy.js";

type SnapshotRole = {
  id:
    string;

  name:
    string;

  color:
    number;

  hoist:
    boolean;

  position:
    number;

  permissions:
    string;

  mentionable:
    boolean;
};

type SnapshotOverwrite = {
  id:
    string;

  type:
    number;

  allow:
    string;

  deny:
    string;
};

type SnapshotChannel = {
  id:
    string;

  type:
    number;

  name:
    string;

  parentId:
    string |
    null;

  position:
    number;

  permissionOverwrites:
    SnapshotOverwrite[];

  topic?:
    string |
    null;

  nsfw?:
    boolean;

  rateLimitPerUser?:
    number;

  bitrate?:
    number;

  userLimit?:
    number;

  rtcRegion?:
    string |
    null;

  defaultAutoArchiveDuration?:
    number |
    null;
};

type SnapshotPayload = {
  guild: {
    id:
      string;

    name:
      string;

    everyonePermissions:
      string;

    verificationLevel:
      number;

    explicitContentFilter:
      number;

    defaultMessageNotifications:
      number;

    preferredLocale:
      string;

    afkTimeout:
      number;
  };

  roles:
    SnapshotRole[];

  channels:
    SnapshotChannel[];
};

type RestoreReport = {
  mode:
    RecoveryMode;

  snapshotId:
    string;

  preRestoreSnapshotId:
    string;

  createdRoles:
    string[];

  createdChannels:
    string[];

  updatedRoles:
    string[];

  updatedChannels:
    string[];

  warnings:
    string[];
};

let autoSnapshotTimer:
  NodeJS.Timeout |
  null =
    null;

function snapshotId() {
  return (
    "BKP-" +
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase()
  );
}

function stableHash(
  payload:
    SnapshotPayload,
) {
  return crypto
    .createHash(
      "sha256",
    )
    .update(
      JSON.stringify(
        payload,
      ),
      "utf8",
    )
    .digest(
      "hex",
    );
}

function roleSnapshot(
  role:
    any,
): SnapshotRole {
  return {
    id:
      role.id,

    name:
      role.name,

    color:
      Number(
        role.color ??
        0,
      ),

    hoist:
      Boolean(
        role.hoist,
      ),

    position:
      Number(
        role.position ??
        0,
      ),

    permissions:
      role.permissions
        .bitfield
        .toString(),

    mentionable:
      Boolean(
        role.mentionable,
      ),
  };
}

function overwriteSnapshot(
  overwrite:
    any,
): SnapshotOverwrite {
  return {
    id:
      overwrite.id,

    type:
      Number(
        overwrite.type,
      ),

    allow:
      overwrite.allow
        .bitfield
        .toString(),

    deny:
      overwrite.deny
        .bitfield
        .toString(),
  };
}

function channelSnapshot(
  channel:
    any,
): SnapshotChannel {
  const data:
    SnapshotChannel = {
    id:
      channel.id,

    type:
      Number(
        channel.type,
      ),

    name:
      channel.name,

    parentId:
      channel.parentId ??
      null,

    position:
      Number(
        channel.rawPosition ??
        channel.position ??
        0,
      ),

    permissionOverwrites:
      "permissionOverwrites" in
        channel
        ? [
            ...channel
              .permissionOverwrites
              .cache
              .values(),
          ]
            .map(
              overwriteSnapshot,
            )
        : [],
  };

  if (
    "topic" in
    channel
  ) {
    data.topic =
      channel.topic ??
      null;
  }

  if (
    "nsfw" in
    channel
  ) {
    data.nsfw =
      Boolean(
        channel.nsfw,
      );
  }

  if (
    "rateLimitPerUser" in
    channel
  ) {
    data.rateLimitPerUser =
      Number(
        channel.rateLimitPerUser ??
        0,
      );
  }

  if (
    "bitrate" in
    channel
  ) {
    data.bitrate =
      Number(
        channel.bitrate ??
        64000,
      );
  }

  if (
    "userLimit" in
    channel
  ) {
    data.userLimit =
      Number(
        channel.userLimit ??
        0,
      );
  }

  if (
    "rtcRegion" in
    channel
  ) {
    data.rtcRegion =
      channel.rtcRegion ??
      null;
  }

  if (
    "defaultAutoArchiveDuration" in
    channel
  ) {
    data.defaultAutoArchiveDuration =
      channel.defaultAutoArchiveDuration ??
      null;
  }

  return data;
}

function snapshotJson(
  snapshot:
    any,
) {
  return JSON.stringify(
    {
      format:
        "NEXORA_GUILD_RECOVERY_BACKUP",

      schemaVersion:
        snapshot.schemaVersion,

      policyVersion:
        snapshot.policyVersion,

      snapshotId:
        snapshot.snapshotId,

      guildId:
        snapshot.guildId,

      type:
        snapshot.type,

      label:
        snapshot.label,

      protected:
        snapshot.protected,

      hash:
        snapshot.hash,

      createdBy:
        snapshot.createdBy,

      createdAt:
        snapshot.createdAt,

      stats:
        snapshot.stats,

      payload:
        snapshot.payload,
    },
    null,
    2,
  );
}

function attachmentFor(
  snapshot:
    any,
) {
  return new AttachmentBuilder(
    Buffer.from(
      snapshotJson(
        snapshot,
      ),
      "utf8",
    ),
    {
      name:
        `nexora-${snapshot.snapshotId}.json`,
    },
  );
}

async function logChannel(
  guild:
    Guild,

  channelId:
    string,
) {
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
      ChannelType.GuildText
  ) {
    return null;
  }

  return channel;
}

function isRestorableChannelType(
  type:
    number,
) {
  return [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildCategory,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
  ].includes(
    type as
      ChannelType,
  );
}

function normalizeChannelName(
  value:
    string,
) {
  return value
    .trim()
    .toLowerCase();
}

function overwritePayload(
  snapshot:
    SnapshotOverwrite[],

  guild:
    Guild,

  roleMap:
    Map<
      string,
      string
    >,
) {
  const result:
    any[] =
      [];

  for (
    const overwrite
    of snapshot
  ) {
    let id =
      overwrite.id;

    if (
      overwrite.type ===
      OverwriteType.Role
    ) {
      if (
        overwrite.id ===
        guild.id
      ) {
        id =
          guild.id;
      } else {
        const mapped =
          roleMap.get(
            overwrite.id,
          );

        if (!mapped) {
          continue;
        }

        id =
          mapped;
      }
    }

    result.push({
      id,

      type:
        overwrite.type,

      allow:
        BigInt(
          overwrite.allow,
        ),

      deny:
        BigInt(
          overwrite.deny,
        ),
    });
  }

  return result;
}

async function buildRoleMap(
  guild:
    Guild,

  roles:
    SnapshotRole[],

  createMissing:
    boolean,

  report:
    RestoreReport,
) {
  await guild.roles
    .fetch();

  const map =
    new Map<
      string,
      string
    >();

  map.set(
    guild.id,
    guild.id,
  );

  const current =
    [
      ...guild.roles.cache
        .values(),
    ];

  for (
    const snapshot
    of roles
  ) {
    const direct =
      guild.roles.cache
        .get(
          snapshot.id,
        );

    if (
      direct &&
      !direct.managed
    ) {
      map.set(
        snapshot.id,
        direct.id,
      );

      continue;
    }

    const sameName =
      current.filter(
        (
          role,
        ) =>
          !role.managed &&
          role.id !==
            guild.id &&
          role.name ===
            snapshot.name,
      );

    if (
      sameName.length ===
      1
    ) {
      map.set(
        snapshot.id,
        sameName[0]!
          .id,
      );

      continue;
    }

    if (!createMissing) {
      report.warnings.push(
        `Missing role: ${snapshot.name} (${snapshot.id})`,
      );

      continue;
    }

    try {
      const created =
        await guild.roles
          .create({
            name:
              snapshot.name,

            color:
              snapshot.color as
                any,

            hoist:
              snapshot.hoist,

            permissions:
              BigInt(
                snapshot.permissions,
              ),

            mentionable:
              snapshot.mentionable,

            reason:
              `NEXORA Disaster Recovery • ${report.snapshotId}`,
          });

      map.set(
        snapshot.id,
        created.id,
      );

      report.createdRoles
        .push(
          `${snapshot.name} (${created.id})`,
        );
    } catch (error) {
      report.warnings.push(
        `Failed role create: ${snapshot.name} • ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return map;
}

async function buildChannelMap(
  guild:
    Guild,

  channels:
    SnapshotChannel[],

  roleMap:
    Map<
      string,
      string
    >,

  createMissing:
    boolean,

  report:
    RestoreReport,
) {
  await guild.channels
    .fetch();

  const map =
    new Map<
      string,
      string
    >();

  const current =
    [
      ...guild.channels.cache
        .values(),
    ];

  const createOne =
    async (
      snapshot:
        SnapshotChannel,
    ) => {
      const direct =
        guild.channels.cache
          .get(
            snapshot.id,
          );

      if (direct) {
        map.set(
          snapshot.id,
          direct.id,
        );

        return;
      }

      const sameName =
        current.filter(
          (
            channel:
              any,
          ) =>
            Number(
              channel.type,
            ) ===
              snapshot.type &&
            normalizeChannelName(
              channel.name,
            ) ===
              normalizeChannelName(
                snapshot.name,
              ),
        );

      if (
        sameName.length ===
        1
      ) {
        map.set(
          snapshot.id,
          sameName[0]!
            .id,
        );

        return;
      }

      if (
        !createMissing
      ) {
        report.warnings.push(
          `Missing channel: ${snapshot.name} (${snapshot.id})`,
        );

        return;
      }

      if (
        !isRestorableChannelType(
          snapshot.type,
        )
      ) {
        report.warnings.push(
          `Unsupported channel type ${snapshot.type}: ${snapshot.name}`,
        );

        return;
      }

      const parent =
        snapshot.parentId
          ? map.get(
              snapshot.parentId,
            ) ??
            null
          : null;

      const data:
        any = {
        name:
          snapshot.name,

        type:
          snapshot.type,

        parent,

        position:
          snapshot.position,

        permissionOverwrites:
          overwritePayload(
            snapshot.permissionOverwrites,
            guild,
            roleMap,
          ),

        reason:
          `NEXORA Disaster Recovery • ${report.snapshotId}`,
      };

      if (
        snapshot.topic !==
        undefined &&
        snapshot.type !==
          ChannelType.GuildCategory
      ) {
        data.topic =
          snapshot.topic;
      }

      if (
        snapshot.nsfw !==
        undefined
      ) {
        data.nsfw =
          snapshot.nsfw;
      }

      if (
        snapshot.rateLimitPerUser !==
        undefined
      ) {
        data.rateLimitPerUser =
          snapshot.rateLimitPerUser;
      }

      if (
        snapshot.bitrate !==
        undefined
      ) {
        data.bitrate =
          snapshot.bitrate;
      }

      if (
        snapshot.userLimit !==
        undefined
      ) {
        data.userLimit =
          snapshot.userLimit;
      }

      if (
        snapshot.rtcRegion !==
        undefined
      ) {
        data.rtcRegion =
          snapshot.rtcRegion;
      }

      if (
        snapshot.defaultAutoArchiveDuration !==
        undefined &&
        snapshot.defaultAutoArchiveDuration !==
          null
      ) {
        data.defaultAutoArchiveDuration =
          snapshot.defaultAutoArchiveDuration;
      }

      try {
        const created =
          await guild.channels
            .create(
              data,
            );

        map.set(
          snapshot.id,
          created.id,
        );

        report.createdChannels
          .push(
            `${snapshot.name} (${created.id})`,
          );
      } catch (error) {
        report.warnings.push(
          `Failed channel create: ${snapshot.name} • ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    };

  const categories =
    channels
      .filter(
        (
          channel,
        ) =>
          channel.type ===
          ChannelType
            .GuildCategory,
      )
      .sort(
        (
          a,
          b,
        ) =>
          a.position -
          b.position,
      );

  const rest =
    channels
      .filter(
        (
          channel,
        ) =>
          channel.type !==
          ChannelType
            .GuildCategory,
      )
      .sort(
        (
          a,
          b,
        ) =>
          a.position -
          b.position,
      );

  for (
    const channel
    of categories
  ) {
    await createOne(
      channel,
    );
  }

  for (
    const channel
    of rest
  ) {
    await createOne(
      channel,
    );
  }

  return map;
}

async function repairRoles(
  guild:
    Guild,

  roles:
    SnapshotRole[],

  roleMap:
    Map<
      string,
      string
    >,

  report:
    RestoreReport,

  fullRepair:
    boolean,
) {
  try {
    await guild.roles
      .everyone
      .setPermissions(
        BigInt(
          (
            report as
              any
          ).everyonePermissions,
        ),
        `NEXORA Disaster Recovery • ${report.snapshotId}`,
      );
  } catch (error) {
    report.warnings.push(
      `Failed @everyone permissions: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  for (
    const snapshot
    of roles
  ) {
    const id =
      roleMap.get(
        snapshot.id,
      );

    if (!id) {
      continue;
    }

    const role =
      guild.roles.cache
        .get(
          id,
        );

    if (
      !role ||
      role.managed ||
      !role.editable
    ) {
      continue;
    }

    try {
      const edit:
        any = {
        permissions:
          BigInt(
            snapshot.permissions,
          ),

        reason:
          `NEXORA Disaster Recovery • ${report.snapshotId}`,
      };

      if (fullRepair) {
        edit.name =
          snapshot.name;

        edit.color =
          snapshot.color;

        edit.hoist =
          snapshot.hoist;

        edit.mentionable =
          snapshot.mentionable;
      }

      await role.edit(
        edit,
      );

      if (
        fullRepair
      ) {
        await role.setPosition(
          snapshot.position,
          {
            reason:
              `NEXORA Disaster Recovery • ${report.snapshotId}`,
          },
        );
      }

      report.updatedRoles
        .push(
          role.id,
        );
    } catch (error) {
      report.warnings.push(
        `Failed role repair: ${snapshot.name} • ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

async function repairChannels(
  guild:
    Guild,

  channels:
    SnapshotChannel[],

  channelMap:
    Map<
      string,
      string
    >,

  roleMap:
    Map<
      string,
      string
    >,

  report:
    RestoreReport,

  fullRepair:
    boolean,
) {
  for (
    const snapshot
    of channels
  ) {
    const id =
      channelMap.get(
        snapshot.id,
      );

    if (!id) {
      continue;
    }

    const channel =
      guild.channels.cache
        .get(
          id,
        ) as
          any;

    if (
      !channel ||
      !(
        "permissionOverwrites" in
        channel
      )
    ) {
      continue;
    }

    try {
      await channel
        .permissionOverwrites
        .set(
          overwritePayload(
            snapshot.permissionOverwrites,
            guild,
            roleMap,
          ),
          `NEXORA Disaster Recovery • ${report.snapshotId}`,
        );

      if (fullRepair) {
        const edit:
          any = {
          name:
            snapshot.name,

          position:
            snapshot.position,

          reason:
            `NEXORA Disaster Recovery • ${report.snapshotId}`,
        };

        if (
          snapshot.parentId
        ) {
          edit.parent =
            channelMap.get(
              snapshot.parentId,
            ) ??
            null;
        } else {
          edit.parent =
            null;
        }

        if (
          snapshot.topic !==
          undefined &&
          "topic" in
            channel
        ) {
          edit.topic =
            snapshot.topic;
        }

        if (
          snapshot.nsfw !==
          undefined &&
          "nsfw" in
            channel
        ) {
          edit.nsfw =
            snapshot.nsfw;
        }

        if (
          snapshot.rateLimitPerUser !==
          undefined &&
          "rateLimitPerUser" in
            channel
        ) {
          edit.rateLimitPerUser =
            snapshot.rateLimitPerUser;
        }

        if (
          snapshot.bitrate !==
          undefined &&
          "bitrate" in
            channel
        ) {
          edit.bitrate =
            snapshot.bitrate;
        }

        if (
          snapshot.userLimit !==
          undefined &&
          "userLimit" in
            channel
        ) {
          edit.userLimit =
            snapshot.userLimit;
        }

        await channel.edit(
          edit,
        );
      }

      report.updatedChannels
        .push(
          channel.id,
        );
    } catch (error) {
      report.warnings.push(
        `Failed channel repair: ${snapshot.name} • ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}

export const recoveryService = {
  async getConfig(
    guildId:
      string,
  ) {
    return GuildRecoveryConfig
      .findOne({
        guildId,
      });
  },

  async requireConfig(
    guildId:
      string,
  ) {
    const config =
      await this.getConfig(
        guildId,
      );

    if (!config) {
      throw new Error(
        "Disaster Recovery ยังไม่ได้ Setup — ใช้ `/recovery setup` ก่อน",
      );
    }

    return config;
  },

  async setup(
    guild:
      Guild,

    data: {
      logChannelId:
        string;

      autoSnapshotHours?:
        number;

      retentionCount?:
        number;

      externalCopies?:
        boolean;

      actorId:
        string;
    },
  ) {
    const channel =
      await logChannel(
        guild,
        data.logChannelId,
      );

    if (!channel) {
      throw new Error(
        "Recovery Log ต้องเป็น Text Channel",
      );
    }

    const me =
      guild.members.me;

    if (
      !me?.permissions.has(
        PermissionFlagsBits
          .ManageGuild,
      ) ||
      !me.permissions.has(
        PermissionFlagsBits
          .ManageRoles,
      ) ||
      !me.permissions.has(
        PermissionFlagsBits
          .ManageChannels,
      )
    ) {
      throw new Error(
        "NEXORA ต้องมี Manage Server, Manage Roles และ Manage Channels",
      );
    }

    const config =
      await GuildRecoveryConfig
        .findOneAndUpdate(
          {
            guildId:
              guild.id,
          },
          {
            $set: {
              enabled:
                true,

              logChannelId:
                data.logChannelId,

              autoSnapshotHours:
                data.autoSnapshotHours ??
                RECOVERY_DEFAULTS
                  .autoSnapshotHours,

              retentionCount:
                data.retentionCount ??
                RECOVERY_DEFAULTS
                  .retentionCount,

              externalCopies:
                data.externalCopies ??
                RECOVERY_DEFAULTS
                  .externalCopies,

              policyVersion:
                NEXORA_RECOVERY_POLICY_VERSION,
            },
          },
          {
            new:
              true,

            upsert:
              true,
          },
        );

    if (!config) {
      throw new Error(
        "ไม่สามารถสร้าง Recovery Config ได้",
      );
    }

    const initial =
      await this.capture(
        guild,
        {
          type:
            "manual",

          label:
            "Initial protected recovery baseline",

          protected:
            true,

          actorId:
            data.actorId,

          sendCopy:
            true,
        },
      );

    return {
      config,
      initial,
    };
  },

  async capturePayload(
    guild:
      Guild,
  ): Promise<
    SnapshotPayload
  > {
    await Promise.all([
      guild.roles
        .fetch(),

      guild.channels
        .fetch(),
    ]);

    const roles =
      [
        ...guild.roles.cache
          .values(),
      ]
        .filter(
          (
            role,
          ) =>
            role.id !==
              guild.id &&
            !role.managed,
        )
        .sort(
          (
            a,
            b,
          ) =>
            a.position -
            b.position,
        )
        .map(
          roleSnapshot,
        );

    const channels =
      [
        ...guild.channels.cache
          .values(),
      ]
        .filter(
          (
            channel:
              any,
          ) =>
            !(
              typeof channel
                .isThread ===
                "function" &&
              channel.isThread()
            ),
        )
        .map(
          channelSnapshot,
        )
        .sort(
          (
            a,
            b,
          ) =>
            a.position -
            b.position,
        );

    return {
      guild: {
        id:
          guild.id,

        name:
          guild.name,

        everyonePermissions:
          guild.roles
            .everyone
            .permissions
            .bitfield
            .toString(),

        verificationLevel:
          Number(
            guild.verificationLevel,
          ),

        explicitContentFilter:
          Number(
            guild.explicitContentFilter,
          ),

        defaultMessageNotifications:
          Number(
            guild.defaultMessageNotifications,
          ),

        preferredLocale:
          guild.preferredLocale,

        afkTimeout:
          guild.afkTimeout,
      },

      roles,

      channels,
    };
  },

  async capture(
    guild:
      Guild,

    options: {
      type:
        "manual" |
        "auto" |
        "pre_restore";

      label?:
        string |
        null;

      protected?:
        boolean;

      actorId:
        string;

      sendCopy?:
        boolean;
    },
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const payload =
      await this.capturePayload(
        guild,
      );

    const hash =
      stableHash(
        payload,
      );

    const snapshot =
      await GuildSnapshot
        .create({
          snapshotId:
            snapshotId(),

          guildId:
            guild.id,

          type:
            options.type,

          label:
            options.label ??
            null,

          protected:
            options.protected ??
            false,

          schemaVersion:
            NEXORA_RECOVERY_SCHEMA_VERSION,

          policyVersion:
            NEXORA_RECOVERY_POLICY_VERSION,

          hash,

          createdBy:
            options.actorId,

          stats: {
            roles:
              payload.roles
                .length,

            channels:
              payload.channels
                .length,

            overwrites:
              payload.channels
                .reduce(
                  (
                    sum,
                    channel,
                  ) =>
                    sum +
                    channel
                      .permissionOverwrites
                      .length,
                  0,
                ),
          },

          payload,
        });

    config.lastSnapshotId =
      snapshot.snapshotId;

    if (
      options.type ===
      "auto"
    ) {
      config.lastAutoSnapshotAt =
        new Date();
    }

    await config.save();

    await this.prune(
      guild.id,
      config.retentionCount,
    );

    if (
      options.sendCopy ??
      config.externalCopies
    ) {
      await this.sendSnapshotCopy(
        guild,
        snapshot,
      );
    }

    return snapshot;
  },

  async sendSnapshotCopy(
    guild:
      Guild,

    snapshot:
      any,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const channel =
      await logChannel(
        guild,
        config.logChannelId,
      );

    if (!channel) {
      return false;
    }

    await channel.send({
      content: [
        `💾 **NEXORA Recovery Snapshot**`,
        `ID: \`${snapshot.snapshotId}\``,
        `Type: **${snapshot.type}**`,
        `Protected: **${snapshot.protected ? "YES" : "NO"}**`,
        `SHA-256: \`${snapshot.hash}\``,
      ].join(
        "\n",
      ),

      files: [
        attachmentFor(
          snapshot,
        ),
      ],
    });

    return true;
  },

  async prune(
    guildId:
      string,

    retentionCount:
      number,
  ) {
    const keep =
      Math.max(
        5,
        Math.min(
          100,
          retentionCount,
        ),
      );

    const snapshots =
      await GuildSnapshot
        .find({
          guildId,

          protected:
            false,

          type:
            "auto",
        })
        .sort({
          createdAt:
            -1,
        })
        .select(
          "_id",
        );

    const remove =
      snapshots.slice(
        keep,
      );

    if (
      remove.length ===
      0
    ) {
      return 0;
    }

    const result =
      await GuildSnapshot
        .deleteMany({
          _id: {
            $in:
              remove.map(
                (
                  item,
                ) =>
                  item._id,
              ),
          },
        });

    return result.deletedCount;
  },

  async list(
    guildId:
      string,

    limit:
      number =
      RECOVERY_DEFAULTS
        .maxListResults,
  ) {
    return GuildSnapshot
      .find({
        guildId,
      })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        Math.max(
          1,
          Math.min(
            25,
            limit,
          ),
        ),
      );
  },

  async getSnapshot(
    guildId:
      string,

    id:
      string,
  ) {
    const snapshot =
      await GuildSnapshot
        .findOne({
          guildId,

          snapshotId:
            id,
        });

    if (!snapshot) {
      throw new Error(
        `ไม่พบ Snapshot \`${id}\``,
      );
    }

    if (
      snapshot.schemaVersion !==
      NEXORA_RECOVERY_SCHEMA_VERSION
    ) {
      throw new Error(
        `Snapshot schema ${snapshot.schemaVersion} ยังไม่รองรับ`,
      );
    }

    const calculated =
      stableHash(
        snapshot.payload as
          SnapshotPayload,
      );

    if (
      calculated !==
      snapshot.hash
    ) {
      throw new Error(
        "Snapshot integrity check FAILED — hash ไม่ตรง ห้าม Restore",
      );
    }

    return snapshot;
  },

  async latestProtected(
    guildId:
      string,
  ) {
    return GuildSnapshot
      .findOne({
        guildId,

        protected:
          true,
      })
      .sort({
        createdAt:
          -1,
      });
  },

  async diff(
    guild:
      Guild,

    snapshotIdValue:
      string,
  ) {
    const snapshot =
      await this.getSnapshot(
        guild.id,
        snapshotIdValue,
      );

    const desired =
      snapshot.payload as
        SnapshotPayload;

    const current =
      await this.capturePayload(
        guild,
      );

    const desiredRoles =
      new Map(
        desired.roles
          .map(
            (
              role,
            ) => [
              role.id,
              role,
            ],
          ),
      );

    const currentRoles =
      new Map(
        current.roles
          .map(
            (
              role,
            ) => [
              role.id,
              role,
            ],
          ),
      );

    const desiredChannels =
      new Map(
        desired.channels
          .map(
            (
              channel,
            ) => [
              channel.id,
              channel,
            ],
          ),
      );

    const currentChannels =
      new Map(
        current.channels
          .map(
            (
              channel,
            ) => [
              channel.id,
              channel,
            ],
          ),
      );

    const missingRoles =
      desired.roles
        .filter(
          (
            role,
          ) =>
            !currentRoles
              .has(
                role.id,
              ),
        )
        .map(
          (
            role,
          ) =>
            `${role.name} (${role.id})`,
        );

    const extraRoles =
      current.roles
        .filter(
          (
            role,
          ) =>
            !desiredRoles
              .has(
                role.id,
              ),
        )
        .map(
          (
            role,
          ) =>
            `${role.name} (${role.id})`,
        );

    const changedRoles =
      desired.roles
        .filter(
          (
            role,
          ) => {
            const now =
              currentRoles.get(
                role.id,
              );

            if (!now) {
              return false;
            }

            return (
              now.name !==
                role.name ||
              now.permissions !==
                role.permissions ||
              now.color !==
                role.color ||
              now.hoist !==
                role.hoist ||
              now.mentionable !==
                role.mentionable
            );
          },
        )
        .map(
          (
            role,
          ) =>
            `${role.name} (${role.id})`,
        );

    const missingChannels =
      desired.channels
        .filter(
          (
            channel,
          ) =>
            !currentChannels
              .has(
                channel.id,
              ),
        )
        .map(
          (
            channel,
          ) =>
            `${channel.name} (${channel.id})`,
        );

    const extraChannels =
      current.channels
        .filter(
          (
            channel,
          ) =>
            !desiredChannels
              .has(
                channel.id,
              ),
        )
        .map(
          (
            channel,
          ) =>
            `${channel.name} (${channel.id})`,
        );

    const changedChannels =
      desired.channels
        .filter(
          (
            channel,
          ) => {
            const now =
              currentChannels.get(
                channel.id,
              );

            if (!now) {
              return false;
            }

            return (
              now.name !==
                channel.name ||
              now.type !==
                channel.type ||
              now.parentId !==
                channel.parentId ||
              JSON.stringify(
                now.permissionOverwrites,
              ) !==
              JSON.stringify(
                channel.permissionOverwrites,
              )
            );
          },
        )
        .map(
          (
            channel,
          ) =>
            `${channel.name} (${channel.id})`,
        );

    return {
      snapshot,

      clean:
        missingRoles.length ===
          0 &&
        extraRoles.length ===
          0 &&
        changedRoles.length ===
          0 &&
        missingChannels.length ===
          0 &&
        extraChannels.length ===
          0 &&
        changedChannels.length ===
          0 &&
        current.guild
          .everyonePermissions ===
          desired.guild
            .everyonePermissions,

      everyonePermissionsChanged:
        current.guild
          .everyonePermissions !==
        desired.guild
          .everyonePermissions,

      missingRoles,
      extraRoles,
      changedRoles,
      missingChannels,
      extraChannels,
      changedChannels,
    };
  },

  async restore(
    guild:
      Guild,

    data: {
      snapshotId:
        string;

      mode:
        RecoveryMode;

      actorId:
        string;
    },
  ): Promise<
    RestoreReport
  > {
    const snapshot =
      await this.getSnapshot(
        guild.id,
        data.snapshotId,
      );

    const payload =
      snapshot.payload as
        SnapshotPayload;

    const pre =
      await this.capture(
        guild,
        {
          type:
            "pre_restore",

          label:
            `Before restore ${snapshot.snapshotId} (${data.mode})`,

          protected:
            true,

          actorId:
            data.actorId,

          sendCopy:
            true,
        },
      );

    const report:
      RestoreReport & {
        everyonePermissions?:
          string;
      } = {
      mode:
        data.mode,

      snapshotId:
        snapshot.snapshotId,

      preRestoreSnapshotId:
        pre.snapshotId,

      createdRoles:
        [],

      createdChannels:
        [],

      updatedRoles:
        [],

      updatedChannels:
        [],

      warnings:
        [],

      everyonePermissions:
        payload.guild
          .everyonePermissions,
    };

    const createMissing =
      data.mode ===
        "missing" ||
      data.mode ===
        "repair";

    const roleMap =
      await buildRoleMap(
        guild,
        payload.roles,
        createMissing,
        report,
      );

    const channelMap =
      await buildChannelMap(
        guild,
        payload.channels,
        roleMap,
        createMissing,
        report,
      );

    if (
      data.mode ===
        "permissions" ||
      data.mode ===
        "repair"
    ) {
      await repairRoles(
        guild,
        payload.roles,
        roleMap,
        report,
        data.mode ===
          "repair",
      );

      await repairChannels(
        guild,
        payload.channels,
        channelMap,
        roleMap,
        report,
        data.mode ===
          "repair",
      );
    }

    return report;
  },

  async setProtected(
    guildId:
      string,

    snapshotIdValue:
      string,

    value:
      boolean,
  ) {
    const snapshot =
      await this.getSnapshot(
        guildId,
        snapshotIdValue,
      );

    snapshot.protected =
      value;

    await snapshot.save();

    return snapshot;
  },

  async deleteSnapshot(
    guildId:
      string,

    snapshotIdValue:
      string,
  ) {
    const snapshot =
      await this.getSnapshot(
        guildId,
        snapshotIdValue,
      );

    if (
      snapshot.protected
    ) {
      throw new Error(
        "Snapshot นี้ถูก Protect อยู่ — Unprotect ก่อนจึงจะลบได้",
      );
    }

    await snapshot.deleteOne();

    return snapshot;
  },

  async updateConfig(
    guildId:
      string,

    data: {
      enabled?:
        boolean;

      autoSnapshotHours?:
        number;

      retentionCount?:
        number;

      externalCopies?:
        boolean;
    },
  ) {
    const config =
      await this.requireConfig(
        guildId,
      );

    if (
      data.enabled !==
      undefined
    ) {
      config.enabled =
        data.enabled;
    }

    if (
      data.autoSnapshotHours !==
      undefined
    ) {
      config.autoSnapshotHours =
        Math.max(
          1,
          Math.min(
            168,
            data.autoSnapshotHours,
          ),
        );
    }

    if (
      data.retentionCount !==
      undefined
    ) {
      config.retentionCount =
        Math.max(
          5,
          Math.min(
            100,
            data.retentionCount,
          ),
        );
    }

    if (
      data.externalCopies !==
      undefined
    ) {
      config.externalCopies =
        data.externalCopies;
    }

    await config.save();

    return config;
  },

  async runAutoSnapshots(
    client:
      Client,
  ) {
    const configs =
      await GuildRecoveryConfig
        .find({
          enabled:
            true,
        });

    const now =
      Date.now();

    for (
      const config
      of configs
    ) {
      const guild =
        client.guilds.cache
          .get(
            config.guildId,
          );

      if (!guild) {
        continue;
      }

      const dueAt =
        config.lastAutoSnapshotAt
          ? config
              .lastAutoSnapshotAt
              .getTime() +
            config
              .autoSnapshotHours *
            60 *
            60 *
            1000
          : 0;

      if (
        dueAt >
        now
      ) {
        continue;
      }

      try {
        await this.capture(
          guild,
          {
            type:
              "auto",

            label:
              "Scheduled automatic recovery snapshot",

            protected:
              false,

            actorId:
              client.user
                ?.id ??
              "NEXORA",

            sendCopy:
              config.externalCopies,
          },
        );
      } catch (error) {
        console.error(
          `❌ Auto recovery snapshot failed for guild ${guild.id}:`,
          error,
        );
      }
    }
  },

  startAutoSnapshots(
    client:
      Client,
  ) {
    if (
      autoSnapshotTimer
    ) {
      return;
    }

    void this.runAutoSnapshots(
      client,
    );

    autoSnapshotTimer =
      setInterval(
        () => {
          void this
            .runAutoSnapshots(
              client,
            );
        },
        15 *
        60 *
        1000,
      );

    autoSnapshotTimer
      .unref();
  },

  exportAttachment(
    snapshot:
      any,
  ) {
    return attachmentFor(
      snapshot,
    );
  },

  summaryEmbed(
    diff:
      any,
  ) {
    const short =
      (
        values:
          string[],
      ) =>
        values
          .slice(
            0,
            8,
          )
          .join(
            "\n",
          ) ||
        "ไม่มี";

    return new EmbedBuilder()
      .setColor(
        diff.clean
          ? 0x57f287
          : 0xfee75c,
      )
      .setTitle(
        diff.clean
          ? "✅ Recovery Integrity Clean"
          : "⚠️ Recovery Drift Detected",
      )
      .setDescription(
        `Snapshot: \`${diff.snapshot.snapshotId}\`\nSHA-256: \`${diff.snapshot.hash}\``,
      )
      .addFields(
        {
          name:
            `Missing Roles (${diff.missingRoles.length})`,

          value:
            short(
              diff.missingRoles,
            ),
        },

        {
          name:
            `Changed Roles (${diff.changedRoles.length})`,

          value:
            short(
              diff.changedRoles,
            ),
        },

        {
          name:
            `Extra Roles (${diff.extraRoles.length})`,

          value:
            short(
              diff.extraRoles,
            ),
        },

        {
          name:
            `Missing Channels (${diff.missingChannels.length})`,

          value:
            short(
              diff.missingChannels,
            ),
        },

        {
          name:
            `Changed Channels (${diff.changedChannels.length})`,

          value:
            short(
              diff.changedChannels,
            ),
        },

        {
          name:
            `Extra Channels (${diff.extraChannels.length})`,

          value:
            short(
              diff.extraChannels,
            ),
        },

        {
          name:
            "@everyone permissions",

          value:
            diff.everyonePermissionsChanged
              ? "⚠️ Changed"
              : "✅ Match",

          inline:
            true,
        },
      )
      .setFooter({
        text:
          "NEXORA • Disaster Recovery",
      })
      .setTimestamp();
  },
};
