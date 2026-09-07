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

import {
  isSupportedOmiseReconciliationEvent,
  omiseWebhookReconciliationService,
} from "../../services/omiseWebhookReconciliationService.js";

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

const WEBHOOK_PROCESSING_STALE_MS =
  5 * 60 * 1000;

export const webhookRoutes:
  FastifyPluginAsync =
  async (app) => {
    app.post<WebhookRequest>(
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
            request as
              typeof request &
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
          if (
            isSupportedOmiseReconciliationEvent(
              event.key,
            )
          ) {
            if (
              !event.data?.id
            ) {
              return reply
                .code(400)
                .send({
                  success:
                    false,

                  error:
                    "Missing Omise resource ID",
                });
            }

            try {
              const result =
                await omiseWebhookReconciliationService
                  .process(
                    event,
                  );

              if (
                result.success ===
                  false &&
                result.retry ===
                  true
              ) {
                return reply
                  .code(503)
                  .send(
                    result,
                  );
              }

              return result;
            } catch (error) {
              request.log.error(
                error,
              );

              return reply
                .code(500)
                .send({
                  success:
                    false,

                  error:
                    error instanceof
                      Error
                      ? error.message
                      : "Webhook reconciliation failed",
                });
            }
          }

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

          const now =
            new Date();

          const staleBefore =
            new Date(
              Date.now() -
                WEBHOOK_PROCESSING_STALE_MS,
            );

          let webhookEvent: any =
            await WebhookEvent.findOne({
              eventId,
            });

          if (
            webhookEvent?.status ===
            "processed"
          ) {
            return {
              success: true,
              duplicate: true,
              eventId,
              status:
                "processed",
            };
          }

          let ownsClaim =
            false;

          if (
            webhookEvent?.status ===
            "failed"
          ) {
            webhookEvent =
              await WebhookEvent
                .findOneAndUpdate(
                  {
                    eventId,
                    status:
                      "failed",
                  },
                  {
                    $set: {
                      status:
                        "processing",

                      provider:
                        "omise",

                      paymentId:
                        payment.paymentId,

                      receivedAt:
                        now,

                      error:
                        null,
                    },

                    $unset: {
                      processedAt: 1,
                    },
                  },
                  {
                    new: true,
                  },
                );

            if (!webhookEvent) {
              return reply
                .code(503)
                .send({
                  success: false,
                  retry: true,

                  error:
                    "Webhook retry claim conflict",
                });
            }

            ownsClaim =
              true;
          } else if (
            webhookEvent?.status ===
            "processing"
          ) {
            const updatedAt =
              webhookEvent.updatedAt
                ? new Date(
                    webhookEvent.updatedAt,
                  )
                : new Date(
                    webhookEvent.receivedAt,
                  );

            if (
              Number.isFinite(
                updatedAt.getTime(),
              ) &&
              updatedAt >
                staleBefore
            ) {
              return reply
                .code(503)
                .send({
                  success: false,
                  retry: true,

                  error:
                    "Webhook is already being processed",
                });
            }

            const reclaimed =
              await WebhookEvent
                .findOneAndUpdate(
                  {
                    eventId,
                    status:
                      "processing",

                    updatedAt: {
                      $lte:
                        staleBefore,
                    },
                  },
                  {
                    $set: {
                      provider:
                        "omise",

                      paymentId:
                        payment.paymentId,

                      receivedAt:
                        now,

                      error:
                        null,
                    },
                  },
                  {
                    new: true,
                  },
                );

            if (!reclaimed) {
              return reply
                .code(503)
                .send({
                  success: false,
                  retry: true,

                  error:
                    "Webhook reclaim conflict",
                });
            }

            webhookEvent =
              reclaimed;

            ownsClaim =
              true;
          } else if (!webhookEvent) {
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

                  receivedAt:
                    now,
                });

              ownsClaim =
                true;
            } catch (
              createError: any
            ) {
              if (
                createError?.code ===
                11000
              ) {
                return reply
                  .code(503)
                  .send({
                    success: false,
                    retry: true,

                    error:
                      "Webhook event is already being claimed",
                  });
              }

              throw createError;
            }
          }

          if (
            !webhookEvent ||
            !ownsClaim
          ) {
            return reply
              .code(503)
              .send({
                success: false,
                retry: true,

                error:
                  "Webhook processing claim unavailable",
              });
          }

          try {
            const result =
              await paymentService
                .verifyPayment(
                  payment.paymentId,
                );

            const processed =
              await WebhookEvent
                .findOneAndUpdate(
                  {
                    eventId,
                    status:
                      "processing",
                  },
                  {
                    $set: {
                      status:
                        "processed",

                      processedAt:
                        new Date(),

                      error:
                        null,
                    },
                  },
                  {
                    new: true,
                  },
                );

            if (!processed) {
              throw new Error(
                "Webhook processing claim was lost",
              );
            }

            return {
              success: true,
              processed: true,

              paymentId:
                payment.paymentId,

              eventId,

              status:
                result.status ??
                "unknown",
            };
          } catch (
            processingError
          ) {
            await WebhookEvent
              .findOneAndUpdate(
                {
                  eventId,

                  status:
                    "processing",
                },
                {
                  $set: {
                    status:
                      "failed",

                    error:
                      processingError
                        instanceof
                          Error
                        ? processingError
                            .message
                        : "Webhook processing failed",
                  },
                },
              );

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
