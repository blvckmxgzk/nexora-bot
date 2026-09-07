import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const moderationLogSchema =
  new Schema(
    {
      caseId: {
        type: String,
        default: null,
        index: true,
      },

      guildId: {
        type: String,
        required: true,
        index: true,
      },

      targetUserId: {
        type: String,
        required: true,
        index: true,
      },

      moderatorId: {
        type: String,
        required: true,
        index: true,
      },

      action: {
        type: String,
        enum: [
          "warn",
          "unwarn",
          "timeout",
          "untimeout",
          "kick",
          "ban",
          "unban",
          "mute",
          "unmute",
          "delete",
          "purge",
          "slowmode",
          "lock",
          "unlock",
          "note",
          "maintenance",
          "automod",
        ],
        required: true,
        index: true,
      },

      reason: {
        type: String,
        default:
          "ไม่ระบุเหตุผล",
        maxlength: 1000,
      },

      duration: {
        type: Number,
        default: null,
        min: 0,
      },

      active: {
        type: Boolean,
        default: true,
        index: true,
      },

      resolvedAt: {
        type: Date,
        default: null,
      },

      resolvedBy: {
        type: String,
        default: null,
      },

      resolutionReason: {
        type: String,
        default: null,
        maxlength: 1000,
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default: {},
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

moderationLogSchema.index({
  guildId: 1,
  targetUserId: 1,
  createdAt: -1,
});

moderationLogSchema.index({
  guildId: 1,
  action: 1,
  createdAt: -1,
});

export type ModerationLogDocument =
  InferSchemaType<
    typeof moderationLogSchema
  >;

export const ModerationLog =
  model<ModerationLogDocument>(
    "ModerationLog",
    moderationLogSchema,
  );
