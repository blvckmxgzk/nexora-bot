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
  Payment,
} from "../src/models/Payment.ts";

import {
  Order,
} from "../src/models/Order.ts";

import {
  Product,
} from "../src/models/Product.ts";

import {
  SellerLedgerEntry,
} from "../src/models/SellerLedgerEntry.ts";

import {
  SellerFinancialState,
} from "../src/models/SellerFinancialState.ts";

import {
  omiseProvider,
} from "../src/services/payment/providers/omiseProvider.ts";

import {
  paymentService,
} from "../src/services/paymentService.ts";

import {
  sellerLedgerService,
} from "../src/services/sellerLedgerService.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

const originalSecret =
  process.env
    .OMISE_SECRET_KEY;

const originalAccountingFlag =
  process.env
    .NEXORA_TEST_REQUIRE_PAYMENT_ACCOUNTING;

function successfulCharge(
  overrides:
    Record<string, unknown> =
      {},
) {
  return {
    object:
      "charge",

    id:
      "chrg_test_phase59",

    livemode:
      false,

    amount:
      10000,

    funding_amount:
      10000,

    currency:
      "THB",

    funding_currency:
      "THB",

    status:
      "successful",

    fee:
      365,

    fee_vat:
      26,

    net:
      9609,

    paid_at:
      new Date()
        .toISOString(),

    transaction:
      "trxn_test_phase59",

    ...overrides,
  };
}

async function seedPendingPayment(
  suffix:
    string,
) {
  const paymentId =
    `PAY-PH59-${suffix}`;

  const orderId =
    `ORD-PH59-${suffix}`;

  const productId =
    `PROD-PH59-${suffix}`;

  /*
   * Raw collection insert:
   * markPaid ต้องการแค่ productId + sold
   */
  await Product.collection
    .insertOne({
      productId,
      sold:
        0,
      stock:
        10,
      active:
        true,
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
      "Phase59 Test",

    productCategory:
      "other",

    quantity:
      1,

    unitPrice:
      100,

    totalAmount:
      100,

    status:
      "awaiting_payment",

    paymentMethod:
      "promptpay",

    paymentId,

    paymentExpiresAt:
      new Date(
        Date.now() +
        60000,
      ),

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

    amount:
      100,

    status:
      "pending",

    providerPaymentId:
      `chrg_test_${suffix}`,

    expiresAt:
      new Date(
        Date.now() +
        60000,
      ),
  });

  return {
    paymentId,
    orderId,
    productId,
  };
}

beforeAll(
  async () => {
    replSet =
      await MongoMemoryReplSet
        .create({
          /*
           * Codespaces อาจใช้เวลาสตาร์ต mongod
           * เกิน default 10 วินาที
           */
          instanceOpts: [
            {
              launchTimeout:
                60_000,

              storageEngine:
                "wiredTiger",
            },
          ],

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
          "nexora-phase59",
      },
    );

    await Promise.all([
      Payment.syncIndexes(),
      Order.syncIndexes(),
      SellerLedgerEntry
        .syncIndexes(),
      SellerFinancialState
        .syncIndexes(),
    ]);
  },
  120000,
);

afterEach(
  async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    if (
      originalSecret ===
      undefined
    ) {
      delete process.env
        .OMISE_SECRET_KEY;
    } else {
      process.env
        .OMISE_SECRET_KEY =
        originalSecret;
    }

    if (
      originalAccountingFlag ===
      undefined
    ) {
      delete process.env
        .NEXORA_TEST_REQUIRE_PAYMENT_ACCOUNTING;
    } else {
      process.env
        .NEXORA_TEST_REQUIRE_PAYMENT_ACCOUNTING =
        originalAccountingFlag;
    }

    await Promise.all([
      Payment.deleteMany({}),
      Order.deleteMany({}),
      Product.deleteMany({}),
      SellerLedgerEntry
        .deleteMany({}),
      SellerFinancialState
        .deleteMany({}),
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
  120000,
);

describe(
  "NEXORA Marketplace Phase 5.9 payment fee accounting",
  () => {
    it(
      "extracts real Omise Charge fee/net accounting",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase59";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify(
                  successfulCharge(),
                ),
                {
                  status:
                    200,

                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                },
              ),
            ),
        );

        const result =
          await omiseProvider
            .verifyPayment(
              "chrg_test_phase59",
            );

        expect(
          result.paid,
        ).toBe(
          true,
        );

        expect(
          result.accounting,
        ).toEqual({
          grossAmountSatang:
            10000,

          fundingAmountSatang:
            10000,

          providerFeeSatang:
            365,

          providerFeeVatSatang:
            26,

          providerDeductionsSatang:
            391,

          providerNetSatang:
            9609,

          currency:
            "THB",

          fundingCurrency:
            "THB",

          providerTransactionId:
            "trxn_test_phase59",
        });
      },
    );

    it(
      "rejects live Charge response in pre-live mode",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase59";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify(
                  successfulCharge({
                    livemode:
                      true,
                  }),
                ),
                {
                  status:
                    200,
                },
              ),
            ),
        );

        await expect(
          omiseProvider
            .verifyPayment(
              "chrg_test_phase59",
            ),
        ).rejects.toThrow(
          /Live Charge/,
        );
      },
    );

    it(
      "rejects inconsistent provider net accounting",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase59";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify(
                  successfulCharge({
                    net:
                      11000,
                  }),
                ),
                {
                  status:
                    200,
                },
              ),
            ),
        );

        await expect(
          omiseProvider
            .verifyPayment(
              "chrg_test_phase59",
            ),
        ).rejects.toThrow(
          /net/,
        );
      },
    );

    it(
      "stores fee/net accounting atomically when Payment becomes paid",
      async () => {
        process.env
          .NEXORA_TEST_REQUIRE_PAYMENT_ACCOUNTING =
          "1";

        const seeded =
          await seedPendingPayment(
            "PAID",
          );

        const result =
          await paymentService
            .markPaid(
              seeded.paymentId,

              "chrg_test_PAID",

              new Date(),

              {
                grossAmountSatang:
                  10000,

                fundingAmountSatang:
                  10000,

                providerFeeSatang:
                  365,

                providerFeeVatSatang:
                  26,

                providerDeductionsSatang:
                  391,

                providerNetSatang:
                  9609,

                currency:
                  "THB",

                fundingCurrency:
                  "THB",

                providerTransactionId:
                  "trxn_test_paid",
              },
            );

        expect(
          result.status,
        ).toBe(
          "paid",
        );

        expect(
          result.accountingPolicy,
        ).toBe(
          "seller_pays_provider_fee",
        );

        expect(
          result.grossAmountSatang,
        ).toBe(
          10000,
        );

        expect(
          result.providerNetSatang,
        ).toBe(
          9609,
        );

        expect(
          result.sellerNetSatang,
        ).toBe(
          9609,
        );

        expect(
          (
            await Order.findOne({
              orderId:
                seeded.orderId,
            })
          )?.status,
        ).toBe(
          "paid",
        );
      },
    );

    it(
      "fails closed when paid Provider response has no accounting",
      async () => {
        process.env
          .NEXORA_TEST_REQUIRE_PAYMENT_ACCOUNTING =
          "1";

        const seeded =
          await seedPendingPayment(
            "NO-ACCOUNTING",
          );

        await expect(
          paymentService
            .markPaid(
              seeded.paymentId,

              "chrg_test_NO-ACCOUNTING",
            ),
        ).rejects.toThrow(
          /fee\/net accounting/,
        );

        expect(
          (
            await Payment.findOne({
              paymentId:
                seeded.paymentId,
            })
          )?.status,
        ).toBe(
          "pending",
        );

        expect(
          (
            await Order.findOne({
              orderId:
                seeded.orderId,
            })
          )?.status,
        ).toBe(
          "awaiting_payment",
        );
      },
    );

    it(
      "credits Seller provider net instead of gross",
      async () => {
        await Payment.create({
          paymentId:
            "PAY-PH59-NET",

          orderId:
            "ORD-PH59-NET",

          buyerId:
            "BUYER-NET",

          sellerId:
            "SELLER-NET",

          shopId:
            "SHOP-NET",

          provider:
            "promptpay",

          amount:
            100,

          status:
            "paid",

          providerPaymentId:
            "chrg_test_net",

          expiresAt:
            new Date(),

          grossAmountSatang:
            10000,

          fundingAmountSatang:
            10000,

          providerFeeSatang:
            365,

          providerFeeVatSatang:
            26,

          providerDeductionsSatang:
            391,

          providerNetSatang:
            9609,

          sellerNetSatang:
            9609,

          accountingPolicy:
            "seller_pays_provider_fee",

          accountingVerifiedAt:
            new Date(),
        });

        const session =
          await mongoose.startSession();

        try {
          await session
            .withTransaction(
              async () => {
                await sellerLedgerService
                  .creditCompletedOrder(
                    {
                      orderId:
                        "ORD-PH59-NET",

                      sellerId:
                        "SELLER-NET",

                      shopId:
                        "SHOP-NET",

                      totalAmount:
                        100,

                      paymentId:
                        "PAY-PH59-NET",
                    },

                    session,
                  );
              },
            );
        } finally {
          await session.endSession();
        }

        const entry =
          await SellerLedgerEntry
            .findOne({
              sourceKey:
                "sale:ORD-PH59-NET",
            });

        expect(
          entry?.amountSatang,
        ).toBe(
          9609,
        );

        expect(
          entry?.metadata
            ?.grossAmountSatang,
        ).toBe(
          10000,
        );

        expect(
          entry?.metadata
            ?.platformFeeSatang,
        ).toBe(
          0,
        );
      },
    );

    it(
      "full refund debits original Seller net credit rather than gross",
      async () => {
        await SellerLedgerEntry.create({
          ledgerEntryId:
            "LED-PH59-REFUND-SALE",

          sourceKey:
            "sale:ORD-PH59-REFUND",

          sellerId:
            "SELLER-REFUND",

          shopId:
            "SHOP-REFUND",

          orderId:
            "ORD-PH59-REFUND",

          type:
            "sale_credit",

          amountSatang:
            9609,

          currency:
            "THB",

          metadata: {
            paymentId:
              "PAY-PH59-REFUND",

            accountingPolicy:
              "seller_pays_provider_fee",

            grossAmountSatang:
              10000,

            sellerNetSatang:
              9609,
          },
        });

        const session =
          await mongoose.startSession();

        try {
          await session
            .withTransaction(
              async () => {
                await sellerLedgerService
                  .debitRefundIfCredited(
                    {
                      refundId:
                        "REF-PH59",

                      orderId:
                        "ORD-PH59-REFUND",

                      sellerId:
                        "SELLER-REFUND",

                      shopId:
                        "SHOP-REFUND",

                      paymentId:
                        "PAY-PH59-REFUND",

                      amount:
                        100,
                    },

                    session,
                  );
              },
            );
        } finally {
          await session.endSession();
        }

        const debit =
          await SellerLedgerEntry
            .findOne({
              sourceKey:
                "refund:REF-PH59",
            });

        expect(
          debit?.amountSatang,
        ).toBe(
          -9609,
        );

        expect(
          debit?.metadata
            ?.refundGrossAmountSatang,
        ).toBe(
          10000,
        );
      },
    );

    it(
      "rejects refund gross that does not match original sale gross",
      async () => {
        await SellerLedgerEntry.create({
          ledgerEntryId:
            "LED-PH59-BAD-REFUND",

          sourceKey:
            "sale:ORD-PH59-BAD",

          sellerId:
            "SELLER-BAD",

          shopId:
            "SHOP-BAD",

          orderId:
            "ORD-PH59-BAD",

          type:
            "sale_credit",

          amountSatang:
            9609,

          currency:
            "THB",

          metadata: {
            grossAmountSatang:
              10000,
          },
        });

        const session =
          await mongoose.startSession();

        try {
          await expect(
            session.withTransaction(
              async () => {
                await sellerLedgerService
                  .debitRefundIfCredited(
                    {
                      refundId:
                        "REF-PH59-BAD",

                      orderId:
                        "ORD-PH59-BAD",

                      sellerId:
                        "SELLER-BAD",

                      shopId:
                        "SHOP-BAD",

                      paymentId:
                        "PAY-PH59-BAD",

                      amount:
                        90,
                    },

                    session,
                  );
              },
            ),
          ).rejects.toThrow(
            /gross/,
          );
        } finally {
          await session.endSession();
        }
      },
    );

    it(
      "keeps legacy gross credit behavior when Payment accounting does not exist",
      async () => {
        const session =
          await mongoose.startSession();

        try {
          await session
            .withTransaction(
              async () => {
                await sellerLedgerService
                  .creditCompletedOrder(
                    {
                      orderId:
                        "ORD-PH59-LEGACY",

                      sellerId:
                        "SELLER-LEGACY",

                      shopId:
                        "SHOP-LEGACY",

                      totalAmount:
                        100,

                      paymentId:
                        null,
                    },

                    session,
                  );
              },
            );
        } finally {
          await session.endSession();
        }

        expect(
          (
            await SellerLedgerEntry
              .findOne({
                sourceKey:
                  "sale:ORD-PH59-LEGACY",
              })
          )?.amountSatang,
        ).toBe(
          10000,
        );
      },
    );
  },
);
