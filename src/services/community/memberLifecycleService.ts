import {
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type Role,
} from "discord.js";

import {
  AutoRoleRule,
} from "../../models/AutoRoleRule.js";
import {
  MemberDailyActivity,
} from "../../models/MemberDailyActivity.js";
import {
  MemberLifecycle,
} from "../../models/MemberLifecycle.js";
import {
  EntrySecurityConfig,
} from "../../models/EntrySecurityConfig.js";

const BANGKOK_OFFSET_MS =
  7 * 60 * 60 * 1000;

const RULE_CACHE_MS =
  5 * 60 * 1000;

const ACTIVITY_RETENTION_DAYS =
  120;

type RuntimeRule = {
  key: string;
  name: string;
  trigger: string;
  behavior: string;
  stackable: boolean;
  config: Record<string, unknown>;
  role: Role;
};

type RuleCacheEntry = {
  expiresAt: number;
  rules: RuntimeRule[];
};

const defaultRules = [
  {
    key: "member",
    name: "สมาชิก",
    roleName: "สมาชิก",
    trigger: "join",
    behavior: "permanent",
    stackable: true,
    priority: 10,
    config: {
      color: 0x168bff,
    },
  },
  {
    key: "new_member",
    name: "สมาชิกใหม่",
    roleName: "สมาชิกใหม่",
    trigger: "temporary_join",
    behavior: "temporary",
    stackable: true,
    priority: 20,
    config: {
      durationMonths: 1,
      color: 0x00d9ff,
    },
  },
  {
    key: "regular_member",
    name: "สมาชิกประจำ",
    roleName: "สมาชิกประจำ",
    trigger: "message_activity",
    behavior: "dynamic",
    stackable: true,
    priority: 30,
    config: {
      threshold: 5000,
      rollingDays: 30,
      color: 0x8247ff,
    },
  },
] as const;

const ruleCache =
  new Map<string, RuleCacheEntry>();

function normalizeConfig(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function numberConfig(
  config: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value =
    config[key];

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  return fallback;
}

function bangkokShiftedDate(
  date: Date,
): Date {
  return new Date(
    date.getTime() +
      BANGKOK_OFFSET_MS,
  );
}

export function getBangkokDateKey(
  date = new Date(),
): string {
  const shifted =
    bangkokShiftedDate(date);

  const year =
    shifted.getUTCFullYear();

  const month =
    String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      shifted.getUTCDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getBangkokBucketStart(
  date: Date,
): Date {
  const shifted =
    bangkokShiftedDate(date);

  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) - BANGKOK_OFFSET_MS,
  );
}

function getBangkokDateKeyDaysAgo(
  date: Date,
  daysAgo: number,
): string {
  const shifted =
    bangkokShiftedDate(date);

  const target =
    new Date(
      Date.UTC(
        shifted.getUTCFullYear(),
        shifted.getUTCMonth(),
        shifted.getUTCDate() -
          daysAgo,
      ),
    );

  const year =
    target.getUTCFullYear();

  const month =
    String(
      target.getUTCMonth() + 1,
    ).padStart(2, "0");

  const day =
    String(
      target.getUTCDate(),
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function addCalendarMonthsBangkok(
  date: Date,
  months: number,
): Date {
  const shifted =
    bangkokShiftedDate(date);

  const sourceYear =
    shifted.getUTCFullYear();

  const sourceMonth =
    shifted.getUTCMonth();

  const sourceDay =
    shifted.getUTCDate();

  const monthIndex =
    sourceYear * 12 +
    sourceMonth +
    months;

  const targetYear =
    Math.floor(
      monthIndex / 12,
    );

  const targetMonth =
    monthIndex % 12;

  const lastDay =
    new Date(
      Date.UTC(
        targetYear,
        targetMonth + 1,
        0,
      ),
    ).getUTCDate();

  const targetDay =
    Math.min(
      sourceDay,
      lastDay,
    );

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      targetDay,
      shifted.getUTCHours(),
      shifted.getUTCMinutes(),
      shifted.getUTCSeconds(),
      shifted.getUTCMilliseconds(),
    ) - BANGKOK_OFFSET_MS,
  );
}

async function ensureDefaultRules(
  guildId: string,
): Promise<void> {
  for (
    const rule of defaultRules
  ) {
    await AutoRoleRule.updateOne(
      {
        guildId,
        key: rule.key,
      },
      {
        $setOnInsert: {
          guildId,
          ...rule,
          enabled: true,
        },
      },
      {
        upsert: true,
      },
    );
  }
}

async function resolveRole(
  guild: Guild,
  rule: any,
): Promise<Role | null> {
  let role: Role | undefined;

  if (
    typeof rule.roleId ===
      "string" &&
    rule.roleId.length > 0
  ) {
    role =
      guild.roles.cache.get(
        rule.roleId,
      );
  }

  if (!role) {
    role =
      guild.roles.cache.find(
        (candidate) =>
          !candidate.managed &&
          candidate.name ===
            rule.roleName,
      );
  }

  if (!role) {
    const me =
      guild.members.me;

    if (
      !me?.permissions.has(
        PermissionFlagsBits.ManageRoles,
      )
    ) {
      console.error(
        `❌ Member Lifecycle: NEXORA ไม่มี Manage Roles จึงสร้าง role "${rule.roleName}" ไม่ได้`,
      );

      return null;
    }

    const config =
      normalizeConfig(
        rule.config,
      );

    const color =
      numberConfig(
        config,
        "color",
        0x168bff,
      );

    role =
      await guild.roles.create({
        name: rule.roleName,
        color,
        hoist: false,
        mentionable: false,
        reason:
          `NEXORA Member Lifecycle • create ${rule.key}`,
      });

    console.log(
      `🧬 Member Lifecycle created role: ${role.name} (${role.id})`,
    );
  }

  if (
    rule.roleId !==
    role.id
  ) {
    rule.roleId =
      role.id;

    await rule.save();
  }

  if (!role.editable) {
    console.warn(
      `⚠️ Member Lifecycle: role "${role.name}" อยู่สูงกว่า/เท่ากับ role ของบอท จึงแก้ไขไม่ได้`,
    );
  }

  return role;
}

async function getRuntimeRules(
  guild: Guild,
  force = false,
): Promise<RuntimeRule[]> {
  const cached =
    ruleCache.get(
      guild.id,
    );

  if (
    !force &&
    cached &&
    cached.expiresAt >
      Date.now()
  ) {
    return cached.rules;
  }

  await ensureDefaultRules(
    guild.id,
  );

  await guild.roles
    .fetch()
    .catch(
      () => null,
    );

  const documents =
    await AutoRoleRule.find({
      guildId: guild.id,
      enabled: true,
    }).sort({
      priority: 1,
      key: 1,
    });

  const rules:
    RuntimeRule[] = [];

  for (
    const document of documents
  ) {
    const role =
      await resolveRole(
        guild,
        document,
      );

    if (!role) {
      continue;
    }

    rules.push({
      key: String(
        document.key,
      ),
      name: String(
        document.name,
      ),
      trigger: String(
        document.trigger,
      ),
      behavior: String(
        document.behavior,
      ),
      stackable:
        Boolean(
          document.stackable,
        ),
      config:
        normalizeConfig(
          document.config,
        ),
      role,
    });
  }

  ruleCache.set(
    guild.id,
    {
      expiresAt:
        Date.now() +
        RULE_CACHE_MS,
      rules,
    },
  );

  return rules;
}

async function ensureState(
  member: GuildMember,
) {
  const joinedAt =
    member.joinedAt ??
    new Date();

  let state =
    await MemberLifecycle.findOneAndUpdate(
      {
        guildId:
          member.guild.id,
        userId:
          member.id,
      },
      {
        $setOnInsert: {
          guildId:
            member.guild.id,
          userId:
            member.id,
          firstJoinedAt:
            joinedAt,
          currentJoinedAt:
            joinedAt,
          newMemberExpiresAt:
            addCalendarMonthsBangkok(
              joinedAt,
              1,
            ),
          activeRuleKeys: [],
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

  if (!state) {
    throw new Error(
      `Unable to create MemberLifecycle for ${member.id}`,
    );
  }

  let changed = false;

  if (state.leftAt) {
    state.leftAt =
      null;

    changed = true;
  }

  if (
    !state.currentJoinedAt
  ) {
    state.currentJoinedAt =
      joinedAt;

    changed = true;
  }

  if (
    !state.firstJoinedAt
  ) {
    state.firstJoinedAt =
      joinedAt;

    changed = true;
  }

  if (
    !state.newMemberGraduatedAt &&
    !state.newMemberExpiresAt
  ) {
    state.newMemberExpiresAt =
      addCalendarMonthsBangkok(
        new Date(
          state.firstJoinedAt,
        ),
        1,
      );

    changed = true;
  }

  if (changed) {
    await state.save();
  }

  return state;
}

async function securityCleared(
  member: GuildMember,
): Promise<boolean> {
  const config =
    await EntrySecurityConfig.findOne({
      guildId:
        member.guild.id,
    });

  if (
    !config ||
    !config.enabled
  ) {
    return true;
  }

  const verifiedRoleId =
    String(
      config.verifiedRoleId ??
        "",
    );

  const quarantineRoleId =
    String(
      config.quarantineRoleId ??
        "",
    );

  if (
    quarantineRoleId &&
    member.roles.cache.has(
      quarantineRoleId,
    )
  ) {
    return false;
  }

  if (!verifiedRoleId) {
    return false;
  }

  return member.roles.cache.has(
    verifiedRoleId,
  );
}

async function applyRoleState(
  member: GuildMember,
  role: Role,
  shouldHaveRole: boolean,
  reason: string,
): Promise<boolean> {
  const hasRole =
    member.roles.cache.has(
      role.id,
    );

  if (
    shouldHaveRole ===
    hasRole
  ) {
    return hasRole;
  }

  if (!role.editable) {
    console.warn(
      `⚠️ Member Lifecycle: ไม่สามารถแก้ role "${role.name}" ให้ ${member.user.tag} ได้`,
    );

    return hasRole;
  }

  try {
    if (shouldHaveRole) {
      await member.roles.add(
        role,
        reason.slice(
          0,
          500,
        ),
      );

      return true;
    }

    await member.roles.remove(
      role,
      reason.slice(
        0,
        500,
      ),
    );

    return false;
  } catch (error) {
    console.error(
      `❌ Member Lifecycle role update failed • ${member.id} • ${role.name}:`,
      error,
    );

    return member.roles.cache.has(
      role.id,
    );
  }
}

async function getRollingMessageCount(
  guildId: string,
  userId: string,
  rollingDays = 30,
  now = new Date(),
): Promise<number> {
  const safeDays =
    Math.max(
      1,
      Math.floor(
        rollingDays,
      ),
    );

  const startKey =
    getBangkokDateKeyDaysAgo(
      now,
      safeDays - 1,
    );

  const endKey =
    getBangkokDateKey(
      now,
    );

  const results =
    await MemberDailyActivity.aggregate<{
      _id: null;
      total: number;
    }>([
      {
        $match: {
          guildId,
          userId,
          dateKey: {
            $gte:
              startKey,
            $lte:
              endKey,
          },
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum:
              "$messageCount",
          },
        },
      },
    ]);

  return (
    results[0]?.total ??
    0
  );
}

async function recordMessage(
  guildId: string,
  userId: string,
  at = new Date(),
): Promise<void> {
  const dateKey =
    getBangkokDateKey(
      at,
    );

  const bucketStart =
    getBangkokBucketStart(
      at,
    );

  try {
    await MemberDailyActivity.updateOne(
      {
        guildId,
        userId,
        dateKey,
      },
      {
        $inc: {
          messageCount: 1,
        },
        $setOnInsert: {
          bucketStart,
        },
      },
      {
        upsert: true,
      },
    );
  } catch (error) {
    const mongoError =
      error as {
        code?: number;
      };

    if (
      mongoError.code !==
      11000
    ) {
      throw error;
    }

    await MemberDailyActivity.updateOne(
      {
        guildId,
        userId,
        dateKey,
      },
      {
        $inc: {
          messageCount: 1,
        },
      },
    );
  }
}

async function reconcileMember(
  member: GuildMember,
): Promise<void> {
  if (member.user.bot) {
    return;
  }

  const now =
    new Date();

  const rules =
    await getRuntimeRules(
      member.guild,
    );

  const state =
    await ensureState(
      member,
    );

  const cleared =
    await securityCleared(
      member,
    );

  const activeRuleKeys =
    new Set<string>(
      (
        state.activeRuleKeys ??
        []
      ).map(String),
    );

  const activityTotals =
    new Map<
      number,
      number
    >();

  for (
    const rule of rules
  ) {
    let shouldHaveRole =
      false;

    if (cleared) {
      switch (
        rule.trigger
      ) {
        case "join": {
          shouldHaveRole =
            true;

          break;
        }

        case "temporary_join": {
          const months =
            Math.max(
              1,
              Math.floor(
                numberConfig(
                  rule.config,
                  "durationMonths",
                  1,
                ),
              ),
            );

          const computedExpiry =
            addCalendarMonthsBangkok(
              new Date(
                state.firstJoinedAt,
              ),
              months,
            );

          if (
            !state.newMemberGraduatedAt
          ) {
            state.newMemberExpiresAt =
              computedExpiry;

            if (
              now.getTime() >=
              computedExpiry.getTime()
            ) {
              state.newMemberGraduatedAt =
                computedExpiry;

              shouldHaveRole =
                false;
            } else {
              shouldHaveRole =
                true;
            }
          } else {
            shouldHaveRole =
              false;
          }

          break;
        }

        case "message_activity": {
          const threshold =
            Math.max(
              1,
              Math.floor(
                numberConfig(
                  rule.config,
                  "threshold",
                  5000,
                ),
              ),
            );

          const rollingDays =
            Math.max(
              1,
              Math.floor(
                numberConfig(
                  rule.config,
                  "rollingDays",
                  30,
                ),
              ),
            );

          let total =
            activityTotals.get(
              rollingDays,
            );

          if (
            total ===
            undefined
          ) {
            total =
              await getRollingMessageCount(
                member.guild.id,
                member.id,
                rollingDays,
                now,
              );

            activityTotals.set(
              rollingDays,
              total,
            );
          }

          shouldHaveRole =
            total >=
            threshold;

          break;
        }

        default: {
          /*
           * Rule engine รองรับ trigger เพิ่มในอนาคต
           * แต่ trigger ที่ยังไม่มี evaluator
           * จะไม่แก้ role ใด ๆ
           */
          continue;
        }
      }
    }

    const hasRoleAfter =
      await applyRoleState(
        member,
        rule.role,
        shouldHaveRole,
        `NEXORA Member Lifecycle • ${rule.key}`,
      );

    if (hasRoleAfter) {
      activeRuleKeys.add(
        rule.key,
      );
    } else {
      activeRuleKeys.delete(
        rule.key,
      );
    }
  }

  state.activeRuleKeys =
    Array.from(
      activeRuleKeys,
    );

  state.lastReconciledAt =
    now;

  await state.save();
}

async function handleJoin(
  member: GuildMember,
): Promise<void> {
  if (member.user.bot) {
    return;
  }

  const joinedAt =
    member.joinedAt ??
    new Date();

  const existing =
    await MemberLifecycle.findOne({
      guildId:
        member.guild.id,
      userId:
        member.id,
    });

  if (!existing) {
    await MemberLifecycle.create({
      guildId:
        member.guild.id,
      userId:
        member.id,
      firstJoinedAt:
        joinedAt,
      currentJoinedAt:
        joinedAt,
      leftAt: null,
      newMemberExpiresAt:
        addCalendarMonthsBangkok(
          joinedAt,
          1,
        ),
      activeRuleKeys: [],
    });
  } else {
    existing.currentJoinedAt =
      joinedAt;

    existing.leftAt =
      null;

    await existing.save();
  }

  /*
   * หาก Entry Security เปิดอยู่
   * reconcileMember จะยังไม่ให้ role
   * จนกว่าจะมี Verified และไม่มี Quarantine
   */
  await reconcileMember(
    member,
  );
}

async function handleLeave(
  guildId: string,
  userId: string,
): Promise<void> {
  await MemberLifecycle.updateOne(
    {
      guildId,
      userId,
    },
    {
      $set: {
        leftAt:
          new Date(),
        activeRuleKeys:
          [],
      },
    },
  );
}

async function mapConcurrent<T>(
  items: T[],
  concurrency: number,
  handler: (
    value: T,
  ) => Promise<void>,
): Promise<void> {
  if (
    items.length === 0
  ) {
    return;
  }

  let cursor = 0;

  const workerCount =
    Math.min(
      concurrency,
      items.length,
    );

  const workers =
    Array.from(
      {
        length:
          workerCount,
      },
      async () => {
        while (true) {
          const index =
            cursor++;

          if (
            index >=
            items.length
          ) {
            return;
          }

          await handler(
            items[index],
          );
        }
      },
    );

  await Promise.all(
    workers,
  );
}

async function reconcileGuildStartup(
  guild: Guild,
): Promise<void> {
  await getRuntimeRules(
    guild,
    true,
  );

  let members =
    Array.from(
      guild.members.cache.values(),
    );

  try {
    const fetched =
      await guild.members.fetch();

    members =
      Array.from(
        fetched.values(),
      );
  } catch (error) {
    console.warn(
      `⚠️ Member Lifecycle: full member fetch failed for ${guild.name}; ใช้ cache แทน`,
      error,
    );
  }

  const humans =
    members.filter(
      (member) =>
        !member.user.bot,
    );

  let processed = 0;

  await mapConcurrent(
    humans,
    8,
    async (member) => {
      try {
        await reconcileMember(
          member,
        );

        processed += 1;
      } catch (error) {
        console.error(
          `❌ Member Lifecycle startup reconcile failed for ${member.id}:`,
          error,
        );
      }
    },
  );

  console.log(
    `🧬 Member Lifecycle startup reconciliation: ${processed}/${humans.length} members`,
  );
}

async function reconcileDueMembers(
  guild: Guild,
): Promise<void> {
  const now =
    new Date();

  const tracked =
    await MemberLifecycle.find({
      guildId:
        guild.id,
      leftAt: null,
      $or: [
        {
          newMemberGraduatedAt:
            null,
          newMemberExpiresAt: {
            $lte:
              now,
          },
        },
        {
          activeRuleKeys:
            "regular_member",
        },
      ],
    }).select({
      userId: 1,
    });

  await mapConcurrent(
    tracked,
    5,
    async (state) => {
      const member =
        await guild.members
          .fetch(
            String(
              state.userId,
            ),
          )
          .catch(
            () => null,
          );

      if (!member) {
        return;
      }

      await reconcileMember(
        member,
      );
    },
  );
}

async function cleanupOldActivity(): Promise<void> {
  const cutoff =
    new Date(
      Date.now() -
        ACTIVITY_RETENTION_DAYS *
          24 *
          60 *
          60 *
          1000,
    );

  const result =
    await MemberDailyActivity.deleteMany({
      bucketStart: {
        $lt:
          cutoff,
      },
    });

  if (
    result.deletedCount >
    0
  ) {
    console.log(
      `🧹 Member Lifecycle removed ${result.deletedCount} old activity buckets`,
    );
  }
}

export const memberLifecycleService = {
  invalidateRuleCache(
    guildId?: string,
  ): void {
    if (guildId) {
      ruleCache.delete(
        guildId,
      );

      return;
    }

    ruleCache.clear();
  },

  ensureDefaultRules,

  getRuntimeRules,

  getRollingMessageCount,

  recordMessage,

  reconcileMember,

  reconcileGuildStartup,

  reconcileDueMembers,

  cleanupOldActivity,

  handleJoin,

  handleLeave,
};
