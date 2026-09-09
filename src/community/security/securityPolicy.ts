export const NEXORA_SECURITY_POLICY_VERSION =
  "2026.09-security-core-v1";

export const SECURITY_WINDOW_MS =
  15_000;

export const SECURITY_THRESHOLDS = {
  channelDelete: 2,
  roleDelete: 2,
  memberBan: 3,
  memberKick: 3,
  channelCreate: 6,
  roleCreate: 6,
} as const;

export const SECURITY_IMMEDIATE_ACTIONS = [
  "unauthorized_bot_add",
  "unauthorized_webhook_create",
  "dangerous_role_permission_grant",
  "dangerous_member_role_grant",
  "automod_tamper",
] as const;

export const LOCKDOWN_PERMISSION_NAMES = [
  "SendMessages",
  "AddReactions",
  "CreatePublicThreads",
  "CreatePrivateThreads",
  "SendMessagesInThreads",
  "Connect",
  "Speak",
] as const;
