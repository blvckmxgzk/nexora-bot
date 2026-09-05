import {
  Schema,
  model,
} from "mongoose";

const paymentAccountSchema =
  new Schema(
    {
      accountId: {
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

      ownerId: {
        type: String,
        required: true,
        index: true,
      },

      promptpay: {
        enabled: {
          type: Boolean,
          default: false,
        },

        account: {
          type: String,
          default: null,
        },

        displayName: {
          type: String,
          default: null,
        },
      },

      truemoney: {
        enabled: {
          type: Boolean,
          default: false,
        },

        account: {
          type: String,
          default: null,
        },

        displayName: {
          type: String,
          default: null,
        },
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const PaymentAccount =
  model(
    "PaymentAccount",
    paymentAccountSchema,
  );
