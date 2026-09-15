import {
  Schema,
  model,
} from "mongoose";

export const COMMUNITY_LOG_CATEGORIES = [
  "member",
  "moderation",
  "voice",
  "marketplace",
  "system",
  "rpg",
] as const;

export const COMMUNITY_LOG_SEVERITIES = [
  "info",
  "success",
  "warning",
  "error",
] as const;

const communityLogRecordSchema =
  new Schema(
    {
      guildId: {
        type: String,
        required: true,
        index: true,
      },

      category: {
        type: String,
        enum: COMMUNITY_LOG_CATEGORIES,
        required: true,
        index: true,
      },

      event: {
        type: String,
        required: true,
        index: true,
      },

      severity: {
        type: String,
        enum: COMMUNITY_LOG_SEVERITIES,
        default: "info",
      },

      title: {
        type: String,
        required: true,
      },

      description: {
        type: String,
        default: null,
      },

      userId: {
        type: String,
        default: null,
        index: true,
      },

      actorId: {
        type: String,
        default: null,
        index: true,
      },

      channelId: {
        type: String,
        default: null,
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: () => ({}),
      },

      occurredAt: {
        type: Date,
        default: Date.now,
        index: true,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

communityLogRecordSchema.index({
  guildId: 1,
  category: 1,
  occurredAt: -1,
});

communityLogRecordSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  },
);

export const CommunityLogRecord =
  model(
    "CommunityLogRecord",
    communityLogRecordSchema,
  );
