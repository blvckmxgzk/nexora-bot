import {
  Schema,
  model,
} from "mongoose";

import {
  MINER_RARITIES,
} from "../game/nexoMiner/rarityCatalog.js";

const minerOreStackSchema =
  new Schema(
    {
      discordId: {
        type: String,
        required: true,
        index: true,
      },

      definitionId: {
        type: String,
        required: true,
        index: true,
      },

      rarity: {
        type: String,
        enum:
          MINER_RARITIES.map(
            (
              rarity,
            ) =>
              rarity.id,
          ),
        required: true,
        index: true,
      },

      location: {
        type: String,
        enum: [
          "bag",
          "chest",
        ],
        default: "bag",
        required: true,
        index: true,
      },

      quantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalWeight: {
        type: String,
        default: "0",
        required: true,
      },

      totalNetWorth: {
        type: String,
        default: "0",
        required: true,
      },

      largestWeight: {
        type: String,
        default: "0",
        required: true,
      },

      tradeLocked: {
        type: Boolean,
        default: false,
        index: true,
      },

      largestSizeClass: {
        type: String,
        enum: [
          "normal",
          "large",
          "giant",
          "colossal",
          "titan",
          "mega",
          "giga",
          "tera",
          "planetary",
          "stellar",
          "galactic",
          "universal",
          "multiversal",
          "infinite",
          "omega",
        ],
        default: "normal",
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

minerOreStackSchema.index(
  {
    discordId: 1,
    definitionId: 1,
    location: 1,
  },
  {
    unique: true,
  },
);

export const MinerOreStack =
  model(
    "MinerOreStack",
    minerOreStackSchema,
  );
