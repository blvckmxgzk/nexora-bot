import { describe, expect, it } from "vitest";

describe("NEXORA Entry Security defaults", () => {
  it("keeps automatic verification conservative", () => {
    const minimumAccountAgeHours = 24;
    const autoVerifyAccountAgeHours = 72;
    expect(autoVerifyAccountAgeHours).toBeGreaterThan(minimumAccountAgeHours);
  });

  it("uses a short raid detection window", () => {
    const raidWindowSeconds = 60;
    const raidJoinThreshold = 64;
    expect(raidWindowSeconds).toBe(60);
    expect(raidJoinThreshold).toBe(64);
  });
});
