import {
  Schema,
  model,
  models,
} from "mongoose";

const modeStats = {
  played: {
    type: Number,
    default: 0,
    min: 0,
  },

  completed: {
    type: Number,
    default: 0,
    min: 0,
  },

  correct: {
    type: Number,
    default: 0,
    min: 0,
  },

  wrong: {
    type: Number,
    default: 0,
    min: 0,
  },
};

const puzzleStatsSchema =
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

      played: {
        type: Number,
        default: 0,
        min: 0,
      },

      completed: {
        type: Number,
        default: 0,
        min: 0,
      },

      correct: {
        type: Number,
        default: 0,
        min: 0,
      },

      wrong: {
        type: Number,
        default: 0,
        min: 0,
      },

      hints: {
        type: Number,
        default: 0,
        min: 0,
      },

      bestScore: {
        type: Number,
        default: 0,
        min: 0,
      },

      bestStreak: {
        type: Number,
        default: 0,
        min: 0,
      },

      sequence: modeStats,
      riddle: modeStats,
      logic: modeStats,
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

puzzleStatsSchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

export const PuzzleStats =
  models.PuzzleStats ??
  model(
    "PuzzleStats",
    puzzleStatsSchema,
  );
