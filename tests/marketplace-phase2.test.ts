import crypto from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  FastifyInstance,
} from "fastify";

import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  Product,
} from "../src/models/Product.ts";

import {
  Order,
} from "../src/models/Order.ts";

import {
  Payment,
} from "../src/models/Payment.ts";

import {
  Refund,
} from "../src/models/Refund.ts";

import {
  WebhookEvent,
} from "../src/models/WebhookEvent.ts";

import {
  paymentService,
} from "../src/services/paymentService.ts";

import {
  refundService,
} from "../src/services/refundService.ts";

import {
  omiseProvider,
} from "../src/services/payment/providers/omiseProvider.ts";

import {
  createApiServer,
} from "../src/api/server.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

let api:
  | FastifyInstance
  | undefined;

const WEBHOOK_SECRET =
  Buffer.from(
    "nexora-phase2-webhook-secret",
    "utf8",
  );

interface ReservedStateOptions {
  suffix?: string;
  amount?: number;
  expiresAt?: Date;
}

async function createReservedPaymentState(
  options: ReservedStateOptions = {},
) {
  const suffix =
    options.suffix ??
    crypto.randomUUID();

  const amount =
    options.amount ??
    100;

  const productId =
    `PRODUCT-${suffix}`;

  const orderId =
    `ORDER-${suffix}`;

  const paymentId =
    `PAYMENT-${suffix}`;

  const providerPaymentId =
    `ch_${suffix}`;

  const expiresAt =
    options.expiresAt ??
    new Date(
      Date.now() -
        60_000,
    );

  await Product.create({
    productId,

    shopId:
      `SHOP-${suffix}`,

    ownerId:
      `SELLER-${suffix}`,

    name:
      "Phase 2 Product",

    description:
      "Phase 2 Test Product",

    price:
      amount,

    category:
      "other",

    stock: 0,
    sold: 0,
    active: true,
  });

  await Order.create({
    orderId,

    buyerId:
      `BUYER-${suffix}`,

    sellerId:
      `SELLER-${suffix}`,

    shopId:
      `SHOP-${suffix}`,

    productId,

    productName:
      "Phase 2 Product",

    quantity: 1,

    unitPrice:
      amount,

    totalAmount:
      amount,

    status:
      "awaiting_payment",

    paymentMethod:
      "promptpay",

    paymentId,

    paymentExpiresAt:
      expiresAt,

    metadata: {
      stockReserved:
        true,

      stockReleased:
        false,
    },
  });

  await Payment.create({
    paymentId,

    orderId,

    buyerId:
      `BUYER-${suffix}`,

    sellerId:
      `SELLER-${suffix}`,

    shopId:
      `SHOP-${suffix}`,

    provider:
      "promptpay",

    amount,

    status:
      "pending",

    providerPaymentId,

    expiresAt,
  });

  return {
    suffix,
    amount,
    productId,
    orderId,
    paymentId,
    providerPaymentId,
    expiresAt,
  };
}

function signWebhook(
  rawBody: string,
  timestamp: string,
): string {
  return crypto
    .createHmac(
      "sha256",
      WEBHOOK_SECRET,
    )
    .update(
      `${timestamp}.${rawBody}`,
      "utf8",
    )
    .digest(
      "hex",
    );
}

async function injectWebhook(
  event: {
    id: string;
    key: string;

    data: {
      id: string;
    };
  },

  options: {
    timestamp?: string;
    signature?: string;
  } = {},
) {
  if (!api) {
    throw new Error(
      "API server is not initialized",
    );
  }

  const rawBody =
    JSON.stringify(
      event,
    );

  const timestamp =
    options.timestamp ??
    String(
      Math.floor(
        Date.now() /
          1000,
      ),
    );

  const signature =
    options.signature ??
    signWebhook(
      rawBody,
      timestamp,
    );

  return api.inject({
    method:
      "POST",

    url:
      "/api/v1/webhooks/omise",

    payload:
      rawBody,

    headers: {
      "content-type":
        "application/json",

      "omise-signature-timestamp":
        timestamp,

      "omise-signature":
        signature,
    },
  });
}

beforeAll(
  async () => {
    process.env
      .OMISE_WEBHOOK_SECRET =
      WEBHOOK_SECRET
        .toString(
          "base64",
        );

    replSet =
      await MongoMemoryReplSet
        .create({
          instanceOpts: [
            {
              launchTimeout:
                120_000,
            },
          ],

          replSet: {
            count: 1,

            storageEngine:
              "wiredTiger",
          },
        });

    await mongoose.connect(
      replSet.getUri(),
      {
        dbName:
          "nexora-marketplace-phase2",
      },
    );

    await Promise.all([
      Product.syncIndexes(),
      Order.syncIndexes(),
      Payment.syncIndexes(),
      Refund.syncIndexes(),
      WebhookEvent.syncIndexes(),
    ]);

    api =
      await createApiServer();

    await api.ready();
  },
  120_000,
);

beforeEach(() => {
  vi.spyOn(
    console,
    "log",
  ).mockImplementation(
    () => {},
  );

  vi.spyOn(
    console,
    "warn",
  ).mockImplementation(
    () => {},
  );

  vi.spyOn(
    console,
    "error",
  ).mockImplementation(
    () => {},
  );
});

afterEach(async () => {
  vi.restoreAllMocks();

  await Promise.all([
    Product.deleteMany({}),
    Order.deleteMany({}),
    Payment.deleteMany({}),
    Refund.deleteMany({}),
    WebhookEvent.deleteMany({}),
  ]);
});

afterAll(async () => {
  if (api) {
    await api.close();
  }

  if (
    mongoose.connection
      .readyState !== 0
  ) {
    await mongoose.disconnect();
  }

  if (replSet) {
    await replSet.stop();
  }
});

describe(
  "NEXORA Marketplace Phase 2",
  () => {
    it(
      "does not expose Order or Payment REST APIs publicly",
      async () => {
        if (!api) {
          throw new Error(
            "API unavailable",
          );
        }

        const orderResponse =
          await api.inject({
            method:
              "GET",

            url:
              "/api/v1/orders/ORDER-TEST",
          });

        const paymentResponse =
          await api.inject({
            method:
              "GET",

            url:
              "/api/v1/payments/PAYMENT-TEST",
          });

        const verifyResponse =
          await api.inject({
            method:
              "POST",

            url:
              "/api/v1/payments/PAYMENT-TEST/verify",
          });

        expect(
          orderResponse.statusCode,
        ).toBe(404);

        expect(
          paymentResponse.statusCode,
        ).toBe(404);

        expect(
          verifyResponse.statusCode,
        ).toBe(404);
      },
    );

    it(
      "rejects an invalid Omise webhook signature",
      async () => {
        const response =
          await injectWebhook(
            {
              id:
                "evt-invalid",

              key:
                "charge.complete",

              data: {
                id:
                  "ch-invalid",
              },
            },
            {
              signature:
                "00".repeat(
                  32,
                ),
            },
          );

        expect(
          response.statusCode,
        ).toBe(401);
      },
    );

    it(
      "rejects a correctly signed webhook with a stale timestamp",
      async () => {
        const timestamp =
          String(
            Math.floor(
              Date.now() /
                1000,
            ) -
              601,
          );

        const event = {
          id:
            "evt-stale-signature",

          key:
            "charge.complete",

          data: {
            id:
              "ch-stale",
          },
        };

        const rawBody =
          JSON.stringify(
            event,
          );

        const response =
          await injectWebhook(
            event,
            {
              timestamp,

              signature:
                signWebhook(
                  rawBody,
                  timestamp,
                ),
            },
          );

        expect(
          response.statusCode,
        ).toBe(401);
      },
    );

    it(
      "retries a failed webhook event and marks it processed",
      async () => {
        const state =
          await createReservedPaymentState({
            suffix:
              "FAILED-RETRY",

            expiresAt:
              new Date(
                Date.now() +
                  60_000,
              ),
          });

        await WebhookEvent.create({
          eventId:
            "evt-failed-retry",

          provider:
            "omise",

          paymentId:
            state.paymentId,

          status:
            "failed",

          error:
            "simulated failure",
        });

        const verifySpy =
          vi.spyOn(
            omiseProvider,
            "verifyPayment",
          ).mockResolvedValue({
            paid: true,

            status:
              "successful",

            providerPaymentId:
              state
                .providerPaymentId,

            paidAt:
              new Date(),

            amount:
              state.amount,

            currency:
              "THB",
          });

        const response =
          await injectWebhook({
            id:
              "evt-failed-retry",

            key:
              "charge.complete",

            data: {
              id:
                state
                  .providerPaymentId,
            },
          });

        expect(
          response.statusCode,
        ).toBe(200);

        expect(
          verifySpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        const event =
          await WebhookEvent.findOne({
            eventId:
              "evt-failed-retry",
          });

        const payment =
          await Payment.findOne({
            paymentId:
              state.paymentId,
          });

        expect(
          event?.status,
        ).toBe(
          "processed",
        );

        expect(
          payment?.status,
        ).toBe(
          "paid",
        );
      },
    );

    it(
      "reclaims a stale processing webhook after a crashed request",
      async () => {
        const state =
          await createReservedPaymentState({
            suffix:
              "STALE-RECLAIM",

            expiresAt:
              new Date(
                Date.now() +
                  60_000,
              ),
          });

        await WebhookEvent.create({
          eventId:
            "evt-stale-processing",

          provider:
            "omise",

          paymentId:
            state.paymentId,

          status:
            "processing",
        });

        const oldDate =
          new Date(
            Date.now() -
              10 * 60 * 1000,
          );

        await WebhookEvent
          .collection
          .updateOne(
            {
              eventId:
                "evt-stale-processing",
            },
            {
              $set: {
                updatedAt:
                  oldDate,

                receivedAt:
                  oldDate,
              },
            },
          );

        vi.spyOn(
          omiseProvider,
          "verifyPayment",
        ).mockResolvedValue({
          paid: true,

          status:
            "successful",

          providerPaymentId:
            state
              .providerPaymentId,

          paidAt:
            new Date(),

          amount:
            state.amount,

          currency:
            "THB",
        });

        const response =
          await injectWebhook({
            id:
              "evt-stale-processing",

            key:
              "charge.complete",

            data: {
              id:
                state
                  .providerPaymentId,
            },
          });

        expect(
          response.statusCode,
        ).toBe(200);

        const event =
          await WebhookEvent.findOne({
            eventId:
              "evt-stale-processing",
          });

        expect(
          event?.status,
        ).toBe(
          "processed",
        );
      },
    );

    it(
      "handles two webhook events for the same charge without double-selling",
      async () => {
        const state =
          await createReservedPaymentState({
            suffix:
              "DOUBLE-WEBHOOK",

            expiresAt:
              new Date(
                Date.now() +
                  60_000,
              ),
          });

        const paidAt =
          new Date();

        const verifySpy =
          vi.spyOn(
            omiseProvider,
            "verifyPayment",
          ).mockResolvedValue({
            paid: true,

            status:
              "successful",

            providerPaymentId:
              state
                .providerPaymentId,

            paidAt,

            amount:
              state.amount,

            currency:
              "THB",
          });

        const [
          first,
          second,
        ] =
          await Promise.all([
            injectWebhook({
              id:
                "evt-double-a",

              key:
                "charge.complete",

              data: {
                id:
                  state
                    .providerPaymentId,
              },
            }),

            injectWebhook({
              id:
                "evt-double-b",

              key:
                "charge.complete",

              data: {
                id:
                  state
                    .providerPaymentId,
              },
            }),
          ]);

        expect(
          first.statusCode,
        ).toBe(200);

        expect(
          second.statusCode,
        ).toBe(200);

        expect(
          verifySpy.mock.calls
            .length,
        ).toBeGreaterThanOrEqual(
          1,
        );

        const payment =
          await Payment.findOne({
            paymentId:
              state.paymentId,
          });

        const order =
          await Order.findOne({
            orderId:
              state.orderId,
          });

        const product =
          await Product.findOne({
            productId:
              state.productId,
          });

        expect(
          payment?.status,
        ).toBe(
          "paid",
        );

        expect(
          order?.status,
        ).toBe(
          "paid",
        );

        expect(
          product?.sold,
        ).toBe(1);

        expect(
          await WebhookEvent
            .countDocuments({
              status:
                "processed",
            }),
        ).toBe(2);
      },
    );

    it(
      "rolls back Payment and Order expiration when Stock release fails",
      async () => {
        const state =
          await createReservedPaymentState({
            suffix:
              "EXPIRE-ROLLBACK",
          });

        vi.spyOn(
          Product,
          "updateOne",
        ).mockRejectedValueOnce(
          new Error(
            "simulated stock failure",
          ),
        );

        await expect(
          paymentService
            .expirePayment(
              state.paymentId,
            ),
        ).rejects.toThrow(
          "simulated stock failure",
        );

        const payment =
          await Payment.findOne({
            paymentId:
              state.paymentId,
          });

        const order =
          await Order.findOne({
            orderId:
              state.orderId,
          });

        const product =
          await Product.findOne({
            productId:
              state.productId,
          });

        expect(
          payment?.status,
        ).toBe(
          "pending",
        );

        expect(
          order?.status,
        ).toBe(
          "awaiting_payment",
        );

        expect(
          order?.metadata
            ?.stockReserved,
        ).toBe(true);

        expect(
          order?.metadata
            ?.stockReleased,
        ).toBe(false);

        expect(
          product?.stock,
        ).toBe(0);
      },
    );

    it(
      "keeps Payment Order and Stock consistent when paid and expired race",
      async () => {
        const state =
          await createReservedPaymentState({
            suffix:
              "PAID-EXPIRE-RACE",
          });

        const results =
          await Promise.allSettled([
            paymentService.markPaid(
              state.paymentId,
              state.providerPaymentId,
              new Date(),
            ),

            paymentService
              .expirePayment(
                state.paymentId,
              ),
          ]);

        expect(
          results.some(
            (result) =>
              result.status ===
              "fulfilled",
          ),
        ).toBe(true);

        const payment =
          await Payment.findOne({
            paymentId:
              state.paymentId,
          });

        const order =
          await Order.findOne({
            orderId:
              state.orderId,
          });

        const product =
          await Product.findOne({
            productId:
              state.productId,
          });

        if (
          payment?.status ===
          "paid"
        ) {
          expect(
            order?.status,
          ).toBe(
            "paid",
          );

          expect(
            product?.stock,
          ).toBe(0);

          expect(
            product?.sold,
          ).toBe(1);

          return;
        }

        expect(
          payment?.status,
        ).toBe(
          "expired",
        );

        expect(
          order?.status,
        ).toBe(
          "cancelled",
        );

        expect(
          order?.metadata
            ?.stockReleased,
        ).toBe(true);

        expect(
          product?.stock,
        ).toBe(1);

        expect(
          product?.sold,
        ).toBe(0);
      },
    );

    it(
      "reconciles Order and Payment when a completed Refund is retried",
      async () => {
        const suffix =
          "REFUND-RECONCILE";

        const orderId =
          `ORDER-${suffix}`;

        const paymentId =
          `PAYMENT-${suffix}`;

        const refundId =
          `REFUND-${suffix}`;

        await Order.create({
          orderId,

          buyerId:
            `BUYER-${suffix}`,

          sellerId:
            `SELLER-${suffix}`,

          shopId:
            `SHOP-${suffix}`,

          productId:
            `PRODUCT-${suffix}`,

          productName:
            "Refund Product",

          quantity: 1,

          unitPrice:
            100,

          totalAmount:
            100,

          status:
            "completed",

          paymentMethod:
            "promptpay",

          paymentId,

          paidAt:
            new Date(),

          completedAt:
            new Date(),

          metadata: {
            stockReserved:
              false,

            stockReleased:
              false,
          },
        });

        await Payment.create({
          paymentId,

          orderId,

          buyerId:
            `BUYER-${suffix}`,

          sellerId:
            `SELLER-${suffix}`,

          shopId:
            `SHOP-${suffix}`,

          provider:
            "promptpay",

          amount: 100,

          status:
            "paid",

          providerPaymentId:
            `ch_${suffix}`,

          expiresAt:
            new Date(
              Date.now() +
                60_000,
            ),

          paidAt:
            new Date(),
        });

        await Refund.create({
          refundId,

          orderId,

          paymentId,

          shopId:
            `SHOP-${suffix}`,

          buyerId:
            `BUYER-${suffix}`,

          sellerId:
            `SELLER-${suffix}`,

          provider:
            "omise",

          providerRefundId:
            `rfnd_${suffix}`,

          providerPaymentId:
            `ch_${suffix}`,

          amount: 100,

          currency:
            "THB",

          reason:
            "Phase 2 reconciliation test",

          status:
            "completed",

          requestedBy:
            `BUYER-${suffix}`,

          completedAt:
            new Date(),
        });

        const result =
          await refundService
            .processRefund(
              refundId,
            );

        expect(
          result.status,
        ).toBe(
          "completed",
        );

        const order =
          await Order.findOne({
            orderId,
          });

        const payment =
          await Payment.findOne({
            paymentId,
          });

        expect(
          order?.status,
        ).toBe(
          "refunded",
        );

        expect(
          payment?.status,
        ).toBe(
          "refunded",
        );
      },
    );
  },
);
