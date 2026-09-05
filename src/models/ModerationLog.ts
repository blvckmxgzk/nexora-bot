import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const moderationLogSchema = new Schema(
  {
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
        "timeout",
        "kick",
        "ban",
        "unban",
        "mute",
        "unmute",
        "delete",
      ],
      required: true,
    },

    reason: {
      type: String,
      default: "ไม่ระบุเหตุผล",
      maxlength: 1000,
    },

    duration: {
      type: Number,
      default: null,
      min: 0,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type ModerationLogDocument =
  InferSchemaType<
    typeof moderationLogSchema
  >;

export const ModerationLog =
  model<ModerationLogDocument>(
    "ModerationLog",
    moderationLogSchema,
  );
