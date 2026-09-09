import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type AutoModerationActionExecution,
  type AutoModerationActionOptions,
  type AutoModerationRuleCreateOptions,
  type Guild,
} from "discord.js";

import {
  AutoModConfig,
} from "../../models/AutoModConfig.js";

import {
  ModerationLog,
} from "../../models/ModerationLog.js";

import {
  moderationService,
} from "./moderationService.js";

import {
  AUTO_MOD_LIMITS,
  AUTO_MOD_RULE_LABELS,
  AUTO_MOD_RULE_NAMES,
  DEFAULT_INVITE_KEYWORDS,
  DEFAULT_SECURITY_KEYWORDS,
  NEXORA_AUTOMOD_POLICY_VERSION,
  NEXORA_AUTOMOD_PREFIX,
  type AutoModRuleKey,
} from "../../community/automod/autoModPolicy.js";

type DesiredRule = {
  key:
    AutoModRuleKey;

  data:
    AutoModerationRuleCreateOptions;
};

type CommandBucket = {
  hits:
    number[];

  blockedUntil:
    number;

  lastCaseAt:
    number;
};

const commandBuckets =
  new Map<
    string,
    CommandBucket
  >();

function unique(
  values:
    string[],
) {
  return [
    ...new Set(
      values.filter(
        Boolean,
      ),
    ),
  ];
}

function trimDiscordList(
  values:
    string[],

  max:
    number,
) {
  return unique(
    values,
  ).slice(
    0,
    max,
  );
}

function normalizeKeyword(
  value:
    string,
) {
  return value
    .trim()
    .replace(
      /\s+/g,
      " ",
    )
    .slice(
      0,
      58,
    );
}

function keywordPattern(
  value:
    string,
) {
  const clean =
    normalizeKeyword(
      value,
    );

  if (
    clean.includes(
      "*",
    )
  ) {
    return clean;
  }

  return `*${clean}*`;
}

function blockAction(
  message:
    string,
): AutoModerationActionOptions {
  return {
    type:
      AutoModerationActionType
        .BlockMessage,

    metadata: {
      customMessage:
        message.slice(
          0,
          150,
        ),
    },
  };
}

function alertAction(
  logChannelId:
    string,
): AutoModerationActionOptions {
  return {
    type:
      AutoModerationActionType
        .SendAlertMessage,

    metadata: {
      channel:
        logChannelId,
    },
  };
}

function baseActions(
  logChannelId:
    string,

  message:
    string,
) {
  return [
    blockAction(
      message,
    ),

    alertAction(
      logChannelId,
    ),
  ];
}

function configRuleIds(
  config:
    any,
): Record<
  string,
  string
> {
  const raw =
    config.discordRuleIds;

  if (
    !raw ||
    typeof raw !==
      "object"
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(
      raw,
    ).map(
      ([
        key,
        value,
      ]) => [
        key,
        String(
          value,
        ),
      ],
    ),
  );
}

function ruleKeyById(
  config:
    any,

  ruleId:
    string,
): AutoModRuleKey |
  null {
  const ids =
    configRuleIds(
      config,
    );

  for (
    const [
      key,
      id,
    ]
    of Object.entries(
      ids,
    )
  ) {
    if (
      id ===
      ruleId &&
      key in
        AUTO_MOD_RULE_NAMES
    ) {
      return key as
        AutoModRuleKey;
    }
  }

  return null;
}

function desiredRules(
  config:
    any,
): DesiredRule[] {
  const enabled =
    Boolean(
      config.enabled,
    );

  const exemptRoles =
    trimDiscordList(
      config.exemptRoleIds ??
        [],
      20,
    );

  const exemptChannels =
    trimDiscordList(
      config.exemptChannelIds ??
        [],
      50,
    );

  const promoExempt =
    trimDiscordList(
      [
        ...exemptChannels,
        ...(
          config.promoChannelIds ??
          []
        ),
      ],
      50,
    );

  const common = {
    eventType:
      AutoModerationRuleEventType
        .MessageSend,

    enabled,

    exemptRoles,

    reason:
      `NEXORA AutoMod policy ${NEXORA_AUTOMOD_POLICY_VERSION}`,
  };

  const rules:
    DesiredRule[] = [
    {
      key:
        "spam",

      data: {
        ...common,

        name:
          AUTO_MOD_RULE_NAMES
            .spam,

        triggerType:
          AutoModerationRuleTriggerType
            .Spam,

        exemptChannels,

        actions:
          baseActions(
            config
              .logChannelId,
            "NEXORA: ข้อความนี้ถูกบล็อกเพราะเข้าข่าย Spam/Flood",
          ),
      },
    },

    {
      key:
        "mentionSpam",

      data: {
        ...common,

        name:
          AUTO_MOD_RULE_NAMES
            .mentionSpam,

        triggerType:
          AutoModerationRuleTriggerType
            .MentionSpam,

        triggerMetadata: {
          mentionTotalLimit:
            AUTO_MOD_LIMITS
              .mentionTotal,

          mentionRaidProtectionEnabled:
            true,
        },

        exemptChannels,

        actions:
          baseActions(
            config
              .logChannelId,
            "NEXORA: ห้าม Mention/Ping สมาชิกจำนวนมากหรือ Ping รัว",
          ),
      },
    },

    {
      key:
        "unsafeContent",

      data: {
        ...common,

        name:
          AUTO_MOD_RULE_NAMES
            .unsafeContent,

        triggerType:
          AutoModerationRuleTriggerType
            .KeywordPreset,

        triggerMetadata: {
          presets: [
            AutoModerationRuleKeywordPresetType
              .SexualContent,

            AutoModerationRuleKeywordPresetType
              .Slurs,
          ],
        },

        exemptChannels,

        actions:
          baseActions(
            config
              .logChannelId,
            "NEXORA: เนื้อหานี้เข้าข่ายเนื้อหาต้องห้ามของคอมมิวนิตี",
          ),
      },
    },

    {
      key:
        "invites",

      data: {
        ...common,

        name:
          AUTO_MOD_RULE_NAMES
            .invites,

        triggerType:
          AutoModerationRuleTriggerType
            .Keyword,

        triggerMetadata: {
          keywordFilter:
            [
              ...DEFAULT_INVITE_KEYWORDS,
            ],
        },

        exemptChannels:
          promoExempt,

        actions:
          baseActions(
            config
              .logChannelId,
            "NEXORA: โปรโมต/Invite ได้เฉพาะพื้นที่ที่ได้รับอนุญาต",
          ),
      },
    },

    {
      key:
        "security",

      data: {
        ...common,

        name:
          AUTO_MOD_RULE_NAMES
            .security,

        triggerType:
          AutoModerationRuleTriggerType
            .Keyword,

        triggerMetadata: {
          keywordFilter:
            [
              ...DEFAULT_SECURITY_KEYWORDS,
            ],
        },

        exemptChannels,

        actions:
          baseActions(
            config
              .logChannelId,
            "NEXORA: ข้อความเข้าข่าย Phishing/Credential Theft/Malware",
          ),
      },
    },
  ];

  const customKeywords =
    unique(
      (
        config.customKeywords ??
        []
      )
        .map(
          normalizeKeyword,
        )
        .filter(
          Boolean,
        ),
    )
      .slice(
        0,
        500,
      )
      .map(
        keywordPattern,
      );

  if (
    customKeywords.length >
    0
  ) {
    rules.push({
      key:
        "custom",

      data: {
        ...common,

        name:
          AUTO_MOD_RULE_NAMES
            .custom,

        triggerType:
          AutoModerationRuleTriggerType
            .Keyword,

        triggerMetadata: {
          keywordFilter:
            customKeywords,
        },

        exemptChannels,

        actions:
          baseActions(
            config
              .logChannelId,
            "NEXORA: ข้อความมีคำหรือวลีที่ถูกบล็อกโดยทีมงาน",
          ),
      },
    });
  }

  return rules;
}

async function fetchLogChannel(
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

async function sendEscalationLog(
  guild:
    Guild,

  config:
    any,

  data: {
    userId:
      string;

    ruleLabel:
      string;

    minutes:
      number;

    violationCaseId:
      string | null;

    timeoutCaseId:
      string | null;

    channelId?:
      string | null;
  },
) {
  const channel =
    await fetchLogChannel(
      guild,
      config.logChannelId,
    );

  if (!channel) {
    return;
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(
          0xed4245,
        )
        .setTitle(
          "⏳ NEXORA AutoMod Escalation",
        )
        .setDescription(
          [
            `**Member:** <@${data.userId}>`,
            `**Rule:** ${data.ruleLabel}`,
            `**Action:** Timeout ${data.minutes} นาที`,
            data.channelId
              ? `**Channel:** <#${data.channelId}>`
              : null,
            data.violationCaseId
              ? `**AutoMod Case:** \`${data.violationCaseId}\``
              : null,
            data.timeoutCaseId
              ? `**Timeout Case:** \`${data.timeoutCaseId}\``
              : null,
          ]
            .filter(
              Boolean,
            )
            .join(
              "\n",
            ),
        )
        .setFooter({
          text:
            "NEXORA • Community Rules Enforcement",
        })
        .setTimestamp(),
    ],
  });
}

export const autoModService = {
  async getConfig(
    guildId:
      string,
  ) {
    return AutoModConfig
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
        "AutoMod ยังไม่ได้ตั้งค่า — ใช้ `/automod setup` ก่อน",
      );
    }

    return config;
  },

  async setup(
    guild:
      Guild,

    logChannelId:
      string,

    actorId:
      string,
  ) {
    const logChannel =
      await fetchLogChannel(
        guild,
        logChannelId,
      );

    if (!logChannel) {
      throw new Error(
        "AutoMod Log ต้องเป็น Text Channel",
      );
    }

    const me =
      guild.members.me;

    if (
      !me?.permissions.has(
        PermissionFlagsBits
          .ManageGuild,
      )
    ) {
      throw new Error(
        "NEXORA ต้องมีสิทธิ์ Manage Server เพื่อสร้าง Discord AutoMod Rules",
      );
    }

    const config =
      await AutoModConfig
        .findOneAndUpdate(
          {
            guildId:
              guild.id,
          },
          {
            $set: {
              enabled:
                true,

              logChannelId,

              policyVersion:
                NEXORA_AUTOMOD_POLICY_VERSION,
            },

            $setOnInsert: {
              promoChannelIds:
                [],

              exemptRoleIds:
                [],

              exemptChannelIds:
                [],

              customKeywords:
                [],

              discordRuleIds:
                {},
            },
          },
          {
            new:
              true,

            upsert:
              true,
          },
        );

    await this.sync(
      guild,
      actorId,
    );

    return config;
  },

  async sync(
    guild:
      Guild,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const me =
      guild.members.me;

    if (
      !me?.permissions.has(
        PermissionFlagsBits
          .ManageGuild,
      )
    ) {
      throw new Error(
        "NEXORA ต้องมีสิทธิ์ Manage Server เพื่อ Sync AutoMod",
      );
    }

    const existing =
      await guild
        .autoModerationRules
        .fetch();

    const managed =
      existing.filter(
        (
          rule,
        ) =>
          rule.name.startsWith(
            NEXORA_AUTOMOD_PREFIX,
          ),
      );

    const previousIds =
      configRuleIds(
        config,
      );

    const desired =
      desiredRules(
        config,
      );

    const nextIds:
      Record<
        string,
        string
      > = {};

    const desiredNames =
      new Set(
        desired.map(
          (
            item,
          ) =>
            item.data
              .name,
        ),
      );

    for (
      const item
      of desired
    ) {
      let rule =
        previousIds[
          item.key
        ]
          ? existing.get(
              previousIds[
                item.key
              ],
            )
          : undefined;

      rule ??=
        managed.find(
          (
            candidate,
          ) =>
            candidate.name ===
            item.data.name,
        );

      if (
        rule &&
        rule.triggerType !==
          item.data
            .triggerType
      ) {
        await rule.delete(
          "NEXORA AutoMod trigger type changed",
        );

        rule =
          undefined;
      }

      if (rule) {
        const {
          triggerType: _,
          ...editData
        } =
          item.data;

        const updated =
          await guild
            .autoModerationRules
            .edit(
              rule.id,
              editData,
            );

        nextIds[
          item.key
        ] =
          updated.id;
      } else {
        const created =
          await guild
            .autoModerationRules
            .create(
              item.data,
            );

        nextIds[
          item.key
        ] =
          created.id;
      }
    }

    for (
      const rule
      of managed.values()
    ) {
      if (
        !desiredNames.has(
          rule.name,
        )
      ) {
        await rule.delete(
          "Removing obsolete NEXORA AutoMod rule",
        );
      }
    }

    config.discordRuleIds =
      nextIds;

    config.policyVersion =
      NEXORA_AUTOMOD_POLICY_VERSION;

    config.lastSyncedAt =
      new Date();

    config.lastSyncedBy =
      actorId;

    await config.save();

    return {
      config,
      ruleIds:
        nextIds,
      count:
        Object.keys(
          nextIds,
        ).length,
    };
  },

  async setEnabled(
    guild:
      Guild,

    enabled:
      boolean,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    config.enabled =
      enabled;

    await config.save();

    return this.sync(
      guild,
      actorId,
    );
  },

  async setPromoChannel(
    guild:
      Guild,

    channelId:
      string,

    add:
      boolean,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const values =
      new Set(
        config.promoChannelIds ??
        [],
      );

    if (add) {
      values.add(
        channelId,
      );
    } else {
      values.delete(
        channelId,
      );
    }

    config.promoChannelIds =
      [
        ...values,
      ].slice(
        0,
        50,
      );

    await config.save();

    await this.sync(
      guild,
      actorId,
    );

    return config;
  },

  async setExemptChannel(
    guild:
      Guild,

    channelId:
      string,

    add:
      boolean,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const values =
      new Set(
        config.exemptChannelIds ??
        [],
      );

    if (add) {
      values.add(
        channelId,
      );
    } else {
      values.delete(
        channelId,
      );
    }

    config.exemptChannelIds =
      [
        ...values,
      ].slice(
        0,
        50,
      );

    await config.save();

    await this.sync(
      guild,
      actorId,
    );

    return config;
  },

  async setExemptRole(
    guild:
      Guild,

    roleId:
      string,

    add:
      boolean,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const values =
      new Set(
        config.exemptRoleIds ??
        [],
      );

    if (add) {
      values.add(
        roleId,
      );
    } else {
      values.delete(
        roleId,
      );
    }

    config.exemptRoleIds =
      [
        ...values,
      ].slice(
        0,
        20,
      );

    await config.save();

    await this.sync(
      guild,
      actorId,
    );

    return config;
  },

  async setKeyword(
    guild:
      Guild,

    value:
      string,

    add:
      boolean,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const clean =
      normalizeKeyword(
        value,
      );

    if (
      clean.length <
      2
    ) {
      throw new Error(
        "Keyword ต้องมีอย่างน้อย 2 ตัวอักษร",
      );
    }

    const current =
      (
        config.customKeywords ??
        []
      ).map(
        String,
      );

    if (add) {
      if (
        !current.some(
          (
            item,
          ) =>
            item.toLowerCase() ===
            clean.toLowerCase(),
        )
      ) {
        current.push(
          clean,
        );
      }
    } else {
      const index =
        current.findIndex(
          (
            item,
          ) =>
            item.toLowerCase() ===
            clean.toLowerCase(),
        );

      if (
        index >=
        0
      ) {
        current.splice(
          index,
          1,
        );
      }
    }

    config.customKeywords =
      current.slice(
        0,
        500,
      );

    await config.save();

    await this.sync(
      guild,
      actorId,
    );

    return config;
  },

  async handleExecution(
    execution:
      AutoModerationActionExecution,
  ) {
    if (
      execution.action
        .type !==
      AutoModerationActionType
        .BlockMessage
    ) {
      return;
    }

    const guild =
      execution.guild;

    const config =
      await this.getConfig(
        guild.id,
      );

    if (
      !config ||
      !config.enabled
    ) {
      return;
    }

    const key =
      ruleKeyById(
        config,
        execution.ruleId,
      );

    if (!key) {
      return;
    }

    const label =
      AUTO_MOD_RULE_LABELS[
        key
      ];

    const violation =
      await moderationService
        .createCase({
          guildId:
            guild.id,

          targetUserId:
            execution.userId,

          moderatorId:
            guild.client
              .user.id,

          action:
            "automod",

          reason:
            `AutoMod: ${label}`,

          metadata: {
            source:
              "discord_automod",

            policyVersion:
              NEXORA_AUTOMOD_POLICY_VERSION,

            ruleKey:
              key,

            ruleId:
              execution.ruleId,

            triggerType:
              execution
                .ruleTriggerType,

            channelId:
              execution.channelId,

            messageId:
              execution.messageId,

            matchedKeyword:
              execution
                .matchedKeyword,
          },
        });

    const now =
      new Date();

    const recentSince =
      new Date(
        now.getTime() -
        AUTO_MOD_LIMITS
          .recentWindowMs,
      );

    const daySince =
      new Date(
        now.getTime() -
        AUTO_MOD_LIMITS
          .dayWindowMs,
      );

    const [
      recentCount,
      dayCount,
    ] =
      await Promise.all([
        ModerationLog
          .countDocuments({
            guildId:
              guild.id,

            targetUserId:
              execution.userId,

            action:
              "automod",

            createdAt: {
              $gte:
                recentSince,
            },
          }),

        ModerationLog
          .countDocuments({
            guildId:
              guild.id,

            targetUserId:
              execution.userId,

            action:
              "automod",

            createdAt: {
              $gte:
                daySince,
            },
          }),
      ]);

    let timeoutMinutes =
      0;

    if (
      key ===
      "security"
    ) {
      timeoutMinutes =
        AUTO_MOD_LIMITS
          .severeTimeoutMinutes;
    } else if (
      dayCount >=
      AUTO_MOD_LIMITS
        .dayViolationsForTimeout
    ) {
      timeoutMinutes =
        AUTO_MOD_LIMITS
          .dayTimeoutMinutes;
    } else if (
      recentCount >=
      AUTO_MOD_LIMITS
        .recentViolationsForTimeout
    ) {
      timeoutMinutes =
        AUTO_MOD_LIMITS
          .repeatTimeoutMinutes;
    }

    if (
      timeoutMinutes <=
      0
    ) {
      return;
    }

    const member =
      execution.member ??
      await guild.members
        .fetch(
          execution.userId,
        )
        .catch(
          () =>
            null,
        );

    if (
      !member ||
      member.user.bot ||
      member.id ===
        guild.ownerId ||
      !member.moderatable
    ) {
      return;
    }

    const targetUntil =
      Date.now() +
      timeoutMinutes *
      60_000;

    if (
      (
        member
          .communicationDisabledUntilTimestamp ??
        0
      ) >=
      targetUntil -
      5_000
    ) {
      return;
    }

    const timeoutReason =
      key ===
      "security"
        ? `NEXORA AutoMod: ${label} — severe safety violation`
        : `NEXORA AutoMod escalation — ${recentCount} recent / ${dayCount} daily violations`;

    await member.timeout(
      timeoutMinutes *
      60_000,
      timeoutReason,
    );

    const timeoutCase =
      await moderationService
        .createCase({
          guildId:
            guild.id,

          targetUserId:
            execution.userId,

          moderatorId:
            guild.client
              .user.id,

          action:
            "timeout",

          reason:
            timeoutReason,

          duration:
            timeoutMinutes *
            60_000,

          metadata: {
            source:
              "automod_escalation",

            automodCaseId:
              violation.caseId,

            ruleKey:
              key,

            recentCount,

            dayCount,
          },
        });

    await sendEscalationLog(
      guild,
      config,
      {
        userId:
          execution.userId,

        ruleLabel:
          label,

        minutes:
          timeoutMinutes,

        violationCaseId:
          violation.caseId ??
          null,

        timeoutCaseId:
          timeoutCase
            .caseId ??
          null,

        channelId:
          execution.channelId,
      },
    );
  },

  async checkCommandRateLimit(
    guildId:
      string,

    userId:
      string,
  ) {
    const config =
      await this.getConfig(
        guildId,
      );

    if (
      !config ||
      !config.enabled
    ) {
      return {
        allowed:
          true,

        retryAfterMs:
          0,

        newViolation:
          false,
      };
    }

    const now =
      Date.now();

    const key =
      `${guildId}:${userId}`;

    const bucket =
      commandBuckets.get(
        key,
      ) ?? {
        hits:
          [],

        blockedUntil:
          0,

        lastCaseAt:
          0,
      };

    bucket.hits =
      bucket.hits.filter(
        (
          timestamp,
        ) =>
          now -
          timestamp <
          AUTO_MOD_LIMITS
            .commandWindowMs,
      );

    if (
      bucket.blockedUntil >
      now
    ) {
      commandBuckets.set(
        key,
        bucket,
      );

      return {
        allowed:
          false,

        retryAfterMs:
          bucket.blockedUntil -
          now,

        newViolation:
          false,
      };
    }

    bucket.hits.push(
      now,
    );

    if (
      bucket.hits.length >
      AUTO_MOD_LIMITS
        .commandLimit
    ) {
      bucket.blockedUntil =
        now +
        AUTO_MOD_LIMITS
          .commandBlockMs;

      const newViolation =
        now -
        bucket.lastCaseAt >
        AUTO_MOD_LIMITS
          .commandBlockMs;

      if (
        newViolation
      ) {
        bucket.lastCaseAt =
          now;
      }

      commandBuckets.set(
        key,
        bucket,
      );

      return {
        allowed:
          false,

        retryAfterMs:
          AUTO_MOD_LIMITS
            .commandBlockMs,

        newViolation,
      };
    }

    commandBuckets.set(
      key,
      bucket,
    );

    return {
      allowed:
        true,

      retryAfterMs:
        0,

      newViolation:
        false,
    };
  },

  async recordCommandSpam(
    guildId:
      string,

    userId:
      string,

    channelId:
      string,
  ) {
    return moderationService
      .createCase({
        guildId,

        targetUserId:
          userId,

        moderatorId:
          "NEXORA_AUTOMOD",

        action:
          "automod",

        reason:
          "AutoMod: Bot Command Spam",

        metadata: {
          source:
            "interaction_rate_limit",

          channelId,

          windowMs:
            AUTO_MOD_LIMITS
              .commandWindowMs,

          limit:
            AUTO_MOD_LIMITS
              .commandLimit,

          blockMs:
            AUTO_MOD_LIMITS
              .commandBlockMs,
        },
      });
  },
};
