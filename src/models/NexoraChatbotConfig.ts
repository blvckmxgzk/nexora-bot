import {
  Schema,
  model,
} from "mongoose";

const nexoraChatbotConfigSchema =
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

      channelId: {
        type: String,
        default: null,
      },

      mentionEnabled: {
        type: Boolean,
        default: true,
      },

      replyTriggerEnabled: {
        type: Boolean,
        default: true,
      },

      maxInputChars: {
        type: Number,
        default: 8000,
        min: 500,
        max: 20000,
      },

      maxOutputChars: {
        type: Number,
        default: 3800,
        min: 500,
        max: 10000,
      },

      conversationTtlMinutes: {
        type: Number,
        default: 30,
        min: 5,
        max: 1440,
      },

      maxContextMessages: {
        type: Number,
        default: 20,
        min: 2,
        max: 50,
      },

      cooldownSeconds: {
        type: Number,
        default: 5,
        min: 1,
        max: 60,
      },

      hourlyLimit: {
        type: Number,
        default: 30,
        min: 1,
        max: 500,
      },

      blockedChannelIds: {
        type: [String],
        default: [],
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const NexoraChatbotConfig =
  model(
    "NexoraChatbotConfig",
    nexoraChatbotConfigSchema,
  );
