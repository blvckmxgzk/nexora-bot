import {
  Schema,
  model,
} from "mongoose";

import {
  DUNGEON_RARITIES,
  DUNGEON_SLOTS,
  DUNGEON_WEAPON_TYPES,
} from "../game/nexoDungeons/catalog.js";

const statsSchema =
  new Schema(
    {
      attack: {
        type: Number,
        default: 0,
      },

      defense: {
        type: Number,
        default: 0,
      },

      hp: {
        type: Number,
        default: 0,
      },

      critChance: {
        type: Number,
        default: 0,
      },

      critDamage: {
        type: Number,
        default: 0,
      },

      dodge: {
        type: Number,
        default: 0,
      },
    },
    {
      _id: false,
    },
  );

const affixSchema =
  new Schema(
    {
      key: {
        type: String,
        required: true,
      },

      label: {
        type: String,
        required: true,
      },

      value: {
        type: Number,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const dungeonItemSchema =
  new Schema(
    {
      instanceId: {
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

      definitionId: {
        type: String,
        required: true,
      },

      name: {
        type: String,
        required: true,
      },

      slot: {
        type: String,
        enum: [
          ...DUNGEON_SLOTS,
        ],
        required: true,
        index: true,
      },

      weaponType: {
        type: String,
        enum: [
          ...DUNGEON_WEAPON_TYPES,
          null,
        ],
        default: null,
      },

      rarity: {
        type: String,
        enum: [
          ...DUNGEON_RARITIES,
        ],
        required: true,
        index: true,
      },

      itemLevel: {
        type: Number,
        required: true,
        min: 1,
      },

      upgradeLevel: {
        type: Number,
        default: 0,
        min: 0,
        max: 20,
      },

      stats: {
        type: statsSchema,
        default: () => ({}),
      },

      affixes: {
        type: [
          affixSchema,
        ],
        default: [],
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
        default: "dungeon",
      },

      obtainedAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

dungeonItemSchema.index({
  discordId: 1,
  equipped: 1,
});

dungeonItemSchema.index({
  discordId: 1,
  rarity: 1,
  itemLevel: -1,
});

export const DungeonItem =
  model(
    "DungeonItem",
    dungeonItemSchema,
  );
