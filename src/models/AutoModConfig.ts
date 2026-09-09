import {
  Schema,
  model,
} from "mongoose";

const autoModConfigSchema =
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

      promoChannelIds: {
        type: [String],
        default: [],
      },

      exemptRoleIds: {
        type: [String],
        default: [],
      },

      exemptChannelIds: {
        type: [String],
        default: [],
      },

      customKeywords: {
        type: [String],
        default: [],
      },

      discordRuleIds: {
        type:
          Schema.Types.Mixed,
        default: {},
      },

      policyVersion: {
        type: String,
        default: null,
      },

      lastSyncedAt: {
        type: Date,
        default: null,
      },

      lastSyncedBy: {
        type: String,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const AutoModConfig =
  model(
    "AutoModConfig",
    autoModConfigSchema,
  );
