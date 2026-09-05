import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const transactionSchema = new Schema(
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
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },

    description: {
      type: String,
      default: "",
      maxlength: 500,
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

export type TransactionDocument =
  InferSchemaType<typeof transactionSchema>;

export const Transaction =
  model<TransactionDocument>(
    "Transaction",
    transactionSchema,
  );
