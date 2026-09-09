export const NEXORA_RECOVERY_SCHEMA_VERSION =
  1;

export const NEXORA_RECOVERY_POLICY_VERSION =
  "2026.09-disaster-recovery-v1";

export const RECOVERY_DEFAULTS = {
  autoSnapshotHours:
    6,

  retentionCount:
    30,

  externalCopies:
    true,

  maxListResults:
    15,
} as const;

export type RecoveryMode =
  | "missing"
  | "permissions"
  | "repair";
