import {
  Schema,
  model,
  models,
} from "mongoose";

const cardGameStatsSchema =
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

      blackjack: {
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

        blackjacks: {
          type: Number,
          default: 0,
          min: 0,
        },
      },

      highlow: {
        played: {
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

        bestStreak: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

cardGameStatsSchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

export const CardGameStats =
  models.CardGameStats ??
  model(
    "CardGameStats",
    cardGameStatsSchema,
  );
