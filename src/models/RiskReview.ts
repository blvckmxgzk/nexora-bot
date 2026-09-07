import {
  Schema,
  model,
} from "mongoose";

const riskReviewSchema =
  new Schema(
    {
      reviewId: {
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

      riskEventId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      resourceType: {
        type: String,
        enum: [
          "payout",
          "refund",
        ],
        required: true,
        index: true,
      },

      resourceId: {
        type: String,
        required: true,
        index: true,
      },

      subjectType: {
        type: String,
        enum: [
          "buyer",
          "seller",
        ],
        required: true,
        index: true,
      },

      subjectId: {
        type: String,
        required: true,
        index: true,
      },

      buyerId: {
        type: String,
        default: null,
        index: true,
      },

      sellerId: {
        type: String,
        default: null,
        index: true,
      },

      shopId: {
        type: String,
        default: null,
        index: true,
      },

      score: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },

      reasonCodes: {
        type: [
          String,
        ],
        default: [],
      },

      status: {
        type: String,
        enum: [
          "pending",
          "approved",
          "rejected",
        ],
        default:
          "pending",
        required: true,
        index: true,
      },

      resolvedAt: {
        type: Date,
        default: null,
      },

      resolvedBy: {
        type: String,
        default: null,
        index: true,
      },

      resolutionReason: {
        type: String,
        default: null,
        maxlength: 2000,
      },

      metadata: {
        type:
          Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

riskReviewSchema.index({
  status: 1,
  createdAt: 1,
});

riskReviewSchema.index({
  resourceType: 1,
  resourceId: 1,
});

export const RiskReview =
  model(
    "RiskReview",
    riskReviewSchema,
  );
