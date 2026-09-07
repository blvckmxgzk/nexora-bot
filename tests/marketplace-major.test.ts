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

import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  Shop,
} from "../src/models/Shop.ts";

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
  Review,
} from "../src/models/Review.ts";

import {
  Refund,
} from "../src/models/Refund.ts";

import {
  WebhookEvent,
} from "../src/models/WebhookEvent.ts";

import {
  orderService,
} from "../src/services/orderService.ts";

import {
  paymentService,
} from "../src/services/paymentService.ts";

import {
  reviewService,
} from "../src/services/reviewService.ts";

import {
  refundService,
} from "../src/services/refundService.ts";

import {
  omiseProvider,
} from "../src/services/payment/providers/omiseProvider.ts";

const SHOP_ID =
  "SHOP-TEST";

const PRODUCT_ID =
  "PROD-TEST";

const SELLER_ID =
  "SELLER-TEST";

const BUYER_ID =
  "BUYER-TEST";

let replSet:
  | MongoMemoryReplSet
  | undefined;

async function seedCatalog(
  stock = 1,
  price = 100,
) {
  await Shop.create({
    shopId:
      SHOP_ID,

    ownerId:
      SELLER_ID,

    name:
      "NEXORA Test Shop",

    description:
      "Marketplace integration test",

    category:
      "other",

    status:
      "verified",

    timezone:
      "UTC",

    autoOpenClose:
      true,

    businessHours: {
      monday: {
        enabled: true,
        open: "00:00",
        close: "23:59",
      },

      tuesday: {
        enabled: true,
        open: "00:00",
        close: "23:59",
      },

      wednesday: {
        enabled: true,
        open: "00:00",
        close: "23:59",
      },

      thursday: {
        enabled: true,
        open: "00:00",
        close: "23:59",
      },

      friday: {
        enabled: true,
        open: "00:00",
        close: "23:59",
      },

      saturday: {
        enabled: true,
        open: "00:00",
        close: "23:59",
      },

      sunday: {
        enabled: true,
        open: "00:00",
        close: "23:59",
      },
    },
  });

  await Product.create({
    productId:
      PRODUCT_ID,

    shopId:
      SHOP_ID,

    ownerId:
      SELLER_ID,

    name:
      "Test Product",

    description:
      "Test Product",

    price,

    stock,

    sold: 0,

    active: true,
  });
}

async function createPendingPaymentState(
  options: {
    paymentId?: string;
    orderId?: string;
    providerPaymentId?: string;
    amount?: number;
    expiresAt?: Date;
  } = {},
) {
  const paymentId =
    options.paymentId ??
    "PAY-TEST";

  const orderId =
    options.orderId ??
    "ORDER-PAY-TEST";

  const providerPaymentId =
    options.providerPaymentId ??
    "ch_test_nexora";

  const amount =
    options.amount ??
    100;

  const expiresAt =
    options.expiresAt ??
    new Date(
      Date.now() -
        60_000,
    );

  await seedCatalog(
    0,
    amount,
  );

  await Order.create({
    orderId,

    buyerId:
      BUYER_ID,

    sellerId:
      SELLER_ID,

    shopId:
      SHOP_ID,

    productId:
      PRODUCT_ID,

    productName:
      "Test Product",

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
      BUYER_ID,

    sellerId:
      SELLER_ID,

    shopId:
      SHOP_ID,

    provider:
      "promptpay",

    amount,

    status:
      "pending",

    providerPaymentId,

    expiresAt,
  });

  return {
    paymentId,
    orderId,
    providerPaymentId,
    amount,
    expiresAt,
  };
}

beforeAll(
  async () => {
    replSet =
      await MongoMemoryReplSet
        .create({
          instanceOpts: [
            {
              /*
               * Codespaces อาจใช้เวลาสตาร์ต mongod
               * เกิน default 10 วินาที
               */
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
          "nexora-marketplace-test",
      },
    );

    await Promise.all([
      Shop.syncIndexes(),
      Product.syncIndexes(),
      Order.syncIndexes(),
      Payment.syncIndexes(),
      Review.syncIndexes(),
      Refund.syncIndexes(),
      WebhookEvent.syncIndexes(),
    ]);
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
    Shop.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    Payment.deleteMany({}),
    Review.deleteMany({}),
    Refund.deleteMany({}),
    WebhookEvent.deleteMany({}),
  ]);
});

afterAll(async () => {
  if (
    mongoose.connection.readyState !==
    0
  ) {
    await mongoose.disconnect();
  }

  if (replSet) {
    await replSet.stop();
  }
});

describe(
  "NEXORA Marketplace major lifecycle",
  () => {
    it(
      "prevents overselling when two buyers race for the last item",
      async () => {
        await seedCatalog(
          1,
          100,
        );

        const results =
          await Promise.allSettled([
            orderService.createOrder({
              buyerId:
                "BUYER-A",

              sellerId:
                SELLER_ID,

              shopId:
                SHOP_ID,

              productId:
                PRODUCT_ID,

              productName:
                "Test Product",

              quantity: 1,

              unitPrice:
                100,
            }),

            orderService.createOrder({
              buyerId:
                "BUYER-B",

              sellerId:
                SELLER_ID,

              shopId:
                SHOP_ID,

              productId:
                PRODUCT_ID,

              productName:
                "Test Product",

              quantity: 1,

              unitPrice:
                100,
            }),
          ]);

        expect(
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          ),
        ).toHaveLength(1);

        expect(
          results.filter(
            (result) =>
              result.status ===
              "rejected",
          ),
        ).toHaveLength(1);

        const product =
          await Product.findOne({
            productId:
              PRODUCT_ID,
          });

        expect(
          product?.stock,
        ).toBe(0);

        expect(
          await Order.countDocuments(),
        ).toBe(1);
      },
    );

    it(
      "releases reserved stock only once when Order cancellation is retried",
      async () => {
        await seedCatalog(
          2,
          100,
        );

        const order =
          await orderService
            .createOrder({
              buyerId:
                BUYER_ID,

              sellerId:
                SELLER_ID,

              shopId:
                SHOP_ID,

              productId:
                PRODUCT_ID,

              productName:
                "Test Product",

              quantity: 1,

              unitPrice:
                100,
            });

        expect(
          (
            await Product.findOne({
              productId:
                PRODUCT_ID,
            })
          )?.stock,
        ).toBe(1);

        await orderService
          .cancelOrder(
            order.orderId,
            "test",
          );

        await orderService
          .cancelOrder(
            order.orderId,
            "test retry",
          );

        const product =
          await Product.findOne({
            productId:
              PRODUCT_ID,
          });

        const cancelled =
          await Order.findOne({
            orderId:
              order.orderId,
          });

        expect(
          product?.stock,
        ).toBe(2);

        expect(
          cancelled?.status,
        ).toBe(
          "cancelled",
        );

        expect(
          cancelled?.metadata
            ?.stockReleased,
        ).toBe(true);
      },
    );

    it(
      "accepts a successful provider payment even when local expiry time already passed",
      async () => {
        const state =
          await createPendingPaymentState();

        const paidAt =
          new Date(
            state.expiresAt
              .getTime() -
              10_000,
          );

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

        const result =
          await paymentService
            .verifyPayment(
              state.paymentId,
            );

        expect(
          result.status,
        ).toBe("paid");

        expect(
          verifySpy,
        ).toHaveBeenCalledTimes(
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
              PRODUCT_ID,
          });

        expect(
          payment?.status,
        ).toBe("paid");

        expect(
          payment?.paidAt
            ?.getTime(),
        ).toBe(
          paidAt.getTime(),
        );

        expect(
          order?.status,
        ).toBe("paid");

        expect(
          product?.sold,
        ).toBe(1);

        await paymentService
          .verifyPayment(
            state.paymentId,
          );

        expect(
          verifySpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          (
            await Product.findOne({
              productId:
                PRODUCT_ID,
            })
          )?.sold,
        ).toBe(1);
      },
    );

    it(
      "releases stock once when provider confirms expiration",
      async () => {
        const state =
          await createPendingPaymentState({
            providerPaymentId:
              "ch_expired_test",
          });

        const verifySpy =
          vi.spyOn(
            omiseProvider,
            "verifyPayment",
          ).mockResolvedValue({
            paid: false,

            status:
              "expired",

            providerPaymentId:
              state
                .providerPaymentId,
          });

        const result =
          await paymentService
            .verifyPayment(
              state.paymentId,
            );

        expect(
          result.status,
        ).toBe("expired");

        await paymentService
          .verifyPayment(
            state.paymentId,
          );

        expect(
          verifySpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        const order =
          await Order.findOne({
            orderId:
              state.orderId,
          });

        const product =
          await Product.findOne({
            productId:
              PRODUCT_ID,
          });

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
      },
    );

    it(
      "releases stock once when provider reports a failed payment",
      async () => {
        const state =
          await createPendingPaymentState({
            providerPaymentId:
              "ch_failed_test",
          });

        const verifySpy =
          vi.spyOn(
            omiseProvider,
            "verifyPayment",
          ).mockResolvedValue({
            paid: false,

            status:
              "failed",

            providerPaymentId:
              state
                .providerPaymentId,
          });

        const result =
          await paymentService
            .verifyPayment(
              state.paymentId,
            );

        expect(
          result.status,
        ).toBe("failed");

        await paymentService
          .verifyPayment(
            state.paymentId,
          );

        expect(
          verifySpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          (
            await Product.findOne({
              productId:
                PRODUCT_ID,
            })
          )?.stock,
        ).toBe(1);

        expect(
          (
            await Order.findOne({
              orderId:
                state.orderId,
            })
          )?.status,
        ).toBe(
          "cancelled",
        );
      },
    );

    it(
      "allows only one Review for a completed Order under concurrency",
      async () => {
        await seedCatalog(
          0,
          100,
        );

        await Order.create({
          orderId:
            "ORDER-REVIEW",

          buyerId:
            BUYER_ID,

          sellerId:
            SELLER_ID,

          shopId:
            SHOP_ID,

          productId:
            PRODUCT_ID,

          productName:
            "Test Product",

          quantity: 1,

          unitPrice: 100,

          totalAmount:
            100,

          status:
            "completed",

          paymentMethod:
            "promptpay",

          metadata: {
            stockReserved:
              false,

            stockReleased:
              false,
          },
        });

        const results =
          await Promise.allSettled([
            reviewService
              .createReview({
                orderId:
                  "ORDER-REVIEW",

                buyerId:
                  BUYER_ID,

                rating: 5,

                comment:
                  "Excellent",
              }),

            reviewService
              .createReview({
                orderId:
                  "ORDER-REVIEW",

                buyerId:
                  BUYER_ID,

                rating: 5,

                comment:
                  "Duplicate",
              }),
          ]);

        expect(
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          ),
        ).toHaveLength(1);

        expect(
          await Review.countDocuments({
            orderId:
              "ORDER-REVIEW",
          }),
        ).toBe(1);

        const shop =
          await Shop.findOne({
            shopId:
              SHOP_ID,
          });

        expect(
          shop?.reviewCount,
        ).toBe(1);

        expect(
          shop?.rating,
        ).toBe(5);
      },
    );

    it(
      "allows only one effective Refund request per Order under concurrency",
      async () => {
        await seedCatalog(
          0,
          100,
        );

        await Order.create({
          orderId:
            "ORDER-REFUND",

          buyerId:
            BUYER_ID,

          sellerId:
            SELLER_ID,

          shopId:
            SHOP_ID,

          productId:
            PRODUCT_ID,

          productName:
            "Test Product",

          quantity: 1,

          unitPrice: 100,

          totalAmount:
            100,

          status:
            "paid",

          paymentMethod:
            "promptpay",

          paymentId:
            "PAY-REFUND",

          paidAt:
            new Date(),

          metadata: {
            stockReserved:
              false,

            stockReleased:
              false,
          },
        });

        await Payment.create({
          paymentId:
            "PAY-REFUND",

          orderId:
            "ORDER-REFUND",

          buyerId:
            BUYER_ID,

          sellerId:
            SELLER_ID,

          shopId:
            SHOP_ID,

          provider:
            "promptpay",

          amount: 100,

          status:
            "paid",

          providerPaymentId:
            "ch_refund_test",

          expiresAt:
            new Date(
              Date.now() +
                60_000,
            ),

          paidAt:
            new Date(),
        });

        const results =
          await Promise.allSettled([
            refundService
              .requestRefund(
                "ORDER-REFUND",
                BUYER_ID,
                "test refund",
              ),

            refundService
              .requestRefund(
                "ORDER-REFUND",
                BUYER_ID,
                "duplicate refund",
              ),
          ]);

        expect(
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          ),
        ).toHaveLength(1);

        expect(
          await Refund.countDocuments({
            orderId:
              "ORDER-REFUND",
          }),
        ).toBe(1);
      },
    );

    it(
      "has the effective Refund uniqueness index installed",
      async () => {
        const indexes =
          await Refund.collection
            .indexes();

        expect(
          indexes.some(
            (index) =>
              index.name ===
              "uniq_effective_refund_per_order",
          ),
        ).toBe(true);
      },
    );
  },
);
