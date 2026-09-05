import { Schema, model } from "mongoose";

const itemSchema = new Schema(
  {
    itemId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
      maxlength: 500,
    },

    type: {
      type: String,
      enum: [
        "consumable",
        "collectible",
        "utility",
        "special",
      ],
      default: "collectible",
    },

    rarity: {
      type: String,
      enum: [
        "common",
        "uncommon",
        "rare",
        "epic",
        "legendary",
      ],
      default: "common",
    },

    emoji: {
      type: String,
      default: "📦",
    },

    stackable: {
      type: Boolean,
      default: true,
    },

    tradeable: {
      type: Boolean,
      default: true,
    },

    usable: {
      type: Boolean,
      default: false,
    },

    enabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const Item = model(
  "Item",
  itemSchema,
);
