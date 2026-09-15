import {
  Schema,
  model,
} from "mongoose";

const loggingChannelsSchema =
  new Schema(
    {
      member: {
        type: String,
        default: null,
      },

      moderation: {
        type: String,
        default: null,
      },

      voice: {
        type: String,
        default: null,
      },

      marketplace: {
        type: String,
        default: null,
      },

      system: {
        type: String,
        default: null,
      },

      rpg: {
        type: String,
        default: null,
      },
    },
    {
      _id: false,
    },
  );

const communityLoggingConfigSchema =
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
      },

      categoryId: {
        type: String,
        default: null,
      },

      channels: {
        type: loggingChannelsSchema,
        default: () => ({}),
      },

      retentionDays: {
        type: Number,
        default: 90,
        min: 1,
        max: 365,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const CommunityLoggingConfig =
  model(
    "CommunityLoggingConfig",
    communityLoggingConfigSchema,
  );
