import {
  Schema,
  model,
} from "mongoose";

const memberLifecycleSchema =
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

      firstJoinedAt: {
        type: Date,
        required: true,
      },

      currentJoinedAt: {
        type: Date,
        required: true,
      },

      leftAt: {
        type: Date,
        default: null,
        index: true,
      },

      newMemberExpiresAt: {
        type: Date,
        default: null,
        index: true,
      },

      newMemberGraduatedAt: {
        type: Date,
        default: null,
        index: true,
      },

      activeRuleKeys: {
        type: [String],
        default: [],
      },

      lastReconciledAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

memberLifecycleSchema.index(
  {
    guildId: 1,
    userId: 1,
  },
  {
    unique: true,
  },
);

memberLifecycleSchema.index({
  guildId: 1,
  leftAt: 1,
  newMemberExpiresAt: 1,
});

memberLifecycleSchema.index({
  guildId: 1,
  activeRuleKeys: 1,
});

export const MemberLifecycle =
  model(
    "MemberLifecycle",
    memberLifecycleSchema,
  );
