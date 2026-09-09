import {
  Schema,
  model,
} from "mongoose";

const ticketEventSchema =
  new Schema(
    {
      type: {
        type: String,
        required: true,
      },

      actorId: {
        type: String,
        required: true,
      },

      reason: {
        type: String,
        default: null,
        maxlength: 2000,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: false,
      versionKey: false,
    },
  );

const ticketSchema =
  new Schema(
    {
      ticketId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      guildId: {
        type: String,
        required: true,
        index: true,
      },

      channelId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      controlMessageId: {
        type: String,
        default: null,
      },

      ownerId: {
        type: String,
        required: true,
        index: true,
      },

      type: {
        type: String,
        enum: [
          "support",
          "report",
          "appeal",
          "marketplace",
          "payment",
          "bug",
          "partnership",
        ],
        required: true,
        index: true,
      },

      source: {
        type: String,
        enum: [
          "manual",
          "marketplace_report",
        ],
        default: "manual",
        index: true,
      },

      reportId: {
        type: String,
        default: null,
        index: true,
      },

      orderId: {
        type: String,
        default: null,
        index: true,
      },

      shopId: {
        type: String,
        default: null,
        index: true,
      },

      sellerId: {
        type: String,
        default: null,
        index: true,
      },

      subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
      },

      description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
      },

      status: {
        type: String,
        enum: [
          "open",
          "claimed",
          "closed",
        ],
        default: "open",
        index: true,
      },

      claimedBy: {
        type: String,
        default: null,
      },

      participants: {
        type: [String],
        default: [],
      },

      closeReason: {
        type: String,
        default: null,
        maxlength: 2000,
      },

      closedBy: {
        type: String,
        default: null,
      },

      claimedAt: {
        type: Date,
        default: null,
      },

      closedAt: {
        type: Date,
        default: null,
      },

      reopenedAt: {
        type: Date,
        default: null,
      },

      reopenedBy: {
        type: String,
        default: null,
      },

      transcriptChannelId: {
        type: String,
        default: null,
      },

      transcriptMessageId: {
        type: String,
        default: null,
      },

      events: {
        type: [ticketEventSchema],
        default: [],
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

ticketSchema.index({
  guildId: 1,
  ownerId: 1,
  status: 1,
});

export const Ticket =
  model(
    "Ticket",
    ticketSchema,
  );
