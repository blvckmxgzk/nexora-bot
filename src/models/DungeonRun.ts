import {
  Schema,
  model,
} from "mongoose";

const dungeonRunSchema =
  new Schema(
    {
      runId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      discordId: {
        type: String,
        required: true,
        index: true,
      },

      dungeonId: {
        type: String,
        required: true,
        index: true,
      },

      difficulty: {
        type: String,
        required: true,
      },

      status: {
        type: String,
        enum: [
          "completed",
          "failed",
        ],
        required: true,
        index: true,
      },

      rooms: {
        type: [
          Schema.Types.Mixed,
        ],
        default: [],
      },

      rewards: {
        type:
          Schema.Types.Mixed,

        default: () => ({}),
      },

      startedAt: {
        type: Date,
        required: true,
      },

      completedAt: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

dungeonRunSchema.index({
  discordId: 1,
  createdAt: -1,
});

export const DungeonRun =
  model(
    "DungeonRun",
    dungeonRunSchema,
  );
