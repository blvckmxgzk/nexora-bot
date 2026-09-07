import {
  Schema,
  model,
} from "mongoose";

const riskVelocityBucketSchema =
  new Schema(
    {
      bucketKey: {
        type: String,
        required: true,
        unique: true,
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

      action: {
        type: String,
        enum: [
          "order_create",
          "payment_create",
          "payout_request",
          "refund_request",
        ],
        required: true,
        index: true,
      },

      windowStartedAt: {
        type: Date,
        required: true,
        index: true,
      },

      windowMs: {
        type: Number,
        required: true,
        min: 1,
      },

      count: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      expiresAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

riskVelocityBucketSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
    name:
      "ttl_risk_velocity_bucket",
  },
);

export const RiskVelocityBucket =
  model(
    "RiskVelocityBucket",
    riskVelocityBucketSchema,
  );
