import {
  Schema,
  model,
} from "mongoose";

const disputeSchema =
  new Schema(
    {
      disputeId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      provider: {
        type: String,
        enum: [
          "omise",
        ],
        default:
          "omise",
        required:
          true,
      },

      providerDisputeId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      providerChargeId: {
        type: String,
        required: true,
        index: true,
      },

      paymentId: {
        type: String,
        required: true,
        index: true,
      },

      orderId: {
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

      status: {
        type: String,
        enum: [
          "open",
          "pending",
          "won",
          "lost",
        ],
        required: true,
        index: true,
      },

      amountSatang: {
        type: Number,
        required: true,
        min: 1,
      },

      fundingAmountSatang: {
        type: Number,
        required: true,
        min: 1,
      },

      /*
       * Seller liability ของ dispute
       * คำนวณจาก Seller net แบบ pro-rata
       * กับ gross disputed amount
       */
      sellerLiabilitySatang: {
        type: Number,
        required: true,
        min: 0,
      },

      liabilityPolicy: {
        type: String,
        enum: [
          "seller_net_pro_rata_v1",
        ],
        default:
          "seller_net_pro_rata_v1",
        required:
          true,
      },

      currency: {
        type: String,
        enum: [
          "THB",
        ],
        default:
          "THB",
        required:
          true,
      },

      fundingCurrency: {
        type: String,
        enum: [
          "THB",
        ],
        default:
          "THB",
        required:
          true,
      },

      providerDebitSatang: {
        type: Number,
        default: 0,
        min: 0,
      },

      providerCreditSatang: {
        type: Number,
        default: 0,
        min: 0,
      },

      providerTransactionIds: {
        type: [
          String,
        ],
        default: [],
      },

      reasonCode: {
        type: String,
        default: null,
        maxlength: 500,
      },

      reasonMessage: {
        type: String,
        default: null,
        maxlength: 2000,
      },

      message: {
        type: String,
        default: null,
        maxlength: 5000,
      },

      adminMessage: {
        type: String,
        default: null,
        maxlength: 5000,
      },

      /*
       * Order status ก่อน dispute
       * ใช้ restore หลัง WON
       */
      previousOrderStatus: {
        type: String,
        default: null,
      },

      openedAt: {
        type: Date,
        default: null,
      },

      closedAt: {
        type: Date,
        default: null,
      },

      lossAppliedAt: {
        type: Date,
        default: null,
      },

      recoveryAppliedAt: {
        type: Date,
        default: null,
      },

      lastReconciledAt: {
        type: Date,
        default: null,
        index: true,
      },

      /*
       * LOST dispute จะ freeze Seller
       * จนกว่าจะถูก resolve ใน Phase 6.1B
       */
      riskResolvedAt: {
        type: Date,
        default: null,
        index: true,
      },

      riskResolvedBy: {
        type: String,
        default: null,
      },

      riskResolutionReason: {
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

disputeSchema.index({
  sellerId: 1,
  status: 1,
  updatedAt: -1,
});

disputeSchema.index({
  paymentId: 1,
  status: 1,
});

disputeSchema.index({
  orderId: 1,
  status: 1,
});

export const Dispute =
  model(
    "Dispute",
    disputeSchema,
  );
