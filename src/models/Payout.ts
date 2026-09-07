import {
  Schema,
  model,
} from "mongoose";

const payoutSchema =
  new Schema(
    {
      payoutId: {
        type: String,
        required: true,
        unique: true,
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

      payoutAccountId: {
        type: String,
        required: true,
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

      recipientId: {
        type: String,
        required: true,
        index: true,
      },

      amountSatang: {
        type: Number,
        required: true,

        validate: {
          validator(
            value: number,
          ) {
            return (
              Number.isSafeInteger(
                value,
              ) &&
              value > 0
            );
          },

          message:
            "amountSatang ต้องเป็น safe integer ที่มากกว่า 0",
        },
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

      /*
       * Seller pays:
       *
       * amountSatang = ยอด Transfer ก่อน fee
       * netSatang    = ยอดที่เข้าบัญชีจริง
       */
      feePolicy: {
        type: String,
        enum: [
          "seller_pays",
        ],
        default:
          "seller_pays",
        required:
          true,
      },

      status: {
        type: String,
        enum: [
          "reserved",
          "creating_transfer",
          "submitted",
          "sent",
          "paid",
          "failed",
        ],
        default:
          "reserved",
        index: true,
      },

      idempotencyKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      providerTransferId: {
        type: String,
        default: null,
      },

      feeSatang: {
        type: Number,
        default: null,
      },

      netSatang: {
        type: Number,
        default: null,
      },

      requestedAt: {
        type: Date,
        default: Date.now,
      },

      submittedAt: {
        type: Date,
        default: null,
      },

      sentAt: {
        type: Date,
        default: null,
      },

      paidAt: {
        type: Date,
        default: null,
      },

      failedAt: {
        type: Date,
        default: null,
      },

      lastReconciledAt: {
        type: Date,
        default: null,
        index: true,
      },

      failureCode: {
        type: String,
        default: null,
      },

      failureMessage: {
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

payoutSchema.index(
  {
    sellerId: 1,
  },
  {
    unique: true,

    name:
      "uniq_active_payout_per_seller",

    partialFilterExpression: {
      status: {
        $in: [
          "reserved",
          "creating_transfer",
          "submitted",
          "sent",
        ],
      },
    },
  },
);

payoutSchema.index(
  {
    providerTransferId: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      providerTransferId: {
        $type: "string",
      },
    },
  },
);

export const Payout =
  model(
    "Payout",
    payoutSchema,
  );
