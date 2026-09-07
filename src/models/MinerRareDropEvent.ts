import {
  Schema,
  model,
} from "mongoose";

import {
  MINER_RARITIES,
} from "../game/nexoMiner/rarityCatalog.js";

const minerRareDropEventSchema =
  new Schema(
    {
      eventId: {
        type: String,
        required: true,
        unique: true,
        immutable: true,
      },

      discordId: {
        type: String,
        required: true,
        index: true,
      },

      dropType: {
        type: String,
        enum: [
          "item",
          "pickaxe",
          "ore",
        ],
        required: true,
      },

      definitionId: {
        type: String,
        required: true,
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

      netWorth: {
        type: String,
        required: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "sent",
        ],
        default: "pending",
        index: true,
      },

      attempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastAttemptAt: {
        type: Date,
        default: null,
      },

      sentAt: {
        type: Date,
        default: null,
      },

      lastError: {
        type: String,
        default: null,
        maxlength: 1000,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

minerRareDropEventSchema.index({
  status: 1,
  createdAt: 1,
});

export const MinerRareDropEvent =
  model(
    "MinerRareDropEvent",
    minerRareDropEventSchema,
  );
