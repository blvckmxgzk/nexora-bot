export const NEXORA_AUTOMOD_POLICY_VERSION =
  "2026.09-community-rules-v1";

export const NEXORA_AUTOMOD_PREFIX =
  "NEXORA • ";

export const AUTO_MOD_RULE_NAMES = {
  spam:
    `${NEXORA_AUTOMOD_PREFIX}Spam`,

  mentionSpam:
    `${NEXORA_AUTOMOD_PREFIX}Mention Spam`,

  unsafeContent:
    `${NEXORA_AUTOMOD_PREFIX}Unsafe Content`,

  invites:
    `${NEXORA_AUTOMOD_PREFIX}Advertising / Invites`,

  security:
    `${NEXORA_AUTOMOD_PREFIX}Security / Phishing`,

  custom:
    `${NEXORA_AUTOMOD_PREFIX}Custom Keywords`,
} as const;

export type AutoModRuleKey =
  keyof typeof AUTO_MOD_RULE_NAMES;

export const AUTO_MOD_RULE_LABELS:
  Record<
    AutoModRuleKey,
    string
  > = {
  spam:
    "Spam / Flood",

  mentionSpam:
    "Mention Spam",

  unsafeContent:
    "Unsafe / Sexual / Slur Content",

  invites:
    "Unauthorized Advertising / Invite",

  security:
    "Phishing / Credential Theft / Malware",

  custom:
    "Custom Blocked Keyword",
};

export const DEFAULT_INVITE_KEYWORDS = [
  "*discord.gg/*",
  "*discord.com/invite/*",
  "*discordapp.com/invite/*",
] as const;

export const DEFAULT_SECURITY_KEYWORDS = [
  "*token stealer*",
  "*token grabber*",
  "*cookie stealer*",
  "*session stealer*",
  "*password stealer*",
  "*credential stealer*",
  "*steal token*",
  "*steal cookie*",
  "*nitro generator*",
  "*free nitro generator*",
  "*grabify.link*",
  "*ขโมย token*",
  "*ขโมยรหัสผ่าน*",
  "*ขอ otp ของคุณ*",
  "*ส่ง otp ให้*",
  "*ส่งรหัสผ่านให้*",
] as const;

export const AUTO_MOD_LIMITS = {
  mentionTotal:
    5,

  recentWindowMs:
    10 * 60 * 1000,

  recentViolationsForTimeout:
    3,

  dayWindowMs:
    24 * 60 * 60 * 1000,

  dayViolationsForTimeout:
    5,

  repeatTimeoutMinutes:
    10,

  dayTimeoutMinutes:
    60,

  severeTimeoutMinutes:
    60,

  commandWindowMs:
    10 * 1000,

  commandLimit:
    6,

  commandBlockMs:
    30 * 1000,
} as const;

export const RULES_AUTOMOD_MAPPING = [
  {
    rules:
      [2, 3, 7, 22],

    feature:
      "Security / Phishing",

    automatic:
      true,
  },
  {
    rules:
      [2],

    feature:
      "Unsafe Content Preset",

    automatic:
      true,
  },
  {
    rules:
      [4],

    feature:
      "Spam / Flood / Mention Spam",

    automatic:
      true,
  },
  {
    rules:
      [5],

    feature:
      "Discord Invite Advertising",

    automatic:
      true,
  },
  {
    rules:
      [19],

    feature:
      "Bot Command Rate Limit",

    automatic:
      true,
  },
  {
    rules:
      [
        1, 3, 6, 8, 9, 10, 11, 12,
        13, 14, 15, 16, 17, 18,
        20, 21, 23, 24,
      ],

    feature:
      "Context / Evidence Review",

    automatic:
      false,
  },
] as const;
