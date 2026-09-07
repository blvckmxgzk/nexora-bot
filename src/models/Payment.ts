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

    /*
     * Provider accounting snapshot.
     *
     * ทุกค่าเป็น integer satang
     * และถูก snapshot ตอน Provider
     * ยืนยัน Payment สำเร็จ
     */
    grossAmountSatang: {
      type: Number,
      default: null,
      validate: {
        validator(value: unknown) {
          return (
            value == null ||
            (
              Number.isSafeInteger(value) &&
              (value as number) >= 0
            )
          );
        },
      },
    },

    fundingAmountSatang: {
      type: Number,
      default: null,
      validate: {
        validator(value: unknown) {
          return (
            value == null ||
            (
              Number.isSafeInteger(value) &&
              (value as number) >= 0
            )
          );
        },
      },
    },

    providerFeeSatang: {
      type: Number,
      default: null,
    },

    providerFeeVatSatang: {
      type: Number,
      default: null,
    },

    providerDeductionsSatang: {
      type: Number,
      default: null,
    },

    providerNetSatang: {
      type: Number,
      default: null,
    },

    sellerNetSatang: {
      type: Number,
      default: null,
    },

    providerTransactionId: {
      type: String,
      default: null,
      index: true,
    },

    accountingPolicy: {
      type: String,
      enum: [
        "legacy_gross",
        "seller_pays_provider_fee",
      ],
      default: null,
      index: true,
    },

    accountingVerifiedAt: {
      type: Date,
      default: null,
      index: true,
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
