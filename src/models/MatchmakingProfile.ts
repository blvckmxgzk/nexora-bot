import {
  Schema,
  model,
  models,
} from "mongoose";

export const MATCHMAKING_AGE_GROUPS = [
  "13-17",
  "18+",
] as const;

const matchmakingProfileSchema =
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

        enum:
          MATCHMAKING_AGE_GROUPS,

        required:
          true,

        index:
          true,
      },
    },
    {
      timestamps:
        true,

      versionKey:
        false,
    },
  );

matchmakingProfileSchema.index(
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

export const MatchmakingProfile =
  models.MatchmakingProfile ??
  model(
    "MatchmakingProfile",
    matchmakingProfileSchema,
  );
