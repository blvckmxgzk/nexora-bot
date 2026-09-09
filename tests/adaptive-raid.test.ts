import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateAdaptiveThreshold,
} from "../src/services/community/adaptiveRaidService.ts";

describe(
  "NEXORA Adaptive Raid Detection",
  () => {
    it(
      "uses the minimum threshold on low baseline traffic",
      () => {
        expect(
          calculateAdaptiveThreshold(
            1,
            6,
            20,
            64,
            60,
          ),
        ).toBe(20);
      },
    );

    it(
      "scales with normal server growth",
      () => {
        expect(
          calculateAdaptiveThreshold(5, 6, 20, 64, 60),
        ).toBe(30);

        expect(
          calculateAdaptiveThreshold(10, 6, 20, 64, 60),
        ).toBe(60);
      },
    );

    it(
      "never raises the adaptive trigger above hard 64/60",
      () => {
        expect(
          calculateAdaptiveThreshold(100, 6, 20, 64, 60),
        ).toBe(64);
      },
    );

    it(
      "normalizes a non-60-second hard window",
      () => {
        expect(
          calculateAdaptiveThreshold(20, 6, 20, 64, 120),
        ).toBe(32);
      },
    );
  },
);
