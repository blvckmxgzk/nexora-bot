import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const temporaryVoiceRoomSchema =
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

      channelId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      ownerId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      allowedUserIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      bannedUserIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      locked: {
        type:
          Boolean,

        default:
          false,
      },

      hidden: {
        type:
          Boolean,

        default:
          false,
      },

      userLimit: {
        type:
          Number,

        default:
          0,

        min:
          0,

        max:
          99,
      },

      bitrate: {
        type:
          Number,

        default:
          64_000,

        min:
          8_000,
      },

      createdAt: {
        type:
          Date,

        default:
          Date.now,
      },

      lastOwnerChangeAt: {
        type:
          Date,

        default:
          Date.now,
      },
    },
    {
      timestamps:
        true,

      versionKey:
        false,
    },
  );

temporaryVoiceRoomSchema.index(
  {
    guildId:
      1,

    ownerId:
      1,
  },
  {
    unique:
      true,
  },
);

export type TemporaryVoiceRoomDocument =
  InferSchemaType<
    typeof temporaryVoiceRoomSchema
  >;

export const TemporaryVoiceRoom =
  model<TemporaryVoiceRoomDocument>(
    "TemporaryVoiceRoom",
    temporaryVoiceRoomSchema,
  );
