import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true, index: true },
    logChannelId: { type: String, required: true },
    verificationChannelId: { type: String, required: true },
    verifiedRoleId: { type: String, required: true },
    quarantineRoleId: { type: String, required: true },
    minimumAccountAgeHours: { type: Number, default: 24, min: 0, max: 8760 },
    autoVerifyAccountAgeHours: { type: Number, default: 72, min: 1, max: 8760 },
    raidMode: { type: Boolean, default: false, index: true },
    raidJoinThreshold: { type: Number, default: 64, min: 3, max: 100 },
    raidWindowSeconds: { type: Number, default: 60, min: 10, max: 300 },
    adaptiveRaidEnabled: { type: Boolean, default: true },
    adaptiveRaidMultiplier: { type: Number, default: 6, min: 2, max: 20 },
    adaptiveRaidMinimumJoins: { type: Number, default: 20, min: 5, max: 100 },
    adaptiveBaselineJoinsPerMinute: { type: Number, default: 0, min: 0 },
    adaptiveBaselineSamples: { type: Number, default: 0, min: 0 },
    adaptiveLastBaselineAt: { type: Date, default: null },
    lastRaidTriggeredAt: { type: Date, default: null },
    policyVersion: { type: String, default: "2026.09-entry-security-v1" },
  },
  { timestamps: true, versionKey: false },
);

export const EntrySecurityConfig = model("EntrySecurityConfig", schema);
