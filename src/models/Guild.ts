import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const guildSchema = new Schema(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      maxlength: 100,
    },

    settings: {
      prefix: {
        type: String,
        default: "!",
        maxlength: 5,
      },

      language: {
        type: String,
        default: "th",
      },

      timezone: {
        type: String,
        default: "Asia/Bangkok",
      },
    },

    moderation: {
      enabled: {
        type: Boolean,
        default: true,
      },

      autoModEnabled: {
        type: Boolean,
        default: false,
      },

      logChannelId: {
        type: String,
        default: null,
      },
    },

    economy: {
      enabled: {
        type: Boolean,
        default: true,
      },

      currencyName: {
        type: String,
        default: "NEXO",
      },

      currencySymbol: {
        type: String,
        default: "N",
      },
    },

    ticket: {
      enabled: {
        type: Boolean,
        default: true,
      },

      categoryId: {
        type: String,
        default: null,
      },

      supportRoleId: {
        type: String,
        default: null,
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export type GuildDocument =
  InferSchemaType<typeof guildSchema>;

export const Guild = model<GuildDocument>(
  "Guild",
  guildSchema,
);
