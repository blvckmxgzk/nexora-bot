import {
  Schema,
  model,
} from "mongoose";

const ticketConfigSchema =
  new Schema(
    {
      guildId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      staffRoleId: {
        type: String,
        required: true,
      },

      categoryId: {
        type: String,
        required: true,
      },

      logChannelId: {
        type: String,
        required: true,
      },

      panelChannelId: {
        type: String,
        default: null,
      },

      panelMessageId: {
        type: String,
        default: null,
      },

      maxOpenPerUser: {
        type: Number,
        default: 3,
        min: 1,
        max: 10,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const TicketConfig =
  model(
    "TicketConfig",
    ticketConfigSchema,
  );
