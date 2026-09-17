import {
  Schema,
  model,
  type InferSchemaType,
} from "mongoose";

const temporaryVoiceConfigSchema =
  new Schema(
    {
      guildId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      enabled: {
        type: Boolean,
        default: true,
      },

      categoryId: {
        type: String,
        default: null,
      },

      hubChannelId: {
        type: String,
        default: null,
      },

      panelChannelId: {
        type: String,
        default: null,
      },

      panelMessageId: {
        type: String,
        default: null,
      },

      defaultUserLimit: {
        type: Number,
        default: 0,
        min: 0,
        max: 99,
      },

      ownerGraceSeconds: {
        type: Number,
        default: 60,
        min: 15,
        max: 300,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export type TemporaryVoiceConfigDocument =
  InferSchemaType<
    typeof temporaryVoiceConfigSchema
  >;

export const TemporaryVoiceConfig =
  model<TemporaryVoiceConfigDocument>(
    "TemporaryVoiceConfig",
    temporaryVoiceConfigSchema,
  );
