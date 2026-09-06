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
        index: true,
        unique: true,
        sparse: true,
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

export const Refund =
  model(
    "Refund",
    refundSchema,
  );
