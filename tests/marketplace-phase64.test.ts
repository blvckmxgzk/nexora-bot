import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  createApiServer,
} from "../src/api/server.ts";

import {
  marketplaceOpsHealthService,
} from "../src/services/marketplace/marketplaceOpsHealthService.ts";

import {
  assertMarketplaceFinancialRuntimeSafety,
} from "../src/services/marketplace/financialRuntimeSafety.ts";

import {
  runFinalLaunchAudit,
} from "../src/services/marketplace/finalLaunchAuditService.ts";

import {
  NotificationDelivery,
} from "../src/models/NotificationDelivery.ts";

import {
  Order,
} from "../src/models/Order.ts";

import {
  setMarketplaceDiscordClient,
} from "../src/services/marketplace/marketplaceNotificationService.ts";

import {
  notificationDeliveryService,
} from "../src/services/marketplace/notificationDeliveryService.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

beforeAll(
  async () => {
    replSet =
      await MongoMemoryReplSet
        .create({
          replSet: {
            count:
              1,

            storageEngine:
              "wiredTiger",
          },
        });

    await mongoose.connect(
      replSet.getUri(),
      {
        dbName:
          "nexora-phase64",
      },
    );

    await NotificationDelivery
      .syncIndexes();
  },
  120_000,
);

afterEach(
  async () => {
    vi.restoreAllMocks();

    await Promise.all([
      NotificationDelivery
        .deleteMany({}),

      Order.deleteMany({}),
    ]);
  },
);

afterAll(
  async () => {
    await mongoose.disconnect();

    if (replSet) {
      await replSet.stop();
    }
  },
  120_000,
);

describe(
  "NEXORA Marketplace Phase 6.4 Final Production Hardening",
  () => {
    it(
      "API emits baseline security headers",
      async () => {
        const app =
          await createApiServer();

        const response =
          await app.inject({
            method:
              "GET",

            url:
              "/",
          });

        expect(
          response.statusCode,
        ).toBe(
          200,
        );

        expect(
          response.headers[
            "x-content-type-options"
          ],
        ).toBe(
          "nosniff",
        );

        expect(
          response.headers[
            "x-frame-options"
          ],
        ).toBe(
          "DENY",
        );

        expect(
          response.headers[
            "cache-control"
          ],
        ).toBe(
          "no-store",
        );

        await app.close();
      },
    );

    it(
      "public readiness does not expose worker internals",
      async () => {
        vi.spyOn(
          marketplaceOpsHealthService,
          "getReadiness",
        ).mockResolvedValue({
          ready:
            true,

          status:
            "ready",

          database:
            "connected",

          workers: {
            healthy:
              true,

            workers: [
              {
                workerName:
                  "payment_expiration",

                healthy:
                  true,

                reason:
                  null,

                lastError:
                  "SHOULD_NOT_LEAK",
              },
            ],
          } as any,

          checkedAt:
            new Date(),
        });

        const app =
          await createApiServer();

        const response =
          await app.inject({
            method:
              "GET",

            url:
              "/api/v1/ready",
          });

        const body =
          response.json();

        expect(
          response.statusCode,
        ).toBe(
          200,
        );

        expect(
          body.workersHealthy,
        ).toBe(
          true,
        );

        expect(
          body.workers,
        ).toBeUndefined();

        expect(
          JSON.stringify(
            body,
          ),
        ).not.toContain(
          "SHOULD_NOT_LEAK",
        );

        await app.close();
      },
    );

    it(
      "API rejects oversized request bodies",
      async () => {
        const app =
          await createApiServer();

        const response =
          await app.inject({
            method:
              "POST",

            url:
              "/api/v1/webhooks/omise",

            headers: {
              "content-type":
                "application/json",
            },

            payload: {
              value:
                "x".repeat(
                  300 *
                    1024,
                ),
            },
          });

        expect(
          response.statusCode,
        ).toBe(
          413,
        );

        await app.close();
      },
    );

    it(
      "production safety blocks Live Omise secret key",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_live_DO_NOT_USE",

              OMISE_PUBLIC_KEY:
                "pkey_test_example",

              OMISE_WEBHOOK_SECRET:
                "1234567890abcdef",

              NEXORA_PAYMENT_RETURN_URL:
                "https://example.com/return",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",

              NEXORA_PAYMENT_METHODS:
                "promptpay",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "game_topup",
            }),
        ).toThrow(
          /Live Omise key/,
        );
      },
    );

    it(
      "production safety requires HTTPS",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_example",

              OMISE_PUBLIC_KEY:
                "pkey_test_example",

              OMISE_WEBHOOK_SECRET:
                "1234567890abcdef",

              NEXORA_PAYMENT_RETURN_URL:
                "http://example.com/return",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",

              NEXORA_PAYMENT_METHODS:
                "promptpay",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "game_topup",
            }),
        ).toThrow(
          /HTTPS/,
        );
      },
    );

    it(
      "safe Test Mode production configuration passes runtime safety",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_example",

              OMISE_PUBLIC_KEY:
                "pkey_test_example",

              OMISE_WEBHOOK_SECRET:
                "1234567890abcdef",

              NEXORA_PAYMENT_RETURN_URL:
                "https://example.com/return",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",

              NEXORA_PAYMENT_METHODS:
                "promptpay,truemoney",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "game_topup,game_keys,gift_cards,digital_services,other",
            }),
        ).not.toThrow();
      },
    );

    it(
      "Final Launch Audit is READY when financial and operational state are clean",
      async () => {
        const result =
          await runFinalLaunchAudit({
            runFinancialAudit:
              async () => ({
                ready:
                  true,

                status:
                  "READY",

                reasons:
                  [],
              }),

            getOperationalSnapshot:
              async () => ({
                staleWebhookProcessingCount:
                  0,

                recentFailedWebhookCount:
                  0,

                staleCreatingPaymentCount:
                  0,

                overduePendingPaymentCount:
                  0,

                staleProcessingRefundCount:
                  0,

                stalePayoutCount:
                  0,

                staleDisputeCount:
                  0,

                staleRiskReviewCount:
                  0,
              }),
          });

        expect(
          result.ready,
        ).toBe(
          true,
        );

        expect(
          result.status,
        ).toBe(
          "READY",
        );
      },
    );

    it(
      "Final Launch Audit blocks dead-letter and stale financial operations",
      async () => {
        await NotificationDelivery
          .create({
            deliveryId:
              "NTF-PH64-DEAD",

            sourceKey:
              "order_paid_buyer:order:ORD-PH64",

            eventType:
              "order_paid_buyer",

            recipientId:
              "BUYER-PH64",

            resourceType:
              "order",

            resourceId:
              "ORD-PH64",

            status:
              "dead_letter",

            attempts:
              5,

            maxAttempts:
              5,

            nextAttemptAt:
              null,
          });

        const result =
          await runFinalLaunchAudit({
            runFinancialAudit:
              async () => ({
                ready:
                  true,

                status:
                  "READY",

                reasons:
                  [],
              }),

            getOperationalSnapshot:
              async () => ({
                staleWebhookProcessingCount:
                  0,

                recentFailedWebhookCount:
                  0,

                staleCreatingPaymentCount:
                  0,

                overduePendingPaymentCount:
                  0,

                staleProcessingRefundCount:
                  1,

                stalePayoutCount:
                  0,

                staleDisputeCount:
                  0,

                staleRiskReviewCount:
                  0,
              }),
          });

        expect(
          result.ready,
        ).toBe(
          false,
        );

        expect(
          result.deadLetterCount,
        ).toBe(
          1,
        );

        expect(
          result.reasons.join(
            " ",
          ),
        ).toContain(
          "Refund processing",
        );
      },
    );

    it(
      "Administrator recovery can resend a dead-letter notification",
      async () => {
        const now =
          new Date();

        await Order.collection
          .insertOne({
            orderId:
              "ORD-PH64-RECOVERY",

            buyerId:
              "BUYER-PH64-RECOVERY",

            sellerId:
              "SELLER-PH64-RECOVERY",

            shopId:
              "SHOP-PH64",

            productId:
              "PROD-PH64",

            productName:
              "NEXORA Recovery Test",

            productCategory:
              "other",

            quantity:
              1,

            unitPrice:
              100,

            totalAmount:
              100,

            status:
              "paid",

            paymentId:
              "PAY-PH64-RECOVERY",

            createdAt:
              now,

            updatedAt:
              now,
          });

        await NotificationDelivery
          .create({
            deliveryId:
              "NTF-PH64-RECOVERY",

            sourceKey:
              "order_paid_buyer:order:ORD-PH64-RECOVERY",

            eventType:
              "order_paid_buyer",

            recipientId:
              "BUYER-PH64-RECOVERY",

            resourceType:
              "order",

            resourceId:
              "ORD-PH64-RECOVERY",

            status:
              "dead_letter",

            attempts:
              5,

            maxAttempts:
              5,

            nextAttemptAt:
              null,

            lastError:
              "Previous DM failure",
          });

        const send =
          vi.fn()
            .mockResolvedValue({
              id:
                "discord-message",
            });

        setMarketplaceDiscordClient(
          {
            users: {
              fetch:
                vi.fn()
                  .mockResolvedValue({
                    send,
                  }),
            },
          } as any,
        );

        const result =
          await notificationDeliveryService
            .retryDeadLetter(
              "NTF-PH64-RECOVERY",
            );

        expect(
          result?.status,
        ).toBe(
          "sent",
        );

        expect(
          result?.attempts,
        ).toBe(
          6,
        );

        expect(
          send,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);
