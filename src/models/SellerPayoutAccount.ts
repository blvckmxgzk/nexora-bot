import {
  Schema,
  model,
} from "mongoose";

const sellerPayoutAccountSchema =
  new Schema(
    {
      payoutAccountId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      sellerId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      shopId: {
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

      status: {
        type: String,
        enum: [
          "creating",
          "pending_verification",
          "ready",
        ],
        default:
          "creating",
        index: true,
      },

      recipientId: {
        type: String,
        default: null,
      },

      recipientActive: {
        type: Boolean,
        default: false,
      },

      recipientVerified: {
        type: Boolean,
        default: false,
      },

      recipientFailureCode: {
        type: String,
        default: null,
      },

      /*
       * ห้ามเก็บเลขบัญชีเต็ม
       */
      bankCode: {
        type: String,
        default: null,
      },

      bankBrand: {
        type: String,
        default: null,
      },

      bankLastDigits: {
        type: String,
        default: null,
        maxlength: 4,
      },

      accountHolderName: {
        type: String,
        default: null,
        maxlength: 100,
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

sellerPayoutAccountSchema.index(
  {
    recipientId: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      recipientId: {
        $type: "string",
      },
    },
  },
);

export const SellerPayoutAccount =
  model(
    "SellerPayoutAccount",
    sellerPayoutAccountSchema,
  );
