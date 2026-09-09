import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
      index: true,
    },
    risk: {
      type: String,
      enum: ["low", "medium", "high", "raid"],
      default: "low",
      index: true,
    },
    accountAgeHours: { type: Number, required: true },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: String, default: null },
    reason: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: true, versionKey: false },
);

schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const EntryVerificationRequest = model("EntryVerificationRequest", schema);
