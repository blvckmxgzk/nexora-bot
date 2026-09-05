import {
  Schema,
  model,
} from "mongoose";

const webhookEventSchema =
  new Schema(
    {
      eventId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      provider: {
        type: String,
        required: true,
        index: true,
      },

      paymentId: {
        type: String,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "processing",
          "processed",
          "failed",
        ],
        default: "processing",
        index: true,
      },

      receivedAt: {
        type: Date,
        default: Date.now,
      },

      processedAt: {
        type: Date,
        default: null,
      },

      error: {
        type: String,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const WebhookEvent =
  model(
    "WebhookEvent",
    webhookEventSchema,
  );
