import {
  Schema,
  model,
  models,
} from "mongoose";

const matchmakingSessionSchema =
  new Schema(
    {
      sessionId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      guildId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      mode: {
        type:
          String,

        enum: [
          "friend",
          "chat",
          "gaming",
        ],

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

      userAId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      userBId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      status: {
        type:
          String,

        enum: [
          "active",
          "ended",
        ],

        default:
          "active",

        index:
          true,
      },

      startedAt: {
        type:
          Date,

        default:
          Date.now,

        index:
          true,
      },

      endedAt: {
        type:
          Date,

        default:
          null,
      },

      endedBy: {
        type:
          String,

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

matchmakingSessionSchema.index({
  guildId:
    1,

  status:
    1,

  startedAt:
    -1,
});

matchmakingSessionSchema.index({
  guildId:
    1,

  userAId:
    1,

  status:
    1,
});

matchmakingSessionSchema.index({
  guildId:
    1,

  userBId:
    1,

  status:
    1,
});

export const MatchmakingSession =
  models.MatchmakingSession ??
  model(
    "MatchmakingSession",
    matchmakingSessionSchema,
  );
