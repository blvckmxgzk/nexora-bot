import { Schema, model } from "mongoose";

const userProfileSchema = new Schema(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    displayName: {
      type: String,
      default: "",
      maxlength: 100,
    },

    bio: {
      type: String,
      default: "",
      maxlength: 500,
    },

    birthday: {
      type: String,
      default: null,
    },

    location: {
      type: String,
      default: "",
      maxlength: 100,
    },

    website: {
      type: String,
      default: "",
      maxlength: 200,
    },

    level: {
      type: Number,
      default: 1,
      min: 1,
    },

    xp: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMessages: {
      type: Number,
      default: 0,
      min: 0,
    },

    reputation: {
      type: Number,
      default: 0,
    },

    lastXpAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserProfile = model(
  "UserProfile",
  userProfileSchema,
);
