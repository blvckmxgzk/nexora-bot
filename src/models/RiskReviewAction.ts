import {
  Schema,
  model,
} from "mongoose";

const riskReviewActionSchema =
  new Schema(
    {
      actionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

      sourceKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

      reviewId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      action: {
        type: String,
        enum: [
          "approve",
          "reject",
        ],
        required: true,
        index: true,
        immutable: true,
      },

      resourceType: {
        type: String,
        enum: [
          "payout",
          "refund",
        ],
        required: true,
        immutable: true,
      },

      resourceId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      actorId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      reason: {
        type: String,
        required: true,
        maxlength: 2000,
        immutable: true,
      },

      metadata: {
        type:
          Schema.Types.Mixed,
        default: {},
        immutable: true,
      },

      occurredAt: {
        type: Date,
        default: Date.now,
        required: true,
        immutable: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

riskReviewActionSchema.index({
  reviewId: 1,
  occurredAt: -1,
});

export const RiskReviewAction =
  model(
    "RiskReviewAction",
    riskReviewActionSchema,
  );
