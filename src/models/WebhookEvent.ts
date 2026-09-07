import {
  Schema,
  model,
} from "mongoose";

const webhookEventSchema =
  new Schema(
    {
      eventId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      provider: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      eventKey: {
        type:
          String,

        default:
          "unknown",

        index:
          true,
      },

      resourceType: {
        type:
          String,

        enum: [
          "payment",
          "payout",
          "recipient",
          "dispute",
          "unknown",
        ],

        default:
          "unknown",

        index:
          true,
      },

      /*
       * Provider resource ID:
       *
       * chrg_...
       * trsf_...
       * recp_...
       */
      resourceId: {
        type:
          String,

        default:
          null,

        index:
          true,
      },

      /*
       * Backward compatibility สำหรับ
       * charge.complete flow เดิม
       */
      paymentId: {
        type:
          String,

        default:
          null,

        index:
          true,
      },

      status: {
        type:
          String,

        enum: [
          "processing",
          "processed",
          "failed",
        ],

        default:
          "processing",

        index:
          true,
      },

      receivedAt: {
        type:
          Date,

        default:
          Date.now,
      },

      processedAt: {
        type:
          Date,

        default:
          null,
      },

      error: {
        type:
          String,

        default:
          null,

        maxlength:
          2000,
      },

      metadata: {
        type:
          Schema.Types.Mixed,

        default: {},
      },
    },
    {
      timestamps:
        true,

      versionKey:
        false,
    },
  );

export const WebhookEvent =
  model(
    "WebhookEvent",
    webhookEventSchema,
  );
