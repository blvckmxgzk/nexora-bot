import {
  Schema,
  model,
} from "mongoose";

const guildRecoveryConfigSchema =
  new Schema(
    {
      guildId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      enabled: {
        type: Boolean,
        default: true,
        index: true,
      },

      logChannelId: {
        type: String,
        required: true,
      },

      autoSnapshotHours: {
        type: Number,
        default: 6,
        min: 1,
        max: 168,
      },

      retentionCount: {
        type: Number,
        default: 30,
        min: 5,
        max: 100,
      },

      externalCopies: {
        type: Boolean,
        default: true,
      },

      policyVersion: {
        type: String,
        default: null,
      },

      lastAutoSnapshotAt: {
        type: Date,
        default: null,
      },

      lastSnapshotId: {
        type: String,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const GuildRecoveryConfig =
  model(
    "GuildRecoveryConfig",
    guildRecoveryConfigSchema,
  );
