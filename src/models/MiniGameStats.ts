import {
  Schema,
  model,
  models,
} from "mongoose";

const miniGameStatsSchema =
  new Schema(
    {
      guildId: {
        type: String,
        required: true,
        index: true,
      },

      userId: {
        type: String,
        required: true,
        index: true,
      },

      rps: {
        played: {
          type: Number,
          default: 0,
          min: 0,
        },

        wins: {
          type: Number,
          default: 0,
          min: 0,
        },

        losses: {
          type: Number,
          default: 0,
          min: 0,
        },

        draws: {
          type: Number,
          default: 0,
          min: 0,
        },
      },

      guess: {
        played: {
          type: Number,
          default: 0,
          min: 0,
        },

        wins: {
          type: Number,
          default: 0,
          min: 0,
        },

        losses: {
          type: Number,
          default: 0,
          min: 0,
        },

        totalAttempts: {
          type: Number,
          default: 0,
          min: 0,
        },

        bestAttempts: {
          type: Number,
          default: 999,
          min: 0,
        },
      },

      tictactoe: {
        played: {
          type: Number,
          default: 0,
          min: 0,
        },

        wins: {
          type: Number,
          default: 0,
          min: 0,
        },

        losses: {
          type: Number,
          default: 0,
          min: 0,
        },

        draws: {
          type: Number,
          default: 0,
          min: 0,
        },
      },

      reaction: {
        played: {
          type: Number,
          default: 0,
          min: 0,
        },

        hits: {
          type: Number,
          default: 0,
          min: 0,
        },

        misses: {
          type: Number,
          default: 0,
          min: 0,
        },

        bestMs: {
          type: Number,
          default: 999999,
          min: 0,
        },
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

miniGameStatsSchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

export const MiniGameStats =
  models.MiniGameStats ??
  model(
    "MiniGameStats",
    miniGameStatsSchema,
  );
