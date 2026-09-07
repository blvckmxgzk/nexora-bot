import {
  Schema,
  model,
} from "mongoose";

const riskEventSchema =
  new Schema(
    {
      riskEventId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

      subjectType: {
        type: String,
        enum: [
          "buyer",
          "seller",
        ],
        required: true,
        index: true,
        immutable: true,
      },

      subjectId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
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
        immutable: true,
      },

      decision: {
        type: String,
        enum: [
          "allow",
          "review",
          "block",
        ],
        required: true,
        index: true,
        immutable: true,
      },

      score: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        immutable: true,
      },

      reasonCodes: {
        type: [
          String,
        ],
        default: [],
        immutable: true,
      },

      buyerId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      sellerId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      shopId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      productId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      orderId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      paymentId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      payoutId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      refundId: {
        type: String,
        default: null,
        index: true,
        immutable: true,
      },

      metrics: {
        type:
          Schema.Types.Mixed,
        default: {},
        immutable: true,
      },

      policyVersion: {
        type: String,
        enum: [
          "marketplace_risk_v1",
        ],
        default:
          "marketplace_risk_v1",
        required: true,
        immutable: true,
      },

      occurredAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true,
        immutable: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

riskEventSchema.index({
  subjectId: 1,
  action: 1,
  occurredAt: -1,
});

riskEventSchema.index({
  decision: 1,
  occurredAt: -1,
});

export const RiskEvent =
  model(
    "RiskEvent",
    riskEventSchema,
  );
