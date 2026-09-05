import {
  Schema,
  model,
} from "mongoose";

const orderSchema =
  new Schema(
    {
      orderId: {
        type: String,
        required: true,
        unique: true,
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
        required: true,
        index: true,
      },

      productName: {
        type: String,
        required: true,
        maxlength: 100,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
      },

      unitPrice: {
        type: Number,
        required: true,
        min: 0,
      },

      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "awaiting_payment",
          "paid",
          "processing",
          "completed",
          "cancelled",
          "refunded",
          "disputed",
        ],
        default: "pending",
        index: true,
      },

      paymentMethod: {
        type: String,
        enum: [
          "promptpay",
          "truemoney",
          "none",
        ],
        default: "none",
      },

      paymentId: {
        type: String,
        default: null,
        index: true,
      },

      paymentExpiresAt: {
        type: Date,
        default: null,
        index: true,
      },

      paidAt: {
        type: Date,
        default: null,
      },

      processingAt: {
        type: Date,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      refundedAt: {
        type: Date,
        default: null,
      },

      cancelReason: {
        type: String,
        default: null,
        maxlength: 1000,
      },

      refundReason: {
        type: String,
        default: null,
        maxlength: 1000,
      },

      deliveryData: {
        type: Schema.Types.Mixed,
        default: {},
      },

      metadata: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const Order =
  model("Order", orderSchema);
