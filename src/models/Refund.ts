import {
  Schema,
  model,
} from "mongoose";

const refundSchema =
  new Schema(
    {
      refundId: {
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

      paymentId: {
        type: String,
        required: true,
        index: true,
      },

      shopId: {
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

      provider: {
        type: String,
        enum: [
          "omise",
        ],
        required: true,
      },

      providerRefundId: {
        type: String,
        default: null,
      },

      providerPaymentId: {
        type: String,
        required: true,
        index: true,
      },

      amount: {
        type: Number,
        required: true,
        min: 0,
      },

      currency: {
        type: String,
        default: "THB",
      },

      reason: {
        type: String,
        required: true,
        maxlength: 1000,
        trim: true,
      },

      status: {
        type: String,
        enum: [
          "requested",
          "approved",
          "rejected",
          "processing",
          "completed",
          "failed",
          "cancelled",
        ],
        default: "requested",
        index: true,
      },

      riskEventId: {
        type: String,
        default: null,
        index: true,
      },

      riskDecision: {
        type: String,
        enum: [
          "allow",
          "review",
          "block",
        ],
        default: null,
        index: true,
      },

      riskScore: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
      },

      riskReviewId: {
        type: String,
        default: null,
        index: true,
      },

      riskReviewStatus: {
        type: String,
        enum: [
          "pending",
          "approved",
          "rejected",
        ],
        default: null,
        index: true,
      },

      requestedBy: {
        type: String,
        required: true,
      },

      approvedBy: {
        type: String,
        default: null,
      },

      rejectedBy: {
        type: String,
        default: null,
      },

      rejectionReason: {
        type: String,
        default: null,
        maxlength: 1000,
        trim: true,
      },

      requestedAt: {
        type: Date,
        default: Date.now,
      },

      approvedAt: {
        type: Date,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      failedAt: {
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


refundSchema.index(
  {
    providerRefundId: 1,
  },
  {
    unique: true,

    name:
      "uniq_provider_refund_id",

    /*
     * Null / missing Provider Refund IDs
     * ไม่ควรถูกบังคับ unique
     *
     * uniqueness เริ่มเมื่อ Provider
     * ส่ง string ID จริงกลับมาแล้วเท่านั้น
     */
    partialFilterExpression: {
      providerRefundId: {
        $type: "string",
      },
    },
  },
);

refundSchema.index(
  {
    orderId: 1,
  },
  {
    unique: true,

    name:
      "uniq_effective_refund_per_order",

    partialFilterExpression: {
      status: {
        $in: [
          "requested",
          "approved",
          "processing",
          "failed",
          "completed",
        ],
      },
    },
  },
);


export const Refund =
  model(
    "Refund",
    refundSchema,
  );
