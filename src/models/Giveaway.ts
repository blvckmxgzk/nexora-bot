import {
  Schema,
  model,
  models,
} from "mongoose";

export const GIVEAWAY_STATUSES = [
  "active",
  "ending",
  "ended",
  "cancelled",
] as const;

export type GiveawayStatus =
  typeof GIVEAWAY_STATUSES[number];

const rerollSchema =
  new Schema(
    {
      winnerIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      rerolledBy: {
        type:
          String,

        required:
          true,
      },

      rerolledAt: {
        type:
          Date,

        required:
          true,
      },
    },
    {
      _id:
        false,
    },
  );

const giveawaySchema =
  new Schema(
    {
      giveawayId: {
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

      channelId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      messageId: {
        type:
          String,

        default:
          null,

        index:
          true,
      },

      hostId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      prize: {
        type:
          String,

        required:
          true,

        maxlength:
          200,
      },

      description: {
        type:
          String,

        default:
          null,

        maxlength:
          1500,
      },

      winnerCount: {
        type:
          Number,

        required:
          true,

        min:
          1,

        max:
          20,
      },

      entrantIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      winnerIds: {
        type: [
          String,
        ],

        default:
          [],
      },

      rerollHistory: {
        type: [
          rerollSchema,
        ],

        default:
          [],
      },

      status: {
        type:
          String,

        enum:
          GIVEAWAY_STATUSES,

        default:
          "active",

        index:
          true,
      },

      endsAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      processingStartedAt: {
        type:
          Date,

        default:
          null,
      },

      endedAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      endedBy: {
        type:
          String,

        default:
          null,
      },

      endReason: {
        type:
          String,

        default:
          null,

        maxlength:
          200,
      },

      cancelledAt: {
        type:
          Date,

        default:
          null,
      },

      cancelledBy: {
        type:
          String,

        default:
          null,
      },

      cancelReason: {
        type:
          String,

        default:
          null,

        maxlength:
          500,
      },

      messageSyncedAt: {
        type:
          Date,

        default:
          null,
      },

      announcementClaimedAt: {
        type:
          Date,

        default:
          null,
      },

      announcementSentAt: {
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

giveawaySchema.index({
  guildId:
    1,

  status:
    1,

  endsAt:
    1,
});

giveawaySchema.index({
  guildId:
    1,

  createdAt:
    -1,
});

giveawaySchema.index({
  status:
    1,

  processingStartedAt:
    1,
});

export const Giveaway =
  models.Giveaway ??
  model(
    "Giveaway",
    giveawaySchema,
  );
