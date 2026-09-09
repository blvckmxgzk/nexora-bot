import {
  Schema,
  model,
} from "mongoose";

const securityIncidentSchema =
  new Schema(
    {
      incidentId: {
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
        required: true,
        index: true,
      },

      severity: {
        type: String,
        enum: [
          "medium",
          "high",
          "critical",
        ],
        default: "high",
        index: true,
      },

      executorId: {
        type: String,
        default: null,
        index: true,
      },

      targetId: {
        type: String,
        default: null,
      },

      auditLogEntryId: {
        type: String,
        default: null,
        index: true,
      },

      action: {
        type: String,
        required: true,
      },

      description: {
        type: String,
        required: true,
        maxlength: 2000,
      },

      status: {
        type: String,
        enum: [
          "open",
          "resolved",
        ],
        default: "open",
        index: true,
      },

      resolvedAt: {
        type: Date,
        default: null,
      },

      resolvedBy: {
        type: String,
        default: null,
      },

      resolution: {
        type: String,
        default: null,
        maxlength: 1000,
      },

      metadata: {
        type:
          Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

securityIncidentSchema.index({
  guildId: 1,
  createdAt: -1,
});

export const SecurityIncident =
  model(
    "SecurityIncident",
    securityIncidentSchema,
  );
