import {
  Schema,
  model,
} from "mongoose";

const marketplaceOpsAlertSchema =
  new Schema(
    {
      alertId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      sourceKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      code: {
        type: String,
        required: true,
        index: true,
        maxlength: 200,
      },

      severity: {
        type: String,
        enum: [
          "warning",
          "critical",
        ],
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: [
          "active",
          "resolved",
        ],
        default:
          "active",
        required: true,
        index: true,
      },

      count: {
        type: Number,
        default: 1,
        min: 0,
      },

      message: {
        type: String,
        required: true,
        maxlength: 2000,
      },

      details: {
        type:
          Schema.Types.Mixed,
        default: {},
      },

      firstDetectedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },

      lastDetectedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
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

marketplaceOpsAlertSchema.index({
  status: 1,
  severity: 1,
  lastDetectedAt: -1,
});

export const MarketplaceOpsAlert =
  model(
    "MarketplaceOpsAlert",
    marketplaceOpsAlertSchema,
  );
