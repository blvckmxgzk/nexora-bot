import {
  Schema,
  model,
  models,
} from "mongoose";

export const DATING_AGE_GROUPS = [
  "13-17",
  "18+",
] as const;

export const DATING_GENDERS = [
  "male",
  "female",
  "other",
  "unspecified",
] as const;

export const DATING_PREFERENCES = [
  "male",
  "female",
  "any",
] as const;

const datingProfileSchema =
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

      displayName: {
        type:
          String,

        required:
          true,

        maxlength:
          100,
      },

      ageGroup: {
        type:
          String,

        enum:
          DATING_AGE_GROUPS,

        required:
          true,

        index:
          true,
      },

      gender: {
        type:
          String,

        enum:
          DATING_GENDERS,

        required:
          true,
      },

      lookingFor: {
        type:
          String,

        enum:
          DATING_PREFERENCES,

        required:
          true,

        index:
          true,
      },

      interests: {
        type:
          String,

        default:
          "",

        maxlength:
          300,
      },

      bio: {
        type:
          String,

        default:
          "",

        maxlength:
          500,
      },

      active: {
        type:
          Boolean,

        default:
          true,

        index:
          true,
      },

      likedUserIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      skippedUserIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      blockedUserIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      lastBrowseAt: {
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

datingProfileSchema.index(
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

datingProfileSchema.index({
  guildId:
    1,

  ageGroup:
    1,

  active:
    1,
});

export const DatingProfile =
  models.DatingProfile ??
  model(
    "DatingProfile",
    datingProfileSchema,
  );
