import {
  Schema,
  model,
  models,
} from "mongoose";

export const MINI_GAMES = [
  "rps",
  "guess",
  "tictactoe",
  "reaction",
] as const;

export const MINI_GAME_STATUSES = [
  "active",
  "processing",
  "won",
  "lost",
  "draw",
  "ended",
] as const;

const miniGameSessionSchema =
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
        enum: MINI_GAMES,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: MINI_GAME_STATUSES,
        default: "active",
        required: true,
        index: true,
      },

      state: {
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

miniGameSessionSchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

miniGameSessionSchema.index({
  status: 1,
  processingStartedAt: 1,
});

export const MiniGameSession =
  models.MiniGameSession ??
  model(
    "MiniGameSession",
    miniGameSessionSchema,
  );
