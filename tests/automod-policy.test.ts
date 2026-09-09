import {
  describe,
  expect,
  it,
} from "vitest";

import {
  AUTO_MOD_LIMITS,
  AUTO_MOD_RULE_NAMES,
  DEFAULT_INVITE_KEYWORDS,
  DEFAULT_SECURITY_KEYWORDS,
  NEXORA_AUTOMOD_POLICY_VERSION,
  RULES_AUTOMOD_MAPPING,
} from "../src/community/automod/autoModPolicy.ts";

describe(
  "NEXORA AutoMod policy",
  () => {
    it(
      "has a pinned community rules version",
      () => {
        expect(
          NEXORA_AUTOMOD_POLICY_VERSION,
        ).toMatch(
          /^2026\.09-/,
        );
      },
    );

    it(
      "uses unique managed rule names",
      () => {
        const names =
          Object.values(
            AUTO_MOD_RULE_NAMES,
          );

        expect(
          new Set(
            names,
          ).size,
        ).toBe(
          names.length,
        );
      },
    );

    it(
      "protects against invite spam and high-confidence security phrases",
      () => {
        expect(
          DEFAULT_INVITE_KEYWORDS
            .length,
        ).toBeGreaterThan(
          0,
        );

        expect(
          DEFAULT_SECURITY_KEYWORDS
            .length,
        ).toBeGreaterThan(
          5,
        );
      },
    );

    it(
      "uses progressive punishment instead of auto-ban",
      () => {
        expect(
          AUTO_MOD_LIMITS
            .recentViolationsForTimeout,
        ).toBeGreaterThan(
          1,
        );

        expect(
          AUTO_MOD_LIMITS
            .dayTimeoutMinutes,
        ).toBeGreaterThan(
          AUTO_MOD_LIMITS
            .repeatTimeoutMinutes,
        );
      },
    );

    it(
      "explicitly separates automatic and contextual rules",
      () => {
        expect(
          RULES_AUTOMOD_MAPPING.some(
            (
              entry,
            ) =>
              entry.automatic,
          ),
        ).toBe(
          true,
        );

        expect(
          RULES_AUTOMOD_MAPPING.some(
            (
              entry,
            ) =>
              !entry.automatic,
          ),
        ).toBe(
          true,
        );
      },
    );
  },
);
