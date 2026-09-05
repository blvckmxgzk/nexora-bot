import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const userSchema = new Schema(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    username: {
      type: String,
      required: true,
      maxlength: 100,
    },

    avatar: {
      type: String,
      default: null,
    },

    firstSeenAt: {
      type: Date,
      default: Date.now,
    },

    lastSeenAt: {
      type: Date,
      default: Date.now,
    },

    isBanned: {
      type: Boolean,
      default: false,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type UserDocument =
  InferSchemaType<typeof userSchema>;

export const User = model<UserDocument>(
  "User",
  userSchema,
);
