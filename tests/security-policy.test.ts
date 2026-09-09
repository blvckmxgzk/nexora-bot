import {
  describe,
  expect,
  it,
} from "vitest";

import {
  LOCKDOWN_PERMISSION_NAMES,
  NEXORA_SECURITY_POLICY_VERSION,
  SECURITY_IMMEDIATE_ACTIONS,
  SECURITY_THRESHOLDS,
  SECURITY_WINDOW_MS,
} from "../src/community/security/securityPolicy.ts";

describe(
  "NEXORA Security Core policy",
  () => {
    it(
      "uses a pinned policy version",
      () => {
        expect(
          NEXORA_SECURITY_POLICY_VERSION,
        ).toMatch(
          /^2026\.09-/,
        );
      },
    );

    it(
      "uses a short anti-nuke window",
      () => {
        expect(
          SECURITY_WINDOW_MS,
        ).toBeLessThanOrEqual(
          30_000,
        );
      },
    );

    it(
      "locks down quickly on destructive bursts",
      () => {
        expect(
          SECURITY_THRESHOLDS
            .channelDelete,
        ).toBeLessThanOrEqual(
          3,
        );

        expect(
          SECURITY_THRESHOLDS
            .roleDelete,
        ).toBeLessThanOrEqual(
          3,
        );

        expect(
          SECURITY_THRESHOLDS
            .memberBan,
        ).toBeLessThanOrEqual(
          5,
        );
      },
    );

    it(
      "contains high-confidence threats immediately",
      () => {
        expect(
          SECURITY_IMMEDIATE_ACTIONS,
        ).toContain(
          "unauthorized_bot_add",
        );

        expect(
          SECURITY_IMMEDIATE_ACTIONS,
        ).toContain(
          "dangerous_role_permission_grant",
        );

        expect(
          SECURITY_IMMEDIATE_ACTIONS,
        ).toContain(
          "automod_tamper",
        );
      },
    );

    it(
      "lockdown covers chat, threads, reactions and voice",
      () => {
        expect(
          LOCKDOWN_PERMISSION_NAMES,
        ).toContain(
          "SendMessages",
        );

        expect(
          LOCKDOWN_PERMISSION_NAMES,
        ).toContain(
          "Connect",
        );

        expect(
          LOCKDOWN_PERMISSION_NAMES,
        ).toContain(
          "CreatePublicThreads",
        );
      },
    );
  },
);
