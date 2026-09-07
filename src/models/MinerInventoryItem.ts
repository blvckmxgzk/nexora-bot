import {
  Schema,
  model,
} from "mongoose";

const minerInventoryItemSchema =
  new Schema(
    {
      discordId: {
        type: String,
        required: true,
        index: true,
      },

      itemId: {
        type: String,
        required: true,
        index: true,
      },

      quantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      tradeLockedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastSource: {
        type: String,
        enum: [
          "mining",
          "shop",
          "trade",
          "admin",
        ],
        default: "mining",
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

minerInventoryItemSchema.index(
  {
    discordId: 1,
    itemId: 1,
  },
  {
    unique: true,
  },
);

export const MinerInventoryItem =
  model(
    "MinerInventoryItem",
    minerInventoryItemSchema,
  );
