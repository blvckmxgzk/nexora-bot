import {
  Schema,
  model,
} from "mongoose";

const equippedItemsSchema =
  new Schema(
    {
      weapon: {
        type: String,
        default: null,
      },

      helmet: {
        type: String,
        default: null,
      },

      armor: {
        type: String,
        default: null,
      },

      gloves: {
        type: String,
        default: null,
      },

      boots: {
        type: String,
        default: null,
      },

      ring: {
        type: String,
        default: null,
      },

      necklace: {
        type: String,
        default: null,
      },

      artifact: {
        type: String,
        default: null,
      },
    },
    {
      _id: false,
    },
  );

const dungeonProfileSchema =
  new Schema(
    {
      discordId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      level: {
        type: Number,
        default: 1,
        min: 1,
        max: 120,
        index: true,
      },

      xp: {
        type: Number,
        default: 0,
        min: 0,
      },

      ascension: {
        type: Number,
        default: 0,
        min: 0,
        index: true,
      },

      ascensionPoints: {
        type: Number,
        default: 0,
        min: 0,
      },

      equippedItems: {
        type: equippedItemsSchema,
        default: () => ({}),
      },

      totalRuns: {
        type: Number,
        default: 0,
        min: 0,
      },

      successfulRuns: {
        type: Number,
        default: 0,
        min: 0,
      },

      bossesDefeated: {
        type: Number,
        default: 0,
        min: 0,
      },

      highestDungeonTier: {
        type: Number,
        default: 1,
        min: 1,
      },

      createdCharacterAt: {
        type: Date,
        default: Date.now,
      },

      lastRunAt: {
        type: Date,
        default: null,
        index: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const DungeonProfile =
  model(
    "DungeonProfile",
    dungeonProfileSchema,
  );
