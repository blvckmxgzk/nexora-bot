import {
  Schema,
  model,
} from "mongoose";

const guildSnapshotSchema =
  new Schema(
    {
      snapshotId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      guildId: {
        type: String,
        required: true,
        index: true,
      },

      type: {
        type: String,
        enum: [
          "manual",
          "auto",
          "pre_restore",
        ],
        required: true,
        index: true,
      },

      label: {
        type: String,
        default: null,
        maxlength: 200,
      },

      protected: {
        type: Boolean,
        default: false,
        index: true,
      },

      schemaVersion: {
        type: Number,
        required: true,
      },

      policyVersion: {
        type: String,
        required: true,
      },

      hash: {
        type: String,
        required: true,
        index: true,
      },

      createdBy: {
        type: String,
        required: true,
      },

      stats: {
        type:
          Schema.Types.Mixed,
        default: {},
      },

      payload: {
        type:
          Schema.Types.Mixed,
        required: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

guildSnapshotSchema.index({
  guildId: 1,
  createdAt: -1,
});

guildSnapshotSchema.index({
  guildId: 1,
  protected: 1,
  createdAt: -1,
});

export const GuildSnapshot =
  model(
    "GuildSnapshot",
    guildSnapshotSchema,
  );
