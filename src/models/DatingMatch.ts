import {
  Schema,
  model,
  models,
} from "mongoose";

const datingMatchSchema =
  new Schema(
    {
      matchId: {
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

      pairKey: {
        type:
          String,

        required:
          true,

        unique:
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
          "matched",
          "unmatched",
        ],

        default:
          "matched",

        index:
          true,
      },

      matchedAt: {
        type:
          Date,

        default:
          Date.now,

        index:
          true,
      },

      unmatchedAt: {
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

datingMatchSchema.index({
  guildId:
    1,

  userAId:
    1,

  matchedAt:
    -1,
});

datingMatchSchema.index({
  guildId:
    1,

  userBId:
    1,

  matchedAt:
    -1,
});

export const DatingMatch =
  models.DatingMatch ??
  model(
    "DatingMatch",
    datingMatchSchema,
  );
