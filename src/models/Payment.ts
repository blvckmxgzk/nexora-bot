import { Schema, model } from "mongoose";

const paymentSchema = new Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

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

    provider: {
      type: String,
      enum: [
        "promptpay",
        "truemoney",
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "creating",
        "pending",
        "paid",
        "expired",
        "cancelled",
        "failed",
        "refunded",
      ],
      default: "pending",
      index: true,
    },

    providerPaymentId: {
      type: String,
      default: null,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    paidAt: {
      type: Date,
      default: null,
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

export const Payment =
  model("Payment", paymentSchema);
