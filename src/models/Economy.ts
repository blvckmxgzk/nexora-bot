import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const economySchema =
  new Schema(
    {
      discordId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      balance: {
        type: String,
        default: "0",
        required: true,
      },

      bank: {
        type: String,
        default: "0",
        required: true,
      },


      reservedBalance: {
        type: String,
        default: "0",
        required: true,
      },

      lifetimeEarned: {
        type: String,
        default: "0",
        required: true,
      },

      lifetimeSpent: {
        type: String,
        default: "0",
        required: true,
      },

      lastDailyAt: {
        type: Date,
        default: null,
      },

      inventory: {
        type: [
          {
            itemId: {
              type: String,
              required: true,
            },

            quantity: {
              type: Number,
              required: true,
              min: 1,
            },
          },
        ],

        default: [],
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export type EconomyDocument =
  InferSchemaType<
    typeof economySchema
  >;

export const Economy =
  model<EconomyDocument>(
    "Economy",
    economySchema,
  );
