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
  Refund,
} from "../src/models/Refund.ts";

import {
  SellerLedgerEntry,
} from "../src/models/SellerLedgerEntry.ts";

import {
  orderService,
} from "../src/services/orderService.ts";

import {
  refundService,
} from "../src/services/refundService.ts";

import {
  sellerLedgerService,
} from "../src/services/sellerLedgerService.ts";

import {
  omiseRefundProvider,
} from "../src/services/payment/providers/omiseRefundProvider.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

async function seedPaidOrder(
  suffix: string,
  provider:
    | "promptpay"
    | "truemoney",
  amount = 100.25,
) {
  const shopId =
    `SHOP-${suffix}`;

  const sellerId =
    `SELLER-${suffix}`;

  const buyerId =
    `BUYER-${suffix}`;

  const orderId =
    `ORDER-${suffix}`;

  const paymentId =
    `PAY-${suffix}`;

  await Shop.create({
    shopId,

    ownerId:
      sellerId,

    name:
      "Financial Test Shop",

    description:
      "Phase 5.2",

    category:
      "other",

    status:
      "verified",

    completedOrders:
      0,
  });

  await Order.create({
    orderId,
    buyerId,
    sellerId,
    shopId,

    productId:
      `PRODUCT-${suffix}`,

    productName:
      "Financial Product",

    quantity:
      1,

    unitPrice:
      amount,

    totalAmount:
      amount,

    status:
      "paid",

    paymentMethod:
      provider,

    paymentId,

    paidAt:
      new Date(),

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
    buyerId,
    sellerId,
    shopId,

    provider,

    amount,

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

  return {
    shopId,
    sellerId,
    buyerId,
    orderId,
    paymentId,
    amount,
    providerPaymentId:
      `ch_${suffix}`,
  };
}

async function seedApprovedRefund(
  state:
    Awaited<
      ReturnType<
        typeof seedPaidOrder
      >
    >,
) {
  return Refund.create({
    refundId:
      `REF-${state.orderId}`,

    orderId:
      state.orderId,

    paymentId:
      state.paymentId,

    shopId:
      state.shopId,

    buyerId:
      state.buyerId,

    sellerId:
      state.sellerId,

    provider:
      "omise",

    providerPaymentId:
      state.providerPaymentId,

    amount:
      state.amount,

    currency:
      "THB",

    reason:
      "Phase 5.2 refund test",

    status:
      "approved",

    requestedBy:
      state.buyerId,

    approvedBy:
      state.sellerId,

    approvedAt:
      new Date(),
  });
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
          "nexora-marketplace-phase52",
      },
    );

    await Promise.all([
      Shop.syncIndexes(),
      Order.syncIndexes(),
      Payment.syncIndexes(),
      Refund.syncIndexes(),
      SellerLedgerEntry
        .syncIndexes(),
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
    Order.deleteMany({}),
    Payment.deleteMany({}),
    Refund.deleteMany({}),
    SellerLedgerEntry
      .deleteMany({}),
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
  "NEXORA Marketplace Phase 5.2 financial ledger",
  () => {
    it(
      "credits completed Order exactly once in satang",
      async () => {
        const state =
          await seedPaidOrder(
            "SALE-CREDIT",
            "truemoney",
            100.25,
          );

        const first =
          await orderService
            .markCompleted(
              state.orderId,
            );

        const second =
          await orderService
            .markCompleted(
              state.orderId,
            );

        expect(
          first.status,
        ).toBe(
          "completed",
        );

        expect(
          second.status,
        ).toBe(
          "completed",
        );

        const entries =
          await SellerLedgerEntry
            .find({
              sellerId:
                state.sellerId,
            });

        expect(
          entries,
        ).toHaveLength(
          1,
        );

        expect(
          entries[0]
            ?.type,
        ).toBe(
          "sale_credit",
        );

        expect(
          entries[0]
            ?.amountSatang,
        ).toBe(
          10025,
        );

        expect(
          entries[0]
            ?.sourceKey,
        ).toBe(
          `sale:${state.orderId}`,
        );

        expect(
          await sellerLedgerService
            .getAvailableBalanceSatang(
              state.sellerId,
            ),
        ).toBe(
          10025,
        );
      },
    );

    it(
      "rolls back Order completion when ledger credit fails",
      async () => {
        const state =
          await seedPaidOrder(
            "LEDGER-ROLLBACK",
            "truemoney",
            100,
          );

        vi.spyOn(
          SellerLedgerEntry
            .prototype as any,
          "save",
        ).mockRejectedValueOnce(
          new Error(
            "simulated ledger failure",
          ),
        );

        await expect(
          orderService
            .markCompleted(
              state.orderId,
            ),
        ).rejects.toThrow(
          "simulated ledger failure",
        );

        const order =
          await Order.findOne({
            orderId:
              state.orderId,
          });

        const shop =
          await Shop.findOne({
            shopId:
              state.shopId,
          });

        expect(
          order?.status,
        ).toBe(
          "paid",
        );

        expect(
          shop?.completedOrders,
        ).toBe(
          0,
        );

        expect(
          await SellerLedgerEntry
            .countDocuments({}),
        ).toBe(
          0,
        );
      },
    );

    it(
      "blocks PromptPay automatic refund before calling Omise refund API",
      async () => {
        const state =
          await seedPaidOrder(
            "PROMPTPAY-GUARD",
            "promptpay",
            100,
          );

        const refund =
          await seedApprovedRefund(
            state,
          );

        const findSpy =
          vi.spyOn(
            omiseRefundProvider,
            "findExistingRefund",
          );

        const createSpy =
          vi.spyOn(
            omiseRefundProvider,
            "createRefund",
          );

        await expect(
          refundService
            .processRefund(
              refund.refundId,
            ),
        ).rejects.toThrow(
          /PromptPay/,
        );

        expect(
          findSpy,
        ).not.toHaveBeenCalled();

        expect(
          createSpy,
        ).not.toHaveBeenCalled();

        const current =
          await Refund.findOne({
            refundId:
              refund.refundId,
          });

        expect(
          current?.status,
        ).toBe(
          "approved",
        );
      },
    );

    it(
      "debits completed seller credit when TrueMoney refund completes",
      async () => {
        const state =
          await seedPaidOrder(
            "REFUND-DEBIT",
            "truemoney",
            100,
          );

        await orderService
          .markCompleted(
            state.orderId,
          );

        const refund =
          await seedApprovedRefund(
            state,
          );

        vi.spyOn(
          omiseRefundProvider,
          "findExistingRefund",
        ).mockResolvedValue({
          providerRefundId:
            "rfnd_existing",

          status:
            "successful",

          amount:
            100,

          currency:
            "THB",

          voided:
            false,
        });

        const result =
          await refundService
            .processRefund(
              refund.refundId,
            );

        expect(
          result.status,
        ).toBe(
          "completed",
        );

        const entries =
          await SellerLedgerEntry
            .find({
              sellerId:
                state.sellerId,
            })
            .sort({
              createdAt:
                1,
            });

        expect(
          entries,
        ).toHaveLength(
          2,
        );

        expect(
          entries.map(
            (entry) =>
              entry.amountSatang,
          ),
        ).toEqual([
          10000,
          -10000,
        ]);

        expect(
          await sellerLedgerService
            .getAvailableBalanceSatang(
              state.sellerId,
            ),
        ).toBe(
          0,
        );

        const order =
          await Order.findOne({
            orderId:
              state.orderId,
          });

        const payment =
          await Payment.findOne({
            paymentId:
              state.paymentId,
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

    it(
      "does not debit ledger when Order is refunded before seller credit",
      async () => {
        const state =
          await seedPaidOrder(
            "PRE-COMPLETE-REFUND",
            "truemoney",
            100,
          );

        const refund =
          await seedApprovedRefund(
            state,
          );

        vi.spyOn(
          omiseRefundProvider,
          "findExistingRefund",
        ).mockResolvedValue({
          providerRefundId:
            "rfnd_precomplete",

          status:
            "successful",

          amount:
            100,

          currency:
            "THB",

          voided:
            false,
        });

        await refundService
          .processRefund(
            refund.refundId,
          );

        expect(
          await SellerLedgerEntry
            .countDocuments({
              sellerId:
                state.sellerId,
            }),
        ).toBe(
          0,
        );

        expect(
          await sellerLedgerService
            .getAvailableBalanceSatang(
              state.sellerId,
            ),
        ).toBe(
          0,
        );
      },
    );
  },
);
