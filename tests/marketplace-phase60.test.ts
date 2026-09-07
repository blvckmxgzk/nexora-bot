import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

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
  Refund,
} from "../src/models/Refund.ts";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  SellerLedgerEntry,
} from "../src/models/SellerLedgerEntry.ts";

import {
  SellerFinancialState,
} from "../src/models/SellerFinancialState.ts";

import {
  sellerLedgerService,
} from "../src/services/sellerLedgerService.ts";

import {
  backfillLegacyPaymentAccounting,
} from "../src/services/marketplace/preLiveFinancialMigrationService.ts";

import {
  runPreLiveFinancialAudit,
} from "../src/services/marketplace/preLiveFinancialAuditService.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

function providerResult(
  paymentId:
    string,
) {
  return {
    paid:
      true,

    status:
      "successful",

    providerPaymentId:
      paymentId,

    amount:
      100,

    currency:
      "THB",

    paidAt:
      new Date(),

    accounting: {
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
        "trxn_test_phase60",
    },
  };
}

async function seedLegacy(
  suffix:
    string,

  status:
    "paid" |
    "refunded" =
      "paid",
) {
  const paymentId =
    `PAY-PH60-${suffix}`;

  const orderId =
    `ORD-PH60-${suffix}`;

  const sellerId =
    `SELLER-PH60-${suffix}`;

  const shopId =
    `SHOP-PH60-${suffix}`;

  await Payment.create({
    paymentId,

    orderId,

    buyerId:
      `BUYER-${suffix}`,

    sellerId,

    shopId,

    provider:
      "promptpay",

    amount:
      100,

    status,

    providerPaymentId:
      `chrg_test_${suffix}`,

    expiresAt:
      new Date(),
  });

  await SellerLedgerEntry
    .create({
      ledgerEntryId:
        `LED-PH60-${suffix}`,

      sourceKey:
        `sale:${orderId}`,

      sellerId,

      shopId,

      orderId,

      type:
        "sale_credit",

      amountSatang:
        10000,

      currency:
        "THB",

      metadata: {
        paymentId,
        accountingPolicy:
          "legacy_gross",
      },
    });

  return {
    paymentId,
    providerPaymentId:
      `chrg_test_${suffix}`,
    orderId,
    sellerId,
    shopId,
  };
}

function healthyReport() {
  return {
    negativeSellerBalanceCount:
      0,

    openPayoutCount:
      0,

    conservativeTotalCoverageGapSatang:
      100000,

    transferableAfterReservedDemandSatang:
      100000,
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
          "nexora-phase60",
      },
    );

    await Promise.all([
      Payment.syncIndexes(),
      Order.syncIndexes(),
      Refund.syncIndexes(),
      Payout.syncIndexes(),
      SellerLedgerEntry
        .syncIndexes(),
      SellerFinancialState
        .syncIndexes(),
    ]);
  },
  120_000,
);

afterEach(
  async () => {
    await Promise.all([
      Payment.deleteMany({}),
      Order.deleteMany({}),
      Refund.deleteMany({}),
      Payout.deleteMany({}),
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
  120_000,
);

describe(
  "NEXORA Marketplace Phase 6.0 pre-live migration and audit",
  () => {
    it(
      "dry-run verifies legacy accounting without mutating Payment or Ledger",
      async () => {
        const seeded =
          await seedLegacy(
            "DRY",
          );

        const result =
          await backfillLegacyPaymentAccounting({
            apply:
              false,

            verifyPayment:
              async (
                payment,
              ) =>
                providerResult(
                  payment
                    .providerPaymentId,
                ),
          });

        expect(
          result.providerVerified,
        ).toBe(
          1,
        );

        expect(
          result.wouldUpdatePayments,
        ).toBe(
          1,
        );

        expect(
          result.wouldCreateSaleAdjustments,
        ).toBe(
          1,
        );

        const payment =
          await Payment.findOne({
            paymentId:
              seeded.paymentId,
          });

        expect(
          payment
            ?.accountingPolicy,
        ).toBeNull();

        expect(
          await SellerLedgerEntry
            .countDocuments({
              sourceKey:
                `accounting-adjustment:sale:${seeded.orderId}`,
            }),
        ).toBe(
          0,
        );
      },
    );

    it(
      "apply snapshots provider accounting and appends immutable sale adjustment",
      async () => {
        const seeded =
          await seedLegacy(
            "APPLY",
          );

        const result =
          await backfillLegacyPaymentAccounting({
            apply:
              true,

            verifyPayment:
              async (
                payment,
              ) =>
                providerResult(
                  payment
                    .providerPaymentId,
                ),
          });

        expect(
          result.updatedPayments,
        ).toBe(
          1,
        );

        expect(
          result.saleAdjustmentsCreated,
        ).toBe(
          1,
        );

        const payment =
          await Payment.findOne({
            paymentId:
              seeded.paymentId,
          });

        expect(
          payment
            ?.sellerNetSatang,
        ).toBe(
          9609,
        );

        expect(
          payment
            ?.accountingPolicy,
        ).toBe(
          "seller_pays_provider_fee",
        );

        const original =
          await SellerLedgerEntry
            .findOne({
              sourceKey:
                `sale:${seeded.orderId}`,
            });

        expect(
          original
            ?.amountSatang,
        ).toBe(
          10000,
        );

        const adjustment =
          await SellerLedgerEntry
            .findOne({
              sourceKey:
                `accounting-adjustment:sale:${seeded.orderId}`,
            });

        expect(
          adjustment
            ?.amountSatang,
        ).toBe(
          -391,
        );

        expect(
          adjustment?.type,
        ).toBe(
          "accounting_adjustment_debit",
        );
      },
    );

    it(
      "migration is idempotent",
      async () => {
        const seeded =
          await seedLegacy(
            "IDEMPOTENT",
          );

        const verifyPayment =
          async (
            payment:
              any,
          ) =>
            providerResult(
              payment
                .providerPaymentId,
            );

        await backfillLegacyPaymentAccounting({
          apply:
            true,

          verifyPayment,
        });

        await backfillLegacyPaymentAccounting({
          apply:
            true,

          verifyPayment,
        });

        expect(
          await SellerLedgerEntry
            .countDocuments({
              sourceKey:
                `accounting-adjustment:sale:${seeded.orderId}`,
            }),
        ).toBe(
          1,
        );
      },
    );

    it(
      "refunded legacy sale gets paired adjustments and remains zero balance",
      async () => {
        const seeded =
          await seedLegacy(
            "REFUNDED",
            "refunded",
          );

        await SellerLedgerEntry
          .create({
            ledgerEntryId:
              "LED-PH60-REFUND",

            sourceKey:
              "refund:REF-PH60",

            sellerId:
              seeded.sellerId,

            shopId:
              seeded.shopId,

            orderId:
              seeded.orderId,

            refundId:
              "REF-PH60",

            type:
              "refund_debit",

            amountSatang:
              -10000,

            currency:
              "THB",

            metadata: {
              paymentId:
                seeded.paymentId,
            },
          });

        await backfillLegacyPaymentAccounting({
          apply:
            true,

          verifyPayment:
            async (
              payment,
            ) =>
              providerResult(
                payment
                  .providerPaymentId,
              ),
        });

        expect(
          (
            await SellerLedgerEntry
              .findOne({
                sourceKey:
                  `accounting-adjustment:sale:${seeded.orderId}`,
              })
          )?.amountSatang,
        ).toBe(
          -391,
        );

        expect(
          (
            await SellerLedgerEntry
              .findOne({
                sourceKey:
                  "accounting-adjustment:refund:REF-PH60",
              })
          )?.amountSatang,
        ).toBe(
          391,
        );

        const rows =
          await SellerLedgerEntry
            .find({
              sellerId:
                seeded.sellerId,
            });

        const balance =
          rows.reduce(
            (
              sum,
              row,
            ) =>
              sum +
              row.amountSatang,
            0,
          );

        expect(
          balance,
        ).toBe(
          0,
        );
      },
    );

    it(
      "provider accounting failure leaves legacy financial records unchanged",
      async () => {
        const seeded =
          await seedLegacy(
            "UNRESOLVED",
          );

        const result =
          await backfillLegacyPaymentAccounting({
            apply:
              true,

            verifyPayment:
              async (
                payment,
              ) => ({
                ...providerResult(
                  payment
                    .providerPaymentId,
                ),

                accounting:
                  null,
              }),
          });

        expect(
          result.unresolved,
        ).toBe(
          1,
        );

        expect(
          (
            await Payment.findOne({
              paymentId:
                seeded.paymentId,
            })
          )?.accountingPolicy,
        ).toBeNull();

        expect(
          await SellerLedgerEntry
            .countDocuments({
              sourceKey:
                `accounting-adjustment:sale:${seeded.orderId}`,
            }),
        ).toBe(
          0,
        );
      },
    );

    it(
      "appendAccountingAdjustment assigns signed immutable ledger types",
      async () => {
        const session =
          await mongoose
            .startSession();

        try {
          await session
            .withTransaction(
              async () => {
                await sellerLedgerService
                  .appendAccountingAdjustment(
                    {
                      sourceKey:
                        "accounting-adjustment:test:credit",

                      sellerId:
                        "SELLER-ADJ",

                      shopId:
                        "SHOP-ADJ",

                      orderId:
                        "ORD-ADJ",

                      amountSatang:
                        100,

                      metadata: {},
                    },

                    session,
                  );

                await sellerLedgerService
                  .appendAccountingAdjustment(
                    {
                      sourceKey:
                        "accounting-adjustment:test:debit",

                      sellerId:
                        "SELLER-ADJ",

                      shopId:
                        "SHOP-ADJ",

                      orderId:
                        "ORD-ADJ",

                      amountSatang:
                        -50,

                      metadata: {},
                    },

                    session,
                  );
              },
            );
        } finally {
          await session
            .endSession();
        }

        expect(
          (
            await SellerLedgerEntry
              .findOne({
                sourceKey:
                  "accounting-adjustment:test:credit",
              })
          )?.type,
        ).toBe(
          "accounting_adjustment_credit",
        );

        expect(
          (
            await SellerLedgerEntry
              .findOne({
                sourceKey:
                  "accounting-adjustment:test:debit",
              })
          )?.type,
        ).toBe(
          "accounting_adjustment_debit",
        );
      },
    );

    it(
      "pre-live audit blocks unresolved legacy accounting",
      async () => {
        await seedLegacy(
          "AUDIT-LEGACY",
        );

        const audit =
          await runPreLiveFinancialAudit({
            getHealthReport:
              async () =>
                healthyReport(),
          });

        expect(
          audit.ready,
        ).toBe(
          false,
        );

        expect(
          audit.legacyPaymentCount,
        ).toBeGreaterThan(
          0,
        );

        expect(
          audit
            .unresolvedSaleLedgerCount,
        ).toBeGreaterThan(
          0,
        );
      },
    );

    it(
      "pre-live audit blocks operational and data-integrity hazards",
      async () => {
        await SellerLedgerEntry
          .create({
            ledgerEntryId:
              "LED-PH60-NEG",

            sourceKey:
              "accounting-adjustment:test:negative",

            sellerId:
              "SELLER-NEG",

            shopId:
              "SHOP-NEG",

            orderId:
              "ORD-NEG",

            type:
              "accounting_adjustment_debit",

            amountSatang:
              -100,

            currency:
              "THB",
          });

        await Order.collection
          .insertOne({
            orderId:
              "ORD-MISSING-CATEGORY",

            status:
              "pending",
          });

        await Refund.collection
          .insertOne({
            refundId:
              "REF-OPEN",

            status:
              "failed",
          });

        await Payout.collection
          .insertOne({
            payoutId:
              "PO-OPEN",

            status:
              "reserved",
          });

        const audit =
          await runPreLiveFinancialAudit({
            getHealthReport:
              async () => ({
                ...healthyReport(),

                negativeSellerBalanceCount:
                  1,

                openPayoutCount:
                  1,
              }),
          });

        expect(
          audit.ready,
        ).toBe(
          false,
        );

        expect(
          audit.openRefundCount,
        ).toBe(
          1,
        );

        expect(
          audit.openPayoutCount,
        ).toBe(
          1,
        );

        expect(
          audit
            .missingCategoryOpenOrderCount,
        ).toBe(
          1,
        );

        expect(
          audit.reasons.length,
        ).toBeGreaterThan(
          2,
        );
      },
    );

    it(
      "pre-live audit returns READY for reconciled financial data",
      async () => {
        await Payment.create({
          paymentId:
            "PAY-PH60-READY",

          orderId:
            "ORD-PH60-READY",

          buyerId:
            "BUYER-READY",

          sellerId:
            "SELLER-READY",

          shopId:
            "SHOP-READY",

          provider:
            "promptpay",

          amount:
            100,

          status:
            "paid",

          providerPaymentId:
            "chrg_test_ready",

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

        await SellerLedgerEntry
          .create({
            ledgerEntryId:
              "LED-PH60-READY",

            sourceKey:
              "sale:ORD-PH60-READY",

            sellerId:
              "SELLER-READY",

            shopId:
              "SHOP-READY",

            orderId:
              "ORD-PH60-READY",

            type:
              "sale_credit",

            amountSatang:
              9609,

            currency:
              "THB",

            metadata: {
              paymentId:
                "PAY-PH60-READY",

              accountingPolicy:
                "seller_pays_provider_fee",
            },
          });

        await SellerFinancialState
          .create({
            sellerId:
              "SELLER-READY",

            shopId:
              "SHOP-READY",

            revision:
              1,
          });

        const audit =
          await runPreLiveFinancialAudit({
            getHealthReport:
              async () =>
                healthyReport(),
          });

        expect(
          audit.status,
        ).toBe(
          "READY",
        );

        expect(
          audit.ready,
        ).toBe(
          true,
        );

        expect(
          audit.reasons,
        ).toEqual(
          [],
        );

        expect(
          audit.liveModeEnabled,
        ).toBe(
          false,
        );
      },
    );

    it(
      "phase60 runner is dry-run by default and requires explicit apply approval",
      () => {
        const source =
          readFileSync(
            "scripts/phase60-prelive.ts",
            "utf8",
          );

        expect(
          source,
        ).toContain(
          'process.argv.includes(\n      "--apply"',
        );

        expect(
          source,
        ).toContain(
          "NEXORA_PHASE60_ALLOW_APPLY",
        );

        expect(
          source,
        ).toContain(
          '"YES"',
        );
      },
    );
  },
);
