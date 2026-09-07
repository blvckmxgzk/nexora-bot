import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const transactionSchema =
  new Schema(
    {
      transactionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      discordId: {
        type: String,
        required: true,
        index: true,
      },

      type: {
        type: String,

        enum: [
          "earn",
          "spend",
          "deposit",
          "withdraw",
          "transfer",
          "purchase",
          "refund",
          "reward",
          "adjustment",
          "miner_sell",
          "miner_upgrade",
          "trade",
        ],

        required: true,
        index: true,
      },

      amount: {
        type: String,
        required: true,
      },

      balanceBefore: {
        type: String,
        required: true,
      },

      balanceAfter: {
        type: String,
        required: true,
      },

      description: {
        type: String,
        default: "",
        maxlength: 500,
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

transactionSchema.index({
  discordId: 1,
  createdAt: -1,
});

export type TransactionDocument =
  InferSchemaType<
    typeof transactionSchema
  >;

export const Transaction =
  model<TransactionDocument>(
    "Transaction",
    transactionSchema,
  );
