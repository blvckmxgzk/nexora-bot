import {
  Schema,
  model,
  models,
} from "mongoose";

export const CARD_GAMES = [
  "blackjack",
  "highlow",
] as const;

export const CARD_SESSION_STATUSES = [
  "active",
  "processing",
  "won",
  "lost",
  "draw",
  "ended",
] as const;

const cardGameSessionSchema =
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
        enum: CARD_GAMES,
        required: true,
        index: true,
      },

      status: {
        type: String,
        enum: CARD_SESSION_STATUSES,
        required: true,
        default: "active",
        index: true,
      },

      state: {
        type: Schema.Types.Mixed,
        required: true,
        default: () => ({}),
      },

      startedAt: {
        type: Date,
        required: true,
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

cardGameSessionSchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

cardGameSessionSchema.index({
  status: 1,
  updatedAt: 1,
});

export const CardGameSession =
  models.CardGameSession ??
  model(
    "CardGameSession",
    cardGameSessionSchema,
  );
