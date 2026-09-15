import {
  Schema,
  model,
} from "mongoose";

const memberDailyActivitySchema =
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

      dateKey: {
        type: String,
        required: true,
      },

      bucketStart: {
        type: Date,
        required: true,
        index: true,
      },

      messageCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

memberDailyActivitySchema.index(
  {
    guildId: 1,
    userId: 1,
    dateKey: 1,
  },
  {
    unique: true,
  },
);

memberDailyActivitySchema.index({
  guildId: 1,
  dateKey: 1,
});

export const MemberDailyActivity =
  model(
    "MemberDailyActivity",
    memberDailyActivitySchema,
  );
