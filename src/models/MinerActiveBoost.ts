import {
  Schema,
  model,
} from "mongoose";

const minerActiveBoostSchema =
  new Schema(
    {
      discordId: {
        type: String,
        required: true,
        index: true,
      },

      stat: {
        type: String,
        enum: [
          "luck",
          "power",
          "size",
          "sell",
          "all",
        ],
        required: true,
      },

      itemId: {
        type: String,
        required: true,
      },

      multiplier: {
        type: String,
        required: true,
      },

      startedAt: {
        type: Date,
        required: true,
        default: Date.now,
      },

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

minerActiveBoostSchema.index(
  {
    discordId: 1,
    stat: 1,
  },
  {
    unique: true,
  },
);

export const MinerActiveBoost =
  model(
    "MinerActiveBoost",
    minerActiveBoostSchema,
  );
