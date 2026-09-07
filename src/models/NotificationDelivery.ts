import {
  Schema,
  model,
} from "mongoose";

const notificationDeliverySchema =
  new Schema(
    {
      deliveryId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

      sourceKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

      eventType: {
        type: String,
        enum: [
          "order_paid_buyer",
          "order_paid_seller",
          "refund_requested_seller",
          "refund_completed_buyer",
          "refund_rejected_buyer",
        ],
        required: true,
        index: true,
        immutable: true,
      },

      recipientId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      resourceType: {
        type: String,
        enum: [
          "order",
          "refund",
        ],
        required: true,
        index: true,
        immutable: true,
      },

      resourceId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      status: {
        type: String,
        enum: [
          "pending",
          "sending",
          "retrying",
          "sent",
          "dead_letter",
        ],
        default: "pending",
        required: true,
        index: true,
      },

      attempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      maxAttempts: {
        type: Number,
        default: 5,
        min: 1,
        max: 10,
      },

      nextAttemptAt: {
        type: Date,
        default: Date.now,
        index: true,
      },

      lastAttemptAt: {
        type: Date,
        default: null,
      },

      sentAt: {
        type: Date,
        default: null,
        index: true,
      },

      lastError: {
        type: String,
        default: null,
        maxlength: 2000,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

notificationDeliverySchema.index({
  status: 1,
  nextAttemptAt: 1,
});

notificationDeliverySchema.index({
  recipientId: 1,
  createdAt: -1,
});

notificationDeliverySchema.index({
  resourceType: 1,
  resourceId: 1,
  createdAt: -1,
});

export const NotificationDelivery =
  model(
    "NotificationDelivery",
    notificationDeliverySchema,
  );
