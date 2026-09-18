import {
  Schema,
  model,
  models,
} from "mongoose";

const analyticsSnapshotSchema =
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

      dateKey: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      metrics: {
        type:
          Schema.Types.Mixed,

        required:
          true,

        default:
          () => ({}),
      },

      capturedAt: {
        type:
          Date,

        required:
          true,

        default:
          Date.now,

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

analyticsSnapshotSchema.index(
  {
    guildId:
      1,

    dateKey:
      1,
  },
  {
    unique:
      true,
  },
);

analyticsSnapshotSchema.index({
  guildId:
    1,

  capturedAt:
    -1,
});

export const AnalyticsSnapshot =
  models.AnalyticsSnapshot ??
  model(
    "AnalyticsSnapshot",
    analyticsSnapshotSchema,
  );
