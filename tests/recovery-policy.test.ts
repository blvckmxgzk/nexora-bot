import {
  describe,
  expect,
  it,
} from "vitest";

import {
  NEXORA_RECOVERY_POLICY_VERSION,
  NEXORA_RECOVERY_SCHEMA_VERSION,
  RECOVERY_DEFAULTS,
} from "../src/community/recovery/recoveryPolicy.ts";

describe(
  "NEXORA Disaster Recovery policy",
  () => {
    it(
      "uses a versioned recovery schema",
      () => {
        expect(
          NEXORA_RECOVERY_SCHEMA_VERSION,
        ).toBe(
          1,
        );

        expect(
          NEXORA_RECOVERY_POLICY_VERSION,
        ).toMatch(
          /^2026\.09-/,
        );
      },
    );

    it(
      "keeps frequent rolling backups",
      () => {
        expect(
          RECOVERY_DEFAULTS
            .autoSnapshotHours,
        ).toBeLessThanOrEqual(
          6,
        );

        expect(
          RECOVERY_DEFAULTS
            .retentionCount,
        ).toBeGreaterThanOrEqual(
          30,
        );
      },
    );

    it(
      "enables off-database copies by default",
      () => {
        expect(
          RECOVERY_DEFAULTS
            .externalCopies,
        ).toBe(
          true,
        );
      },
    );
  },
);
