import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
} from "discord.js";

import {
  CommunityLoggingConfig,
} from "../../models/CommunityLoggingConfig.js";

import {
  CommunityLogRecord,
} from "../../models/CommunityLogRecord.js";

export type CommunityLogCategory =
  | "member"
  | "moderation"
  | "voice"
  | "marketplace"
  | "system"
  | "rpg";

export type CommunityLogSeverity =
  | "info"
  | "success"
  | "warning"
  | "error";

export type CommunityLogField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type CommunityLogPayload = {
  event: string;
  title: string;
  description?: string | null;
  severity?: CommunityLogSeverity;
  userId?: string | null;
  actorId?: string | null;
  channelId?: string | null;
  fields?: CommunityLogField[];
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
};

type ResolvedConfig = {
  enabled: boolean;
  retentionDays: number;
  channels: Record<
    CommunityLogCategory,
    string | null
  >;
};

const CATEGORY_NAME =
  "NEXORA LOGS";

const CHANNEL_NAMES:
  Record<
    CommunityLogCategory,
    string
  > = {
    member:
      "📜・member-logs",

    moderation:
      "🛡️・moderation-logs",

    voice:
      "🔊・voice-logs",

    marketplace:
      "🛒・marketplace-logs",

    system:
      "⚙️・system-logs",

    rpg:
      "⚔️・rpg-logs",
  };

const CHANNEL_TOPICS:
  Record<
    CommunityLogCategory,
    string
  > = {
    member:
      "NEXORA • Member Lifecycle, joins, leaves, roles and profile changes",

    moderation:
      "NEXORA • Moderation, bans, kicks, timeouts, AutoMod and message events",

    voice:
      "NEXORA • Voice channel activity and Temporary Voice events",

    marketplace:
      "NEXORA • Marketplace, shops, products, trade requests and reviews",

    system:
      "NEXORA • Runtime, scheduler, security, recovery and system events",

    rpg:
      "NEXORA • Dungeon RPG, rare drops, crafting, trading and ascension",
  };

const CATEGORY_COLORS:
  Record<
    CommunityLogCategory,
    number
  > = {
    member:
      0x168bff,

    moderation:
      0xb23cff,

    voice:
      0x00d9ff,

    marketplace:
      0x8247ff,

    system:
      0x315cff,

    rpg:
      0x5338e8,
  };

const CATEGORY_ICONS:
  Record<
    CommunityLogCategory,
    string
  > = {
    member:
      "📜",

    moderation:
      "🛡️",

    voice:
      "🔊",

    marketplace:
      "🛒",

    system:
      "⚙️",

    rpg:
      "⚔️",
  };

const configCache =
  new Map<
    string,
    ResolvedConfig
  >();

const infrastructureLocks =
  new Map<
    string,
    Promise<ResolvedConfig>
  >();

function truncate(
  value: string,
  maxLength: number,
): string {
  if (
    value.length <=
    maxLength
  ) {
    return value;
  }

  return (
    value.slice(
      0,
      Math.max(
        0,
        maxLength - 1,
      ),
    ) + "…"
  );
}

function normalizeId(
  value: unknown,
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const trimmed =
    value.trim();

  return trimmed.length > 0
    ? trimmed
    : null;
}

function resolvedFromDocument(
  document: any,
): ResolvedConfig {
  return {
    enabled:
      document?.enabled !==
      false,

    retentionDays:
      Math.max(
        1,
        Math.min(
          365,
          Number(
            document?.retentionDays ??
              90,
          ) || 90,
        ),
      ),

    channels: {
      member:
        normalizeId(
          document?.channels
            ?.member,
        ),

      moderation:
        normalizeId(
          document?.channels
            ?.moderation,
        ),

      voice:
        normalizeId(
          document?.channels
            ?.voice,
        ),

      marketplace:
        normalizeId(
          document?.channels
            ?.marketplace,
        ),

      system:
        normalizeId(
          document?.channels
            ?.system,
        ),

      rpg:
        normalizeId(
          document?.channels
            ?.rpg,
        ),
    },
  };
}

async function createPrivateCategory(
  guild: Guild,
): Promise<string | null> {
  const me =
    guild.members.me;

  if (
    !me?.permissions.has(
      PermissionFlagsBits.ManageChannels,
    )
  ) {
    console.warn(
      "⚠️ Logging: NEXORA ไม่มี Manage Channels จึงสร้างหมวด NEXORA LOGS ไม่ได้",
    );

    return null;
  }

  const staffRoleOverwrites =
    guild.roles.cache
      .filter(
        (role) =>
          !role.managed &&
          (
            role.permissions.has(
              PermissionFlagsBits.Administrator,
            ) ||
            role.permissions.has(
              PermissionFlagsBits.ManageGuild,
            )
          ),
      )
      .map(
        (role) => ({
          id:
            role.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        }),
      );

  const category =
    await guild.channels.create({
      name:
        CATEGORY_NAME,

      type:
        ChannelType.GuildCategory,

      permissionOverwrites: [
        {
          id:
            guild.roles
              .everyone.id,

          deny: [
            PermissionFlagsBits.ViewChannel,
          ],
        },

        {
          id:
            me.id,

          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
          ],
        },

        ...staffRoleOverwrites,
      ],

      reason:
        "NEXORA Logging System",
    });

  console.log(
    `📂 Logging created category: ${CATEGORY_NAME}`,
  );

  return category.id;
}

async function ensureInfrastructureInternal(
  guild: Guild,
): Promise<ResolvedConfig> {
  let config =
    await CommunityLoggingConfig.findOneAndUpdate(
      {
        guildId:
          guild.id,
      },
      {
        $setOnInsert: {
          guildId:
            guild.id,

          enabled:
            true,

          retentionDays:
            90,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

  if (!config) {
    throw new Error(
      `Unable to create logging config for guild ${guild.id}`,
    );
  }

  let categoryId =
    normalizeId(
      config.categoryId,
    );

  if (categoryId) {
    const configuredCategory =
      guild.channels.cache.get(
        categoryId,
      );

    if (
      configuredCategory?.type !==
      ChannelType.GuildCategory
    ) {
      categoryId =
        null;
    }
  }

  if (!categoryId) {
    const existingCategory =
      guild.channels.cache.find(
        (channel) =>
          channel.type ===
            ChannelType.GuildCategory &&
          channel.name ===
            CATEGORY_NAME,
      );

    if (existingCategory) {
      categoryId =
        existingCategory.id;
    }
  }

  if (!categoryId) {
    categoryId =
      await createPrivateCategory(
        guild,
      );
  }

  if (categoryId) {
    config.categoryId =
      categoryId;

    const me =
      guild.members.me;

    const canCreateChannels =
      Boolean(
        me?.permissions.has(
          PermissionFlagsBits.ManageChannels,
        ),
      );

    for (
      const category of Object.keys(
        CHANNEL_NAMES,
      ) as CommunityLogCategory[]
    ) {
      let channelId =
        normalizeId(
          (config.channels as any)?.[
            category
          ],
        );

      if (channelId) {
        const configuredChannel =
          guild.channels.cache.get(
            channelId,
          );

        if (
          configuredChannel?.type !==
          ChannelType.GuildText
        ) {
          channelId =
            null;
        }
      }

      if (!channelId) {
        const existing =
          guild.channels.cache.find(
            (channel) =>
              channel.type ===
                ChannelType.GuildText &&
              channel.parentId ===
                categoryId &&
              channel.name ===
                CHANNEL_NAMES[
                  category
                ],
          );

        if (existing) {
          channelId =
            existing.id;
        }
      }

      if (
        !channelId &&
        canCreateChannels
      ) {
        const channel =
          await guild.channels.create({
            name:
              CHANNEL_NAMES[
                category
              ],

            type:
              ChannelType.GuildText,

            parent:
              categoryId,

            topic:
              CHANNEL_TOPICS[
                category
              ],

            reason:
              `NEXORA Logging • ${category}`,
          });

        channelId =
          channel.id;

        console.log(
          `📝 Logging created channel: ${channel.name}`,
        );
      }

      if (
        channelId &&
        config.channels
      ) {
        (
          config.channels as any
        )[category] =
          channelId;
      }
    }

    config.markModified(
      "channels",
    );

    await config.save();
  }

  const resolved =
    resolvedFromDocument(
      config,
    );

  configCache.set(
    guild.id,
    resolved,
  );

  return resolved;
}

async function ensureInfrastructure(
  guild: Guild,
): Promise<ResolvedConfig> {
  const existingLock =
    infrastructureLocks.get(
      guild.id,
    );

  if (existingLock) {
    return existingLock;
  }

  let task:
    Promise<ResolvedConfig>;

  task =
    ensureInfrastructureInternal(
      guild,
    ).finally(
      () => {
        if (
          infrastructureLocks.get(
            guild.id,
          ) === task
        ) {
          infrastructureLocks.delete(
            guild.id,
          );
        }
      },
    );

  infrastructureLocks.set(
    guild.id,
    task,
  );

  return task;
}

async function getConfig(
  guild: Guild,
): Promise<ResolvedConfig> {
  const cached =
    configCache.get(
      guild.id,
    );

  if (cached) {
    return cached;
  }

  return ensureInfrastructure(
    guild,
  );
}

async function writeDatabaseRecord(
  guild: Guild,
  category: CommunityLogCategory,
  payload: CommunityLogPayload,
  retentionDays: number,
): Promise<void> {
  const occurredAt =
    payload.occurredAt ??
    new Date();

  const expiresAt =
    new Date(
      occurredAt.getTime() +
        retentionDays *
          24 *
          60 *
          60 *
          1000,
    );

  await CommunityLogRecord.create({
    guildId:
      guild.id,

    category,

    event:
      payload.event,

    severity:
      payload.severity ??
      "info",

    title:
      payload.title,

    description:
      payload.description ??
      null,

    userId:
      payload.userId ??
      null,

    actorId:
      payload.actorId ??
      null,

    channelId:
      payload.channelId ??
      null,

    metadata:
      payload.metadata ??
      {},

    occurredAt,

    expiresAt,
  });
}

async function sendDiscordLog(
  guild: Guild,
  category: CommunityLogCategory,
  payload: CommunityLogPayload,
  channelId: string | null,
): Promise<void> {
  if (!channelId) {
    return;
  }

  let channel =
    guild.channels.cache.get(
      channelId,
    );

  if (!channel) {
    channel =
      await guild.channels
        .fetch(
          channelId,
        )
        .catch(
          () => null,
        ) ??
      undefined;
  }

  if (
    !channel ||
    channel.type !==
      ChannelType.GuildText
  ) {
    console.warn(
      `⚠️ Logging channel unavailable: ${category} (${channelId})`,
    );

    configCache.delete(
      guild.id,
    );

    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(
        CATEGORY_COLORS[
          category
        ],
      )
      .setTitle(
        truncate(
          `${CATEGORY_ICONS[category]} ${payload.title}`,
          256,
        ),
      )
      .setTimestamp(
        payload.occurredAt ??
          new Date(),
      )
      .setFooter({
        text:
          `NEXORA • ${category.toUpperCase()} • ${payload.event}`,
      });

  if (
    payload.description
  ) {
    embed.setDescription(
      truncate(
        payload.description,
        4096,
      ),
    );
  }

  const fields:
    CommunityLogField[] = [
      ...(payload.userId
        ? [
            {
              name:
                "สมาชิก",

              value:
                `<@${payload.userId}>\n\`${payload.userId}\``,

              inline:
                true,
            },
          ]
        : []),

      ...(payload.actorId
        ? [
            {
              name:
                "ผู้ดำเนินการ",

              value:
                `<@${payload.actorId}>\n\`${payload.actorId}\``,

              inline:
                true,
            },
          ]
        : []),

      ...(payload.channelId
        ? [
            {
              name:
                "ช่อง",

              value:
                `<#${payload.channelId}>\n\`${payload.channelId}\``,

              inline:
                true,
            },
          ]
        : []),

      ...(
        payload.fields ??
        []
      ),
    ].slice(
      0,
      25,
    );

  if (
    fields.length > 0
  ) {
    embed.addFields(
      fields.map(
        (field) => ({
          name:
            truncate(
              field.name,
              256,
            ),

          value:
            truncate(
              field.value ||
                "-",
              1024,
            ),

          inline:
            field.inline ??
            false,
        }),
      ),
    );
  }

  await channel.send({
    embeds: [
      embed,
    ],

    allowedMentions: {
      parse: [],
    },
  });
}

async function log(
  guild: Guild,
  category: CommunityLogCategory,
  payload: CommunityLogPayload,
): Promise<void> {
  try {
    const config =
      await getConfig(
        guild,
      );

    if (!config.enabled) {
      return;
    }

    try {
      await writeDatabaseRecord(
        guild,
        category,
        payload,
        config.retentionDays,
      );
    } catch (error) {
      console.error(
        `❌ Logging DB write failed • ${category}/${payload.event}:`,
        error,
      );
    }

    try {
      await sendDiscordLog(
        guild,
        category,
        payload,
        config.channels[
          category
        ],
      );
    } catch (error) {
      console.error(
        `❌ Logging Discord send failed • ${category}/${payload.event}:`,
        error,
      );
    }
  } catch (error) {
    console.error(
      `❌ Logging failed • ${category}/${payload.event}:`,
      error,
    );
  }
}

export const communityLoggingService = {
  ensureInfrastructure,

  invalidateConfig(
    guildId?: string,
  ): void {
    if (guildId) {
      configCache.delete(
        guildId,
      );

      return;
    }

    configCache.clear();
  },

  log,

  member(
    guild: Guild,
    payload: CommunityLogPayload,
  ) {
    return log(
      guild,
      "member",
      payload,
    );
  },

  moderation(
    guild: Guild,
    payload: CommunityLogPayload,
  ) {
    return log(
      guild,
      "moderation",
      payload,
    );
  },

  voice(
    guild: Guild,
    payload: CommunityLogPayload,
  ) {
    return log(
      guild,
      "voice",
      payload,
    );
  },

  marketplace(
    guild: Guild,
    payload: CommunityLogPayload,
  ) {
    return log(
      guild,
      "marketplace",
      payload,
    );
  },

  system(
    guild: Guild,
    payload: CommunityLogPayload,
  ) {
    return log(
      guild,
      "system",
      payload,
    );
  },

  rpg(
    guild: Guild,
    payload: CommunityLogPayload,
  ) {
    return log(
      guild,
      "rpg",
      payload,
    );
  },
};
