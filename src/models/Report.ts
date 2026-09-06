import {
  Schema,
  model,
} from "mongoose";

const reportSchema =
  new Schema(
    {
      reportId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      orderId: {
        type: String,
        required: true,
        index: true,
      },

      buyerId: {
        type: String,
        required: true,
        index: true,
      },

      sellerId: {
        type: String,
        required: true,
        index: true,
      },

      shopId: {
        type: String,
        required: true,
        index: true,
      },

      productId: {
        type: String,
        default: null,
        index: true,
      },

      type: {
        type: String,
        enum: [
          "scam",
          "delivery",
          "payment",
          "other",
        ],
        default: "scam",
      },

      reason: {
        type: String,
        required: true,
        maxlength: 2000,
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "open",
          "investigating",
          "resolved",
          "dismissed",
        ],
        default: "open",
        index: true,
      },

      reviewedBy: {
        type: String,
        default: null,
      },

      resolution: {
        type: String,
        default: null,
        maxlength: 2000,
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },

      resolvedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const Report =
  model(
    "Report",
    reportSchema,
  );
