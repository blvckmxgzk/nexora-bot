import {
  Schema,
  model,
  models,
} from "mongoose";

export const PUZZLE_GAMES = [
  "sequence",
  "riddle",
  "logic",
] as const;

export const PUZZLE_STATUSES = [
  "active",
  "processing",
  "completed",
  "ended",
] as const;

const puzzleSessionSchema =
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

      game: {
        type: String,
        enum: PUZZLE_GAMES,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: PUZZLE_STATUSES,
        default: "active",
        required: true,
        index: true,
      },

      round: {
        type: Number,
        default: 1,
        min: 1,
      },

      maxRounds: {
        type: Number,
        default: 5,
        min: 1,
      },

      score: {
        type: Number,
        default: 0,
        min: 0,
      },

      streak: {
        type: Number,
        default: 0,
        min: 0,
      },

      bestStreak: {
        type: Number,
        default: 0,
        min: 0,
      },

      hintUsed: {
        type: Boolean,
        default: false,
      },

      usedQuestionIds: {
        type: [String],
        default: [],
      },

      currentQuestion: {
        type: Schema.Types.Mixed,
        required: true,
        default: () => ({}),
      },

      startedAt: {
        type: Date,
        default: Date.now,
      },

      finishedAt: {
        type: Date,
        default: null,
      },

      processingStartedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

puzzleSessionSchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

puzzleSessionSchema.index({
  status: 1,
  processingStartedAt: 1,
});

export const PuzzleSession =
  models.PuzzleSession ??
  model(
    "PuzzleSession",
    puzzleSessionSchema,
  );
