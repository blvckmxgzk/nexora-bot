import {
  Schema,
  model,
} from "mongoose";

const securityConfigSchema =
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
        index: true,
      },

      logChannelId: {
        type: String,
        required: true,
      },

      trustedUserIds: {
        type: [String],
        default: [],
      },

      trustedRoleIds: {
        type: [String],
        default: [],
      },

      autoLockdown: {
        type: Boolean,
        default: true,
      },

      autoContain: {
        type: Boolean,
        default: true,
      },

      unauthorizedBotProtection: {
        type: Boolean,
        default: true,
      },

      unauthorizedWebhookProtection: {
        type: Boolean,
        default: true,
      },

      roleEscalationProtection: {
        type: Boolean,
        default: true,
      },

      autoModTamperProtection: {
        type: Boolean,
        default: true,
      },

      lockdownActive: {
        type: Boolean,
        default: false,
        index: true,
      },

      lockdownReason: {
        type: String,
        default: null,
        maxlength: 1000,
      },

      lockdownStartedAt: {
        type: Date,
        default: null,
      },

      lockdownActorId: {
        type: String,
        default: null,
      },

      lockdownSnapshot: {
        type:
          Schema.Types.Mixed,
        default: [],
      },

      policyVersion: {
        type: String,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const SecurityConfig =
  model(
    "SecurityConfig",
    securityConfigSchema,
  );
