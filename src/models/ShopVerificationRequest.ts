import {
  Schema,
  model,
} from "mongoose";

const shopVerificationRequestSchema =
  new Schema(
    {
      requestId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      shopId: {
        type: String,
        required: true,
        index: true,
      },

      ownerId: {
        type: String,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "approved",
          "rejected",
          "cancelled",
        ],
        default: "pending",
        index: true,
      },

      rulesVersion: {
        type: String,
        required: true,
        default: "1.0",
      },

      acceptedAt: {
        type: Date,
        required: true,
      },

      reviewedAt: {
        type: Date,
        default: null,
      },

      reviewedBy: {
        type: String,
        default: null,
      },

      rejectionReason: {
        type: String,
        default: null,
      },

      reviewChannelId: {
        type: String,
        default: null,
      },

      reviewMessageId: {
        type: String,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const ShopVerificationRequest =
  model(
    "ShopVerificationRequest",
    shopVerificationRequestSchema,
  );
