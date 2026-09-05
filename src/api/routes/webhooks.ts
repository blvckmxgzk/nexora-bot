import type {
  FastifyPluginAsync,
} from "fastify";

import {
  verifyOmiseWebhookSignature,
} from "../security/omiseWebhookSecurity.js";

import {
  paymentService,
} from "../../services/paymentService.js";

import {
  WebhookEvent,
} from "../../models/WebhookEvent.js";

interface OmiseWebhookEvent {
  object?: string;
  id?: string;
  key?: string;
  data?: {
    id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<
      string,
      unknown
    >;
  };
}

interface WebhookRequest {
  Body: OmiseWebhookEvent;
}

interface RawBodyRequest {
  rawBody?: string;
}

export const webhookRoutes:
  FastifyPluginAsync =
  async (app) => {
    app.post<
      WebhookRequest
    >(
      "/webhooks/omise",
      {
        config: {
          rawBody: true,
        },
      },
      async (
        request,
        reply,
      ) => {
        const rawBody =
          (
            request as typeof request &
              RawBodyRequest
          ).rawBody;

        if (
          typeof rawBody !==
          "string"
        ) {
          return reply
            .code(400)
            .send({
              success: false,
              error:
                "Raw webhook body is unavailable",
            });
        }

        const timestamp =
          request.headers[
            "omise-signature-timestamp"
          ];

        const signature =
          request.headers[
            "omise-signature"
          ];

        const valid =
          verifyOmiseWebhookSignature(
            rawBody,
            typeof timestamp ===
              "string"
              ? timestamp
              : undefined,
            typeof signature ===
              "string"
              ? signature
              : undefined,
          );

        if (!valid) {
          return reply
            .code(401)
            .send({
              success: false,
              error:
                "Invalid Omise webhook signature",
            });
        }

        const event =
          request.body;

        const eventId =
          event.id;

        if (!eventId) {
          return reply
            .code(400)
            .send({
              success: false,
              error:
                "Missing Omise event ID",
            });
        }

        if (
          event.key !==
          "charge.complete"
        ) {
          return {
            success: true,
            ignored: true,
            event:
              event.key ??
              "unknown",
            eventId,
          };
        }

        const chargeId =
          event.data?.id;

        if (!chargeId) {
          return reply
            .code(400)
            .send({
              success: false,
              error:
                "Missing Omise charge ID",
            });
        }

        try {
          const payment =
            await paymentService
              .findByProviderPaymentId(
                chargeId,
              );

          if (!payment) {
            request.log.warn(
              {
                eventId,
                chargeId,
              },
              "Omise charge does not belong to a NEXORA payment",
            );

            return {
              success: true,
              ignored: true,
              eventId,
            };
          }

          const existing =
            await WebhookEvent.findOne({
              eventId,
            });

          if (existing) {
            return {
              success: true,
              duplicate: true,
              eventId,
              status:
                existing.status,
            };
          }

          let webhookEvent;

          try {
            webhookEvent =
              await WebhookEvent.create({
                eventId,
                provider:
                  "omise",
                paymentId:
                  payment.paymentId,
                status:
                  "processing",
              });
          } catch (
            createError: any
          ) {
            if (
              createError?.code ===
              11000
            ) {
              const duplicate =
                await WebhookEvent.findOne({
                  eventId,
                });

              return {
                success: true,
                duplicate: true,
                eventId,
                status:
                  duplicate?.status ??
                  "processing",
              };
            }

            throw createError;
          }

          try {
            const result =
              await paymentService
                .verifyPayment(
                  payment.paymentId,
                );

            webhookEvent.status =
              "processed";

            webhookEvent.processedAt =
              new Date();

            webhookEvent.error =
              null;

            await webhookEvent.save();

            return {
              success: true,
              processed: true,
              paymentId:
                payment.paymentId,
              eventId,
              status:
                result?.status ??
                "unknown",
            };
          } catch (
            processingError
          ) {
            webhookEvent.status =
              "failed";

            webhookEvent.error =
              processingError instanceof
              Error
                ? processingError.message
                : "Webhook processing failed";

            await webhookEvent.save();

            throw processingError;
          }
        } catch (error) {
          request.log.error(
            error,
          );

          return reply
            .code(500)
            .send({
              success: false,
              error:
                error instanceof
                Error
                  ? error.message
                  : "Webhook processing failed",
            });
        }
      },
    );
  };
