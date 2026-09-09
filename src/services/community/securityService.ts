import crypto from "node:crypto";

import {
  AuditLogEvent,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildAuditLogsEntry,
} from "discord.js";

import {
  SecurityConfig,
} from "../../models/SecurityConfig.js";

import {
  SecurityIncident,
} from "../../models/SecurityIncident.js";

import {
  autoModService,
} from "./autoModService.js";

import {
  LOCKDOWN_PERMISSION_NAMES,
  NEXORA_SECURITY_POLICY_VERSION,
  SECURITY_THRESHOLDS,
  SECURITY_WINDOW_MS,
} from "../../community/security/securityPolicy.js";

type BurstKey =
  | "channelDelete"
  | "roleDelete"
  | "memberBan"
  | "memberKick"
  | "channelCreate"
  | "roleCreate";

type PermissionState =
  true |
  false |
  null;

type LockdownRow = {
  channelId:
    string;

  permissions:
    Record<
      string,
      PermissionState
    >;
};

type ActionBucket = {
  timestamps:
    number[];
};

const actionBuckets =
  new Map<
    string,
    ActionBucket
  >();

const DANGEROUS_PERMISSION_MASK =
  PermissionFlagsBits.Administrator |
  PermissionFlagsBits.ManageGuild |
  PermissionFlagsBits.ManageRoles |
  PermissionFlagsBits.ManageChannels |
  PermissionFlagsBits.ManageWebhooks |
  PermissionFlagsBits.BanMembers |
  PermissionFlagsBits.KickMembers |
  PermissionFlagsBits.ModerateMembers;

const LOCKDOWN_BITS:
  Record<
    string,
    bigint
  > = {
  SendMessages:
    PermissionFlagsBits.SendMessages,

  AddReactions:
    PermissionFlagsBits.AddReactions,

  CreatePublicThreads:
    PermissionFlagsBits.CreatePublicThreads,

  CreatePrivateThreads:
    PermissionFlagsBits.CreatePrivateThreads,

  SendMessagesInThreads:
    PermissionFlagsBits.SendMessagesInThreads,

  Connect:
    PermissionFlagsBits.Connect,

  Speak:
    PermissionFlagsBits.Speak,
};

function createIncidentId() {
  return (
    "SEC-" +
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase()
  );
}

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

function permissionState(
  overwrite:
    any,

  bit:
    bigint,
): PermissionState {
  if (!overwrite) {
    return null;
  }

  if (
    overwrite.allow.has(
      bit,
    )
  ) {
    return true;
  }

  if (
    overwrite.deny.has(
      bit,
    )
  ) {
    return false;
  }

  return null;
}

function burstCount(
  guildId:
    string,

  executorId:
    string,

  key:
    BurstKey,
) {
  const now =
    Date.now();

  const bucketKey =
    `${guildId}:${executorId}:${key}`;

  const bucket =
    actionBuckets.get(
      bucketKey,
    ) ?? {
      timestamps:
        [],
    };

  bucket.timestamps =
    bucket.timestamps
      .filter(
        (
          value,
        ) =>
          now -
          value <=
          SECURITY_WINDOW_MS,
      );

  bucket.timestamps.push(
    now,
  );

  actionBuckets.set(
    bucketKey,
    bucket,
  );

  return bucket.timestamps
    .length;
}

function changeValue(
  entry:
    GuildAuditLogsEntry,

  key:
    string,
) {
  return entry.changes
    .find(
      (
        change:
          any,
      ) =>
        change.key ===
        key,
    ) as
      | {
          old?:
            unknown;

          new?:
            unknown;
        }
      | undefined;
}

function permissionChange(
  entry:
    GuildAuditLogsEntry,
) {
  const change =
    changeValue(
      entry,
      "permissions",
    );

  if (
    !change ||
    change.old ===
      undefined ||
    change.new ===
      undefined
  ) {
    return null;
  }

  try {
    const oldBits =
      BigInt(
        String(
          change.old,
        ),
      );

    const newBits =
      BigInt(
        String(
          change.new,
        ),
      );

    const added =
      (
        newBits ^
        oldBits
      ) &
      newBits;

    return {
      oldBits,
      newBits,
      addedDangerous:
        (
          added &
          DANGEROUS_PERMISSION_MASK
        ) !==
        0n,
    };
  } catch {
    return null;
  }
}

function addedRoleIds(
  entry:
    GuildAuditLogsEntry,
) {
  const ids:
    string[] =
      [];

  for (
    const change
    of entry.changes as
      any[]
  ) {
    if (
      change.key !==
      "$add" ||
      !Array.isArray(
        change.new,
      )
    ) {
      continue;
    }

    for (
      const role
      of change.new
    ) {
      if (
        role &&
        typeof role.id ===
          "string"
      ) {
        ids.push(
          role.id,
        );
      }
    }
  }

  return unique(
    ids,
  );
}

async function getLogChannel(
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

export const securityService = {
  async getConfig(
    guildId:
      string,
  ) {
    return SecurityConfig
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
        "Security Core ยังไม่ได้ตั้งค่า — ใช้ `/security setup` ก่อน",
      );
    }

    return config;
  },

  async setup(
    guild:
      Guild,

    logChannelId:
      string,
  ) {
    const channel =
      await getLogChannel(
        guild,
        logChannelId,
      );

    if (!channel) {
      throw new Error(
        "Security Log ต้องเป็น Text Channel",
      );
    }

    const me =
      guild.members.me;

    if (!me) {
      throw new Error(
        "ไม่พบ NEXORA Guild Member",
      );
    }

    const required = [
      PermissionFlagsBits
        .ViewAuditLog,

      PermissionFlagsBits
        .ManageChannels,

      PermissionFlagsBits
        .ManageRoles,

      PermissionFlagsBits
        .KickMembers,
    ];

    const missing =
      required.filter(
        (
          permission,
        ) =>
          !me.permissions.has(
            permission,
          ),
      );

    if (
      missing.length >
      0
    ) {
      throw new Error(
        "NEXORA ต้องมี View Audit Log, Manage Channels, Manage Roles และ Kick Members",
      );
    }

    return SecurityConfig
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
              NEXORA_SECURITY_POLICY_VERSION,
          },

          $setOnInsert: {
            trustedUserIds:
              [],

            trustedRoleIds:
              [],

            autoLockdown:
              true,

            autoContain:
              true,

            unauthorizedBotProtection:
              true,

            unauthorizedWebhookProtection:
              true,

            roleEscalationProtection:
              true,

            autoModTamperProtection:
              true,

            lockdownActive:
              false,

            lockdownSnapshot:
              [],
          },
        },
        {
          new:
            true,

          upsert:
            true,
        },
      );
  },

  async isTrusted(
    guild:
      Guild,

    executorId:
      string | null,

    config?:
      any,
  ) {
    if (!executorId) {
      return false;
    }

    if (
      executorId ===
        guild.ownerId ||
      executorId ===
        guild.client
          .user.id
    ) {
      return true;
    }

    const current =
      config ??
      await this.getConfig(
        guild.id,
      );

    if (!current) {
      return false;
    }

    if (
      (
        current.trustedUserIds ??
        []
      ).includes(
        executorId,
      )
    ) {
      return true;
    }

    const member =
      await guild.members
        .fetch(
          executorId,
        )
        .catch(
          () =>
            null,
        );

    if (!member) {
      return false;
    }

    return (
      current.trustedRoleIds ??
      []
    ).some(
      (
        roleId:
          string,
      ) =>
        member.roles.cache
          .has(
            roleId,
          ),
    );
  },

  async setEnabled(
    guildId:
      string,

    enabled:
      boolean,
  ) {
    const config =
      await this.requireConfig(
        guildId,
      );

    config.enabled =
      enabled;

    await config.save();

    return config;
  },

  async setTrustedUser(
    guildId:
      string,

    userId:
      string,

    add:
      boolean,
  ) {
    const config =
      await this.requireConfig(
        guildId,
      );

    const values =
      new Set(
        config.trustedUserIds ??
        [],
      );

    if (add) {
      values.add(
        userId,
      );
    } else {
      values.delete(
        userId,
      );
    }

    config.trustedUserIds =
      [
        ...values,
      ].slice(
        0,
        50,
      );

    await config.save();

    return config;
  },

  async setTrustedRole(
    guildId:
      string,

    roleId:
      string,

    add:
      boolean,
  ) {
    const config =
      await this.requireConfig(
        guildId,
      );

    const values =
      new Set(
        config.trustedRoleIds ??
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

    config.trustedRoleIds =
      [
        ...values,
      ].slice(
        0,
        30,
      );

    await config.save();

    return config;
  },

  async createIncident(
    data: {
      guildId:
        string;

      type:
        string;

      severity:
        "medium" |
        "high" |
        "critical";

      executorId?:
        string |
        null;

      targetId?:
        string |
        null;

      auditLogEntryId?:
        string |
        null;

      action:
        string;

      description:
        string;

      metadata?:
        Record<
          string,
          unknown
        >;
    },
  ) {
    return SecurityIncident
      .create({
        incidentId:
          createIncidentId(),

        guildId:
          data.guildId,

        type:
          data.type,

        severity:
          data.severity,

        executorId:
          data.executorId ??
          null,

        targetId:
          data.targetId ??
          null,

        auditLogEntryId:
          data.auditLogEntryId ??
          null,

        action:
          data.action,

        description:
          data.description,

        status:
          "open",

        metadata:
          data.metadata ??
          {},
      });
  },

  async sendIncidentLog(
    guild:
      Guild,

    incident:
      any,
  ) {
    const config =
      await this.getConfig(
        guild.id,
      );

    if (!config) {
      return;
    }

    const channel =
      await getLogChannel(
        guild,
        config.logChannelId,
      );

    if (!channel) {
      return;
    }

    const color =
      incident.severity ===
        "critical"
        ? 0xed4245
        : incident.severity ===
            "high"
          ? 0xfee75c
          : 0x5865f2;

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(
            color,
          )
          .setTitle(
            `🚨 Security Incident • ${incident.severity.toUpperCase()}`,
          )
          .setDescription(
            incident.description,
          )
          .addFields(
            {
              name:
                "Incident",

              value:
                `\`${incident.incidentId}\``,

              inline:
                true,
            },

            {
              name:
                "Type",

              value:
                `\`${incident.type}\``,

              inline:
                true,
            },

            {
              name:
                "Executor",

              value:
                incident.executorId
                  ? `<@${incident.executorId}>`
                  : "Unknown",

              inline:
                true,
            },

            {
              name:
                "Target",

              value:
                incident.targetId
                  ? `\`${incident.targetId}\``
                  : "-",

              inline:
                true,
            },

            {
              name:
                "Action",

              value:
                incident.action,

              inline:
                true,
            },
          )
          .setFooter({
            text:
              "NEXORA • Security Core",
          })
          .setTimestamp(),
      ],
    });
  },

  async containExecutor(
    guild:
      Guild,

    executorId:
      string,

    incident:
      any,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    if (
      !config.autoContain ||
      await this.isTrusted(
        guild,
        executorId,
        config,
      )
    ) {
      return [];
    }

    const member =
      await guild.members
        .fetch(
          executorId,
        )
        .catch(
          () =>
            null,
        );

    if (
      !member ||
      member.id ===
        guild.ownerId
    ) {
      return [];
    }

    const removable =
      member.roles.cache
        .filter(
          (
            role,
          ) =>
            role.id !==
              guild.id &&
            !role.managed &&
            role.editable &&
            role.permissions
              .any(
                DANGEROUS_PERMISSION_MASK,
              ),
        );

    const removed:
      string[] =
        [];

    for (
      const role
      of removable.values()
    ) {
      try {
        await member.roles
          .remove(
            role.id,
            `NEXORA Security containment • ${incident.incidentId}`,
          );

        removed.push(
          role.id,
        );
      } catch (error) {
        console.error(
          `⚠️ Failed to remove dangerous role ${role.id}:`,
          error,
        );
      }
    }

    if (
      removed.length >
      0
    ) {
      incident.metadata = {
        ...(
          incident.metadata ??
          {}
        ),

        removedRoleIds:
          removed,

        containedAt:
          new Date()
            .toISOString(),
      };

      await incident.save();
    }

    return removed;
  },

  async restoreContainedRoles(
    guild:
      Guild,

    incidentId:
      string,

    actorId:
      string,
  ) {
    const incident =
      await SecurityIncident
        .findOne({
          guildId:
            guild.id,

          incidentId,
        });

    if (!incident) {
      throw new Error(
        "ไม่พบ Security Incident",
      );
    }

    if (
      !incident.executorId
    ) {
      throw new Error(
        "Incident นี้ไม่มี Executor",
      );
    }

    const metadata =
      incident.metadata as
        any;

    const roleIds =
      Array.isArray(
        metadata
          ?.removedRoleIds,
      )
        ? metadata
            .removedRoleIds
        : [];

    if (
      roleIds.length ===
      0
    ) {
      throw new Error(
        "Incident นี้ไม่มี Role ที่ถูกถอดโดย Security Core",
      );
    }

    const member =
      await guild.members
        .fetch(
          incident.executorId,
        )
        .catch(
          () =>
            null,
        );

    if (!member) {
      throw new Error(
        "สมาชิกไม่ได้อยู่ในเซิร์ฟเวอร์แล้ว",
      );
    }

    const restored:
      string[] =
        [];

    for (
      const roleId
      of roleIds
    ) {
      const role =
        await guild.roles
          .fetch(
            roleId,
          )
          .catch(
            () =>
              null,
          );

      if (
        !role ||
        !role.editable
      ) {
        continue;
      }

      try {
        await member.roles
          .add(
            role.id,
            `Security restore by ${actorId} • ${incidentId}`,
          );

        restored.push(
          role.id,
        );
      } catch {
        // Continue.
      }
    }

    incident.status =
      "resolved";

    incident.resolvedAt =
      new Date();

    incident.resolvedBy =
      actorId;

    incident.resolution =
      `Restored ${restored.length} contained role(s)`;

    await incident.save();

    return {
      incident,
      restored,
    };
  },

  async engageLockdown(
    guild:
      Guild,

    reason:
      string,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    if (
      config.lockdownActive
    ) {
      return {
        config,
        changed:
          0,
      };
    }

    const snapshot:
      LockdownRow[] =
        [];

    let changed =
      0;

    for (
      const channel
      of guild.channels
        .cache
        .values()
    ) {
      if (
        !(
          "permissionOverwrites" in
          channel
        )
      ) {
        continue;
      }

      const overwrite =
        channel
          .permissionOverwrites
          .cache
          .get(
            guild.roles
              .everyone.id,
          );

      const permissions:
        Record<
          string,
          PermissionState
        > = {};

      for (
        const name
        of LOCKDOWN_PERMISSION_NAMES
      ) {
        permissions[
          name
        ] =
          permissionState(
            overwrite,
            LOCKDOWN_BITS[
              name
            ],
          );
      }

      snapshot.push({
        channelId:
          channel.id,

        permissions,
      });

      try {
        await channel
          .permissionOverwrites
          .edit(
            guild.roles
              .everyone.id,
            {
              SendMessages:
                false,

              AddReactions:
                false,

              CreatePublicThreads:
                false,

              CreatePrivateThreads:
                false,

              SendMessagesInThreads:
                false,

              Connect:
                false,

              Speak:
                false,
            },
            {
              reason:
                `NEXORA Security Lockdown • ${reason}`.slice(
                  0,
                  500,
                ),
            },
          );

        changed +=
          1;
      } catch (error) {
        console.error(
          `⚠️ Lockdown failed for channel ${channel.id}:`,
          error,
        );
      }
    }

    config.lockdownActive =
      true;

    config.lockdownReason =
      reason.slice(
        0,
        1000,
      );

    config.lockdownStartedAt =
      new Date();

    config.lockdownActorId =
      actorId;

    config.lockdownSnapshot =
      snapshot;

    await config.save();

    return {
      config,
      changed,
    };
  },

  async releaseLockdown(
    guild:
      Guild,

    actorId:
      string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    if (
      !config.lockdownActive
    ) {
      return {
        config,
        restored:
          0,
      };
    }

    const snapshot =
      Array.isArray(
        config.lockdownSnapshot,
      )
        ? (
            config.lockdownSnapshot as
              LockdownRow[]
          )
        : [];

    let restored =
      0;

    for (
      const row
      of snapshot
    ) {
      const channel =
        await guild.channels
          .fetch(
            row.channelId,
          )
          .catch(
            () =>
              null,
          );

      if (
        !channel ||
        !(
          "permissionOverwrites" in
          channel
        )
      ) {
        continue;
      }

      const restore:
        Record<
          string,
          boolean |
          null
        > = {};

      for (
        const name
        of LOCKDOWN_PERMISSION_NAMES
      ) {
        restore[
          name
        ] =
          row.permissions[
            name
          ] ??
          null;
      }

      try {
        await channel
          .permissionOverwrites
          .edit(
            guild.roles
              .everyone.id,
            restore,
            {
              reason:
                `NEXORA Security unlock by ${actorId}`,
            },
          );

        restored +=
          1;
      } catch (error) {
        console.error(
          `⚠️ Unlock restore failed for channel ${row.channelId}:`,
          error,
        );
      }
    }

    config.lockdownActive =
      false;

    config.lockdownReason =
      null;

    config.lockdownStartedAt =
      null;

    config.lockdownActorId =
      null;

    config.lockdownSnapshot =
      [];

    await config.save();

    return {
      config,
      restored,
    };
  },

  async emergencyResponse(
    guild:
      Guild,

    incident:
      any,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    if (
      incident.executorId
    ) {
      await this.containExecutor(
        guild,
        incident.executorId,
        incident,
      );
    }

    if (
      config.autoLockdown
    ) {
      await this.engageLockdown(
        guild,
        `${incident.type} • ${incident.incidentId}`,
        guild.client
          .user.id,
      );
    }

    await this.sendIncidentLog(
      guild,
      incident,
    );
  },

  async deleteUnauthorizedBot(
    guild:
      Guild,

    targetId:
      string | null,

    incidentId:
      string,
  ) {
    if (!targetId) {
      return false;
    }

    const member =
      await guild.members
        .fetch(
          targetId,
        )
        .catch(
          () =>
            null,
        );

    if (
      !member ||
      !member.user.bot ||
      !member.kickable
    ) {
      return false;
    }

    await member.kick(
      `Unauthorized bot addition • ${incidentId}`,
    );

    return true;
  },

  async deleteUnauthorizedWebhook(
    guild:
      Guild,

    targetId:
      string | null,

    incidentId:
      string,
  ) {
    if (!targetId) {
      return false;
    }

    try {
      const webhooks =
        await guild
          .fetchWebhooks();

      const webhook =
        webhooks.get(
          targetId,
        );

      if (!webhook) {
        return false;
      }

      await webhook.delete(
        `Unauthorized webhook creation • ${incidentId}`,
      );

      return true;
    } catch {
      return false;
    }
  },

  async revertDangerousRolePermission(
    guild:
      Guild,

    targetId:
      string | null,

    oldBits:
      bigint,

    incidentId:
      string,
  ) {
    if (!targetId) {
      return false;
    }

    const role =
      await guild.roles
        .fetch(
          targetId,
        )
        .catch(
          () =>
            null,
        );

    if (
      !role ||
      !role.editable
    ) {
      return false;
    }

    await role.setPermissions(
      oldBits,
      `Dangerous permission escalation reverted • ${incidentId}`,
    );

    return true;
  },

  async removeDangerousAddedRoles(
    guild:
      Guild,

    memberId:
      string | null,

    roleIds:
      string[],

    incidentId:
      string,
  ) {
    if (!memberId) {
      return [];
    }

    const member =
      await guild.members
        .fetch(
          memberId,
        )
        .catch(
          () =>
            null,
        );

    if (!member) {
      return [];
    }

    const removed:
      string[] =
        [];

    for (
      const roleId
      of roleIds
    ) {
      const role =
        await guild.roles
          .fetch(
            roleId,
          )
          .catch(
            () =>
              null,
          );

      if (
        !role ||
        !role.permissions
          .any(
            DANGEROUS_PERMISSION_MASK,
          ) ||
        !role.editable
      ) {
        continue;
      }

      try {
        await member.roles
          .remove(
            role.id,
            `Unauthorized dangerous role grant • ${incidentId}`,
          );

        removed.push(
          role.id,
        );
      } catch {
        // Continue.
      }
    }

    return removed;
  },

  async handleAuditLogEntry(
    entry:
      GuildAuditLogsEntry,

    guild:
      Guild,
  ) {
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

    const executorId =
      entry.executorId ??
      null;

    if (
      await this.isTrusted(
        guild,
        executorId,
        config,
      )
    ) {
      return;
    }

    let type:
      string |
      null =
        null;

    let severity:
      "medium" |
      "high" |
      "critical" =
        "high";

    let description =
      "";

    let triggered =
      false;

    let metadata:
      Record<
        string,
        unknown
      > = {
      auditAction:
        entry.action,

      reason:
        entry.reason ??
        null,
    };

    if (
      entry.action ===
      AuditLogEvent.BotAdd &&
      config.unauthorizedBotProtection
    ) {
      type =
        "unauthorized_bot_add";

      severity =
        "critical";

      description =
        "มีการเพิ่ม Bot เข้าเซิร์ฟเวอร์โดย Executor ที่ไม่ได้อยู่ใน Trusted List";

      triggered =
        true;
    } else if (
      entry.action ===
      AuditLogEvent.WebhookCreate &&
      config.unauthorizedWebhookProtection
    ) {
      type =
        "unauthorized_webhook_create";

      severity =
        "critical";

      description =
        "มีการสร้าง Webhook โดย Executor ที่ไม่ได้รับความไว้วางใจ";

      triggered =
        true;
    } else if (
      entry.action ===
      AuditLogEvent.RoleUpdate &&
      config.roleEscalationProtection
    ) {
      const change =
        permissionChange(
          entry,
        );

      if (
        change
          ?.addedDangerous
      ) {
        type =
          "dangerous_role_permission_grant";

        severity =
          "critical";

        description =
          "ตรวจพบการเพิ่ม Permission ระดับอันตรายให้ Role โดย Executor ที่ไม่ได้รับความไว้วางใจ";

        triggered =
          true;

        metadata = {
          ...metadata,

          oldPermissions:
            change.oldBits
              .toString(),

          newPermissions:
            change.newBits
              .toString(),
        };
      }
    } else if (
      entry.action ===
      AuditLogEvent.MemberRoleUpdate &&
      config.roleEscalationProtection
    ) {
      const roleIds =
        addedRoleIds(
          entry,
        );

      const dangerous:
        string[] =
          [];

      for (
        const roleId
        of roleIds
      ) {
        const role =
          await guild.roles
            .fetch(
              roleId,
            )
            .catch(
              () =>
                null,
            );

        if (
          role?.permissions
            .any(
              DANGEROUS_PERMISSION_MASK,
            )
        ) {
          dangerous.push(
            roleId,
          );
        }
      }

      if (
        dangerous.length >
        0
      ) {
        type =
          "dangerous_member_role_grant";

        severity =
          "critical";

        description =
          "ตรวจพบการมอบ Role ที่มี Permission ระดับอันตรายโดย Executor ที่ไม่ได้รับความไว้วางใจ";

        triggered =
          true;

        metadata = {
          ...metadata,

          dangerousRoleIds:
            dangerous,
        };
      }
    } else if (
      (
        entry.action ===
          AuditLogEvent.AutoModerationRuleCreate ||
        entry.action ===
          AuditLogEvent.AutoModerationRuleUpdate ||
        entry.action ===
          AuditLogEvent.AutoModerationRuleDelete
      ) &&
      config.autoModTamperProtection
    ) {
      type =
        "automod_tamper";

      severity =
        "critical";

      description =
        "ตรวจพบการแก้ไข Discord AutoMod โดย Executor ที่ไม่ได้รับความไว้วางใจ";

      triggered =
        true;
    } else {
      let burstKey:
        BurstKey |
        null =
          null;

      let threshold =
        0;

      if (
        entry.action ===
        AuditLogEvent.ChannelDelete
      ) {
        type =
          "channel_delete_burst";

        burstKey =
          "channelDelete";

        threshold =
          SECURITY_THRESHOLDS
            .channelDelete;

        description =
          "ตรวจพบการลบ Channel หลายห้องในช่วงเวลาสั้น";
      } else if (
        entry.action ===
        AuditLogEvent.RoleDelete
      ) {
        type =
          "role_delete_burst";

        burstKey =
          "roleDelete";

        threshold =
          SECURITY_THRESHOLDS
            .roleDelete;

        description =
          "ตรวจพบการลบ Role หลาย Role ในช่วงเวลาสั้น";
      } else if (
        entry.action ===
        AuditLogEvent.MemberBanAdd
      ) {
        type =
          "mass_ban";

        burstKey =
          "memberBan";

        threshold =
          SECURITY_THRESHOLDS
            .memberBan;

        description =
          "ตรวจพบการ Ban สมาชิกหลายคนในช่วงเวลาสั้น";
      } else if (
        entry.action ===
        AuditLogEvent.MemberKick
      ) {
        type =
          "mass_kick";

        burstKey =
          "memberKick";

        threshold =
          SECURITY_THRESHOLDS
            .memberKick;

        description =
          "ตรวจพบการ Kick สมาชิกหลายคนในช่วงเวลาสั้น";
      } else if (
        entry.action ===
        AuditLogEvent.ChannelCreate
      ) {
        type =
          "channel_create_burst";

        burstKey =
          "channelCreate";

        threshold =
          SECURITY_THRESHOLDS
            .channelCreate;

        description =
          "ตรวจพบการสร้าง Channel จำนวนมากผิดปกติ";
      } else if (
        entry.action ===
        AuditLogEvent.RoleCreate
      ) {
        type =
          "role_create_burst";

        burstKey =
          "roleCreate";

        threshold =
          SECURITY_THRESHOLDS
            .roleCreate;

        description =
          "ตรวจพบการสร้าง Role จำนวนมากผิดปกติ";
      }

      if (
        burstKey &&
        executorId
      ) {
        const count =
          burstCount(
            guild.id,
            executorId,
            burstKey,
          );

        metadata = {
          ...metadata,

          burstCount:
            count,

          threshold,

          windowMs:
            SECURITY_WINDOW_MS,
        };

        triggered =
          count >=
          threshold;
      }
    }

    if (
      !type ||
      !triggered
    ) {
      return;
    }

    const incident =
      await this.createIncident({
        guildId:
          guild.id,

        type,

        severity,

        executorId,

        targetId:
          entry.targetId ??
          null,

        auditLogEntryId:
          entry.id,

        action:
          "automatic_containment",

        description,

        metadata,
      });

    if (
      type ===
      "unauthorized_bot_add"
    ) {
      const removed =
        await this
          .deleteUnauthorizedBot(
            guild,
            entry.targetId ??
              null,
            incident.incidentId,
          );

      incident.metadata = {
        ...(
          incident.metadata ??
          {}
        ),

        unauthorizedBotRemoved:
          removed,
      };

      await incident.save();
    }

    if (
      type ===
      "unauthorized_webhook_create"
    ) {
      const removed =
        await this
          .deleteUnauthorizedWebhook(
            guild,
            entry.targetId ??
              null,
            incident.incidentId,
          );

      incident.metadata = {
        ...(
          incident.metadata ??
          {}
        ),

        unauthorizedWebhookRemoved:
          removed,
      };

      await incident.save();
    }

    if (
      type ===
      "dangerous_role_permission_grant"
    ) {
      const change =
        permissionChange(
          entry,
        );

      if (change) {
        const reverted =
          await this
            .revertDangerousRolePermission(
              guild,
              entry.targetId ??
                null,
              change.oldBits,
              incident.incidentId,
            );

        incident.metadata = {
          ...(
            incident.metadata ??
            {}
          ),

          permissionChangeReverted:
            reverted,
        };

        await incident.save();
      }
    }

    if (
      type ===
      "dangerous_member_role_grant"
    ) {
      const incidentMetadata =
        incident.metadata as
          any;

      const dangerous =
        incidentMetadata
          ?.dangerousRoleIds ??
        [];

      const removed =
        await this
          .removeDangerousAddedRoles(
            guild,
            entry.targetId ??
              null,
            dangerous,
            incident.incidentId,
          );

      incident.metadata = {
        ...(
          incident.metadata ??
          {}
        ),

        dangerousRolesRemovedFromTarget:
          removed,
      };

      await incident.save();
    }

    if (
      type ===
      "automod_tamper"
    ) {
      try {
        await autoModService
          .sync(
            guild,
            guild.client
              .user.id,
          );

        incident.metadata = {
          ...(
            incident.metadata ??
            {}
          ),

          autoModResynced:
            true,
        };

        await incident.save();
      } catch (error) {
        console.error(
          "⚠️ Failed to resync AutoMod after tamper:",
          error,
        );
      }
    }

    await this.emergencyResponse(
      guild,
      incident,
    );
  },

  async recentIncidents(
    guildId:
      string,

    limit =
      10,
  ) {
    return SecurityIncident
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
};
