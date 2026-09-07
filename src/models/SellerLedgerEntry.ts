import {
  Schema,
  model,
} from "mongoose";

const sellerLedgerEntrySchema =
  new Schema(
    {
      ledgerEntryId: {
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

      orderId: {
        type: String,
        default: null,
        index: true,
      },

      refundId: {
        type: String,
        default: null,
        index: true,
      },

      payoutId: {
        type: String,
        default: null,
        index: true,
      },

      type: {
        type: String,
        enum: [
          "sale_credit",
          "refund_debit",
          "payout_reserve",
          "payout_release",
        ],
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
              value !== 0
            );
          },

          message:
            "amountSatang ต้องเป็น safe integer และห้ามเป็น 0",
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

sellerLedgerEntrySchema.index({
  sellerId: 1,
  createdAt: -1,
});

sellerLedgerEntrySchema.index({
  shopId: 1,
  createdAt: -1,
});

export const SellerLedgerEntry =
  model(
    "SellerLedgerEntry",
    sellerLedgerEntrySchema,
  );
