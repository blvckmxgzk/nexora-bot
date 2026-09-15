import {
  Schema,
  model,
} from "mongoose";

export const AUTO_ROLE_TRIGGERS = [
  "join",
  "temporary_join",
  "message_activity",
  "level",
  "account_age",
  "booster",
  "server_tenure",
] as const;

export const AUTO_ROLE_BEHAVIORS = [
  "permanent",
  "temporary",
  "dynamic",
] as const;

const autoRoleRuleSchema =
  new Schema(
    {
      guildId: {
        type: String,
        required: true,
        index: true,
      },

      key: {
        type: String,
        required: true,
        trim: true,
      },

      name: {
        type: String,
        required: true,
        trim: true,
      },

      enabled: {
        type: Boolean,
        default: true,
        index: true,
      },

      roleId: {
        type: String,
        default: null,
      },

      roleName: {
        type: String,
        required: true,
        trim: true,
      },

      trigger: {
        type: String,
        enum: AUTO_ROLE_TRIGGERS,
        required: true,
        index: true,
      },

      behavior: {
        type: String,
        enum: AUTO_ROLE_BEHAVIORS,
        required: true,
      },

      stackable: {
        type: Boolean,
        default: true,
      },

      priority: {
        type: Number,
        default: 100,
      },

      config: {
        type: Schema.Types.Mixed,
        default: () => ({}),
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

autoRoleRuleSchema.index(
  {
    guildId: 1,
    key: 1,
  },
  {
    unique: true,
  },
);

autoRoleRuleSchema.index({
  guildId: 1,
  enabled: 1,
  priority: 1,
});

export const AutoRoleRule =
  model(
    "AutoRoleRule",
    autoRoleRuleSchema,
  );
