import {
  Schema,
  model,
} from "mongoose";

const minerProfileSchema =
  new Schema(
    {
      discordId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

      equippedPickaxeInstanceId: {
        type: String,
        required: true,
        index: true,
      },

      miningActive: {
        type: Boolean,
        default: true,
        index: true,
      },

      pausedReason: {
        type: String,
        enum: [
          "bag_full",
        ],
        default: null,
        index: true,
      },

      lastSettledAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true,
      },

      bagWeight: {
        type: String,
        default: "0",
        required: true,
      },

      maxWeightLevel: {
        type: Number,
        default: 0,
        min: 0,
      },

      sellMultiLevel: {
        type: Number,
        default: 0,
        min: 0,
      },

      sizeMultiLevel: {
        type: Number,
        default: 0,
        min: 0,
      },

      chestSlots: {
        type: Number,
        default: 20,
        min: 1,
      },

      permanentInfiniteBag: {
        type: Boolean,
        default: false,
      },

      infiniteBagUntil: {
        type: Date,
        default: null,
      },

      allTimeMinedNetworth: {
        type: String,
        default: "0",
        required: true,
      },

      totalOresMined: {
        type: String,
        default: "0",
        required: true,
      },

      minerLevel: { type: Number, default: 1, min: 1, index: true },
      minerXp: { type: String, default: "0", required: true },
      highestMinerLevel: { type: Number, default: 1, min: 1 },
      prestigeCount: { type: Number, default: 0, min: 0 },
      prestigeStars: { type: Number, default: 0, min: 0 },
      ultraPrestigeCount: { type: Number, default: 0, min: 0 },
      ultraCores: { type: Number, default: 0, min: 0 },


      pendingLootRolls: {
        type: Number,
        default: 0,
        min: 0,
      },

      lootLockToken: {
        type: String,
        default: null,
      },

      lootLockUntil: {
        type: Date,
        default: null,
        index: true,
      },

      settleLockToken: {
        type: String,
        default: null,
      },

      settleLockUntil: {
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

minerProfileSchema.index({
  miningActive: 1,
  pausedReason: 1,
  lastSettledAt: 1,
});

export const MinerProfile =
  model(
    "MinerProfile",
    minerProfileSchema,
  );
