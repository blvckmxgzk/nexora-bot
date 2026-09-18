import {
  Schema,
  model,
  models,
} from "mongoose";

export const MATCHMAKING_MODES = [
  "friend",
  "chat",
  "gaming",
] as const;

export const MATCHMAKING_QUEUE_STATUSES = [
  "waiting",
  "matching",
  "matched",
  "cancelled",
] as const;

const matchmakingQueueSchema =
  new Schema(
    {
      guildId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      userId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      ageGroup: {
        type:
          String,

        enum: [
          "13-17",
          "18+",
        ],

        required:
          true,

        index:
          true,
      },

      mode: {
        type:
          String,

        enum:
          MATCHMAKING_MODES,

        required:
          true,

        index:
          true,
      },

      status: {
        type:
          String,

        enum:
          MATCHMAKING_QUEUE_STATUSES,

        default:
          "waiting",

        index:
          true,
      },

      sessionId: {
        type:
          String,

        default:
          null,

        index:
          true,
      },

      joinedAt: {
        type:
          Date,

        default:
          Date.now,

        index:
          true,
      },

      matchingStartedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      timestamps:
        true,

      versionKey:
        false,
    },
  );

matchmakingQueueSchema.index(
  {
    guildId:
      1,

    userId:
      1,
  },
  {
    unique:
      true,
  },
);

matchmakingQueueSchema.index({
  guildId:
    1,

  mode:
    1,

  ageGroup:
    1,

  status:
    1,

  joinedAt:
    1,
});

export const MatchmakingQueue =
  models.MatchmakingQueue ??
  model(
    "MatchmakingQueue",
    matchmakingQueueSchema,
  );
