import {
  Schema,
  model,
} from "mongoose";

import {
  MINER_RARITIES,
} from "../game/nexoMiner/rarityCatalog.js";

const minerPickaxeSchema =
  new Schema(
    {
      pickaxeInstanceId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

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

      basePower: {
        type: String,
        required: true,
      },

      baseLuck: {
        type: String,
        required: true,
      },

      baseNetWorth: {
        type: String,
        required: true,
      },

      powerLevel: {
        type: Number,
        default: 0,
        min: 0,
      },

      luckLevel: {
        type: Number,
        default: 0,
        min: 0,
      },

      equipped: {
        type: Boolean,
        default: false,
        index: true,
      },

      tradeLocked: {
        type: Boolean,
        default: false,
      },

      source: {
        type: String,
        enum: [
          "starter",
          "mining",
          "shop",
          "trade",
        ],
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

minerPickaxeSchema.index({
  discordId: 1,
  equipped: 1,
});

export const MinerPickaxe =
  model(
    "MinerPickaxe",
    minerPickaxeSchema,
  );
