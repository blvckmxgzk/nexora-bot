import {
  Schema,
  model,
} from "mongoose";

const workerHeartbeatSchema =
  new Schema(
    {
      workerName: {
        type: String,
        enum: [
          "payment_expiration",
          "payout_reconciliation",
          "dispute_reconciliation",
          "notification_delivery",
        ],
        required: true,
        unique: true,
        index: true,
      },

      intervalMs: {
        type: Number,
        required: true,
        min: 1,
      },

      status: {
        type: String,
        enum: [
          "running",
          "stopped",
        ],
        required: true,
        default:
          "running",
        index: true,
      },

      lastStartedAt: {
        type: Date,
        default: null,
      },

      lastStoppedAt: {
        type: Date,
        default: null,
      },

      lastCycleStartedAt: {
        type: Date,
        default: null,
      },

      lastSuccessAt: {
        type: Date,
        default: null,
        index: true,
      },

      lastFailureAt: {
        type: Date,
        default: null,
      },

      lastDurationMs: {
        type: Number,
        default: null,
        min: 0,
      },

      consecutiveFailures: {
        type: Number,
        default: 0,
        min: 0,
      },

      lastError: {
        type: String,
        default: null,
        maxlength: 2000,
      },

      lastResult: {
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

export const WorkerHeartbeat =
  model(
    "WorkerHeartbeat",
    workerHeartbeatSchema,
  );
