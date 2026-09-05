import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const economySchema = new Schema(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    balance: {
      type: Number,
      default: 0,
      min: 0,
    },

    bank: {
      type: Number,
      default: 0,
      min: 0,
    },

    lifetimeEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    lifetimeSpent: {
      type: Number,
      default: 0,
      min: 0,
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
  InferSchemaType<typeof economySchema>;

export const Economy = model<EconomyDocument>(
  "Economy",
  economySchema,
);
