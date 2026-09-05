import {
  WebhookEvent,
} from "../models/WebhookEvent.js";

import {
  paymentService,
} from "./paymentService.js";

export const webhookService = {
  async processPaymentWebhook(
    data: {
      eventId: string;
      provider: string;
      paymentId: string;
      providerPaymentId: string;
      status: string;
    },
  ) {
    const existing =
      await WebhookEvent.findOne({
        eventId:
          data.eventId,
      });

    if (existing) {
      return {
        duplicate: true,
        event: existing,
      };
    }

    try {
      const event =
        await WebhookEvent.create({
          eventId:
            data.eventId,
          provider:
            data.provider,
          paymentId:
            data.paymentId,
          status:
            "processing",
        });

      if (
        data.status === "paid"
      ) {
        await paymentService.markPaid(
          data.paymentId,
          data.providerPaymentId,
        );
      }

      event.status =
        "processed";

      event.processedAt =
        new Date();

      await event.save();

      return {
        duplicate: false,
        event,
      };
    } catch (error) {
      await WebhookEvent.findOneAndUpdate(
        {
          eventId:
            data.eventId,
        },
        {
          $set: {
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Unknown error",
          },
        },
      );

      throw error;
    }
  },
};
