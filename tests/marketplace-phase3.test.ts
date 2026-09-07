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
  Order,
} from "../src/models/Order.ts";

import {
  Payment,
} from "../src/models/Payment.ts";

import {
  paymentService,
} from "../src/services/paymentService.ts";

import {
  paymentAccountService,
} from "../src/services/paymentAccountService.ts";

import {
  omiseProvider,
} from "../src/services/payment/providers/omiseProvider.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

async function seedOrder(
  suffix: string,
) {
  const shopId =
    `SHOP-${suffix}`;

  const orderId =
    `ORDER-${suffix}`;

  const buyerId =
    `BUYER-${suffix}`;

  const sellerId =
    `SELLER-${suffix}`;

  await Shop.create({
    shopId,
    ownerId:
      sellerId,

    name:
      "Phase 3 Shop",

    description:
      "Payment concurrency test",

    category:
      "other",

    status:
      "verified",
  });

  await Order.create({
    orderId,

    buyerId,
    sellerId,
    shopId,

    productId:
      `PRODUCT-${suffix}`,

    productName:
      "Phase 3 Product",

    quantity: 1,

    unitPrice: 100,
    totalAmount: 100,

    status:
      "pending",

    paymentMethod:
      "none",

    metadata: {
      stockReserved:
        true,

      stockReleased:
        false,
    },
  });

  return {
    shopId,
    orderId,
    buyerId,
    sellerId,
  };
}

beforeAll(
  async () => {
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
          "nexora-marketplace-phase3",
      },
    );

    await Promise.all([
      Shop.syncIndexes(),
      Order.syncIndexes(),
      Payment.syncIndexes(),
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

  vi.spyOn(
    paymentAccountService,
    "getPaymentTarget",
  ).mockResolvedValue({
    account:
      "0812345678",

    displayName:
      "Phase 3 Account",
  });
});

afterEach(async () => {
  vi.restoreAllMocks();

  await Promise.all([
    Shop.deleteMany({}),
    Order.deleteMany({}),
    Payment.deleteMany({}),
  ]);
});

afterAll(async () => {
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
  "NEXORA Marketplace Phase 3 payment creation",
  () => {
    it(
      "creates only one provider Charge when identical requests race",
      async () => {
        const state =
          await seedOrder(
            "SAME-PROVIDER",
          );

        const providerExpiresAt =
          new Date(
            Date.now() +
              15 * 60 * 1000,
          );

        const createSpy =
          vi.spyOn(
            omiseProvider,
            "createPayment",
          ).mockImplementation(
            async (input) => {
              await new Promise<void>(
                (resolve) => {
                  setTimeout(
                    resolve,
                    100,
                  );
                },
              );

              return {
                provider:
                  input.provider,

                providerPaymentId:
                  "ch_single",

                paymentReference:
                  "REF-SINGLE",

                qrData:
                  "https://example.test/qr",

                paymentUrl:
                  null,

                instructions:
                  "test",

                expiresAt:
                  providerExpiresAt,
              };
            },
          );

        const [
          first,
          second,
        ] =
          await Promise.all([
            paymentService
              .createPayment({
                orderId:
                  state.orderId,

                buyerId:
                  state.buyerId,

                provider:
                  "promptpay",
              }),

            paymentService
              .createPayment({
                orderId:
                  state.orderId,

                buyerId:
                  state.buyerId,

                provider:
                  "promptpay",
              }),
          ]);

        expect(
          createSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          first.paymentId,
        ).toBe(
          second.paymentId,
        );

        expect(
          first.providerPaymentId,
        ).toBe(
          "ch_single",
        );

        expect(
          second.providerPaymentId,
        ).toBe(
          "ch_single",
        );

        expect(
          await Payment.countDocuments({
            orderId:
              state.orderId,
          }),
        ).toBe(1);

        const order =
          await Order.findOne({
            orderId:
              state.orderId,
          });

        expect(
          order?.status,
        ).toBe(
          "awaiting_payment",
        );

        expect(
          order?.paymentId,
        ).toBe(
          first.paymentId,
        );

        expect(
          first.expiresAt
            .getTime(),
        ).toBe(
          providerExpiresAt
            .getTime(),
        );
      },
    );

    it(
      "recovers an existing Omise Charge after a creation crash without creating another",
      async () => {
        const state =
          await seedOrder(
            "RECOVERY",
          );

        await Order.updateOne(
          {
            orderId:
              state.orderId,
          },
          {
            $set: {
              status:
                "awaiting_payment",

              paymentMethod:
                "promptpay",

              paymentId:
                "PAY-RECOVERY",
            },
          },
        );

        await Payment.create({
          paymentId:
            "PAY-RECOVERY",

          orderId:
            state.orderId,

          buyerId:
            state.buyerId,

          sellerId:
            state.sellerId,

          shopId:
            state.shopId,

          provider:
            "promptpay",

          amount: 100,

          status:
            "creating",

          providerPaymentId:
            null,

          expiresAt:
            new Date(
              Date.now() +
                60_000,
            ),

          metadata: {
            creationLastError:
              "simulated crash",
          },
        });

        const createSpy =
          vi.spyOn(
            omiseProvider,
            "createPayment",
          );

        vi.spyOn(
          omiseProvider,
          "findExistingPayment",
        ).mockResolvedValue({
          provider:
            "promptpay",

          providerPaymentId:
            "ch_recovered",

          paymentReference:
            "REF-RECOVERED",

          qrData:
            "https://example.test/recovered",

          expiresAt:
            new Date(
              Date.now() +
                60_000,
            ),
        });

        const result =
          await paymentService
            .createPayment({
              orderId:
                state.orderId,

              buyerId:
                state.buyerId,

              provider:
                "promptpay",
            });

        expect(
          createSpy,
        ).not.toHaveBeenCalled();

        expect(
          result.status,
        ).toBe(
          "pending",
        );

        expect(
          result.providerPaymentId,
        ).toBe(
          "ch_recovered",
        );

        expect(
          await Payment.countDocuments({
            orderId:
              state.orderId,
          }),
        ).toBe(1);
      },
      15_000,
    );

    it(
      "does not create a second Charge after an ambiguous provider failure",
      async () => {
        const state =
          await seedOrder(
            "AMBIGUOUS",
          );

        const createSpy =
          vi.spyOn(
            omiseProvider,
            "createPayment",
          ).mockRejectedValue(
            new Error(
              "network timeout",
            ),
          );

        await expect(
          paymentService
            .createPayment({
              orderId:
                state.orderId,

              buyerId:
                state.buyerId,

              provider:
                "promptpay",
            }),
        ).rejects.toThrow(
          "network timeout",
        );

        const payment =
          await Payment.findOne({
            orderId:
              state.orderId,
          });

        expect(
          payment?.status,
        ).toBe(
          "creating",
        );

        vi.spyOn(
          omiseProvider,
          "findExistingPayment",
        ).mockResolvedValue(
          null,
        );

        await expect(
          paymentService
            .createPayment({
              orderId:
                state.orderId,

              buyerId:
                state.buyerId,

              provider:
                "promptpay",
            }),
        ).rejects.toThrow(
          /ไม่สร้าง QR ซ้ำ/,
        );

        expect(
          createSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          await Payment.countDocuments({
            orderId:
              state.orderId,
          }),
        ).toBe(1);
      },
      15_000,
    );

    it(
      "allows only one payment provider to win a cross-provider race",
      async () => {
        const state =
          await seedOrder(
            "CROSS-PROVIDER",
          );

        const createSpy =
          vi.spyOn(
            omiseProvider,
            "createPayment",
          ).mockImplementation(
            async (input) => {
              await new Promise<void>(
                (resolve) => {
                  setTimeout(
                    resolve,
                    100,
                  );
                },
              );

              return {
                provider:
                  input.provider,

                providerPaymentId:
                  `ch_${input.provider}`,

                paymentReference:
                  `REF-${input.provider}`,
              };
            },
          );

        const results =
          await Promise.allSettled([
            paymentService
              .createPayment({
                orderId:
                  state.orderId,

                buyerId:
                  state.buyerId,

                provider:
                  "promptpay",
              }),

            paymentService
              .createPayment({
                orderId:
                  state.orderId,

                buyerId:
                  state.buyerId,

                provider:
                  "truemoney",
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

        expect(
          createSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          await Payment.countDocuments({
            orderId:
              state.orderId,
          }),
        ).toBe(1);
      },
      15_000,
    );
  },
);
