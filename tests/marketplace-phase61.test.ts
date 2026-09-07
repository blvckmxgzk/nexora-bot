import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  Order,
} from "../src/models/Order.ts";

import {
  Payment,
} from "../src/models/Payment.ts";

import {
  Dispute,
} from "../src/models/Dispute.ts";

import {
  SellerLedgerEntry,
} from "../src/models/SellerLedgerEntry.ts";

import {
  SellerFinancialState,
} from "../src/models/SellerFinancialState.ts";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  WebhookEvent,
} from "../src/models/WebhookEvent.ts";

import {
  disputeService,
} from "../src/services/disputeService.ts";

import {
  omiseDisputeProvider,
  type ProviderDisputeSnapshot,
} from "../src/services/payment/providers/omiseDisputeProvider.ts";

import {
  payoutProviderRegistry,
} from "../src/services/payment/payoutProviderRegistry.ts";

import {
  payoutService,
} from "../src/services/payoutService.ts";

import {
  isSupportedOmiseReconciliationEvent,
  omiseWebhookReconciliationService,
} from "../src/services/omiseWebhookReconciliationService.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

const originalSecret =
  process.env
    .OMISE_SECRET_KEY;

async function seedSale(
  suffix:
    string,
) {
  const paymentId =
    `PAY-PH61-${suffix}`;

  const orderId =
    `ORD-PH61-${suffix}`;

  const sellerId =
    `SELLER-PH61-${suffix}`;

  const shopId =
    `SHOP-PH61-${suffix}`;

  const chargeId =
    `chrg_test_phase61_${suffix.toLowerCase()}`;

  await Order.create({
    orderId,

    buyerId:
      `BUYER-${suffix}`,

    sellerId,

    shopId,

    productId:
      `PROD-${suffix}`,

    productName:
      "Phase 6.1 Product",

    productCategory:
      "other",

    quantity:
      1,

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

    sellerId,

    shopId,

    provider:
      "promptpay",

    amount:
      100,

    status:
      "paid",

    providerPaymentId:
      chargeId,

    expiresAt:
      new Date(),

    paidAt:
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

  await SellerLedgerEntry.create({
    ledgerEntryId:
      `LED-PH61-${suffix}`,

    sourceKey:
      `sale:${orderId}`,

    sellerId,

    shopId,

    orderId,

    type:
      "sale_credit",

    amountSatang:
      9609,

    currency:
      "THB",

    metadata: {
      paymentId,
      grossAmountSatang:
        10000,
      sellerNetSatang:
        9609,
    },
  });

  await SellerFinancialState.create({
    sellerId,

    shopId,

    revision:
      1,
  });

  return {
    paymentId,
    orderId,
    sellerId,
    shopId,
    chargeId,
  };
}

function snapshot(
  chargeId:
    string,

  status:
    "open" |
    "pending" |
    "won" |
    "lost",

  options: {
    disputeId?:
      string;

    amountSatang?:
      number;

    debitSatang?:
      number;

    creditSatang?:
      number;
  } = {},
): ProviderDisputeSnapshot {
  const amount =
    options.amountSatang ??
    10000;

  const debit =
    options.debitSatang ??
    (
      status ===
        "open" ||
      status ===
        "pending" ||
      status ===
        "lost" ||
      status ===
        "won"
        ? amount
        : 0
    );

  const credit =
    options.creditSatang ??
    (
      status ===
        "won"
        ? amount
        : 0
    );

  const providerDisputeId =
    options.disputeId ??
    `dspt_test_${chargeId}`;

  const transactions:
    ProviderDisputeSnapshot[
      "transactions"
    ] =
      [];

  if (
    debit >
    0
  ) {
    transactions.push({
      providerTransactionId:
        `trxn_debit_${providerDisputeId}`,

      direction:
        "debit",

      key:
        "dispute.started.debit",

      amountSatang:
        debit,

      currency:
        "THB",

      createdAt:
        new Date(),
    });
  }

  if (
    credit >
    0
  ) {
    transactions.push({
      providerTransactionId:
        `trxn_credit_${providerDisputeId}`,

      direction:
        "credit",

      key:
        "dispute.won.credit",

      amountSatang:
        credit,

      currency:
        "THB",

      createdAt:
        new Date(),
    });
  }

  return {
    providerDisputeId,

    providerChargeId:
      chargeId,

    status,

    amountSatang:
      amount,

    fundingAmountSatang:
      amount,

    currency:
      "THB",

    fundingCurrency:
      "THB",

    providerDebitSatang:
      debit,

    providerCreditSatang:
      credit,

    transactions,

    reasonCode:
      "goods_or_services_not_provided",

    reasonMessage:
      "Goods not provided",

    message:
      null,

    adminMessage:
      null,

    createdAt:
      new Date(),

    closedAt:
      status ===
        "won" ||
      status ===
        "lost"
        ? new Date()
        : null,
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
          "nexora-phase61",
      },
    );

    await Promise.all([
      Order.syncIndexes(),
      Payment.syncIndexes(),
      Dispute.syncIndexes(),
      SellerLedgerEntry
        .syncIndexes(),
      SellerFinancialState
        .syncIndexes(),
      Payout.syncIndexes(),
      WebhookEvent
        .syncIndexes(),
    ]);
  },
  120_000,
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

    delete process.env
      .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT;

    await Promise.all([
      Order.deleteMany({}),
      Payment.deleteMany({}),
      Dispute.deleteMany({}),
      SellerLedgerEntry
        .deleteMany({}),
      SellerFinancialState
        .deleteMany({}),
      Payout.deleteMany({}),
      WebhookEvent
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
  "NEXORA Marketplace Phase 6.1A dispute risk",
  () => {
    it(
      "normalizes canonical Omise Dispute and transactions",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase61";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify({
                  object:
                    "dispute",

                  id:
                    "dspt_test_adapter",

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

                  charge:
                    "chrg_test_adapter",

                  status:
                    "open",

                  transactions: [
                    {
                      id:
                        "trxn_test_adapter",

                      amount:
                        10000,

                      currency:
                        "THB",

                      direction:
                        "debit",

                      key:
                        "dispute.started.debit",

                      origin:
                        "dspt_test_adapter",

                      created_at:
                        new Date()
                          .toISOString(),
                    },
                  ],
                }),
                {
                  status:
                    200,
                },
              ),
            ),
        );

        const result =
          await omiseDisputeProvider
            .retrieveDispute(
              "dspt_test_adapter",
            );

        expect(
          result.status,
        ).toBe(
          "open",
        );

        expect(
          result
            .providerDebitSatang,
        ).toBe(
          10000,
        );

        expect(
          result
            .providerCreditSatang,
        ).toBe(
          0,
        );
      },
    );

    it(
      "rejects Live Omise Dispute",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase61";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify({
                  object:
                    "dispute",

                  id:
                    "dspt_live",

                  livemode:
                    true,

                  amount:
                    10000,

                  currency:
                    "THB",

                  charge:
                    "chrg_live",

                  status:
                    "open",
                }),
                {
                  status:
                    200,
                },
              ),
            ),
        );

        await expect(
          omiseDisputeProvider
            .retrieveDispute(
              "dspt_live",
            ),
        ).rejects.toThrow(
          /Live Dispute/,
        );
      },
    );

    it(
      "OPEN dispute freezes payout and marks Order disputed without Seller debit",
      async () => {
        const seeded =
          await seedSale(
            "OPEN",
          );

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "open",
            ),
          );

        expect(
          (
            await Order.findOne({
              orderId:
                seeded.orderId,
            })
          )?.status,
        ).toBe(
          "disputed",
        );

        const state =
          await SellerFinancialState
            .findOne({
              sellerId:
                seeded.sellerId,
            });

        expect(
          state?.payoutFrozen,
        ).toBe(
          true,
        );

        expect(
          state?.riskStatus,
        ).toBe(
          "dispute_review",
        );

        expect(
          await SellerLedgerEntry
            .countDocuments({
              type:
                "dispute_loss_debit",
            }),
        ).toBe(
          0,
        );
      },
    );

    it(
      "duplicate OPEN reconciliation is idempotent",
      async () => {
        const seeded =
          await seedSale(
            "IDEMPOTENT",
          );

        const canonical =
          snapshot(
            seeded.chargeId,
            "open",
          );

        await disputeService
          .applyProviderSnapshot(
            canonical,
          );

        await disputeService
          .applyProviderSnapshot(
            canonical,
          );

        expect(
          await Dispute
            .countDocuments({
              providerDisputeId:
                canonical
                  .providerDisputeId,
            }),
        ).toBe(
          1,
        );

        expect(
          await SellerLedgerEntry
            .countDocuments({
              type:
                "dispute_loss_debit",
            }),
        ).toBe(
          0,
        );
      },
    );

    it(
      "LOST dispute debits original Seller net exactly once",
      async () => {
        const seeded =
          await seedSale(
            "LOST",
          );

        const canonical =
          snapshot(
            seeded.chargeId,
            "lost",
          );

        await disputeService
          .applyProviderSnapshot(
            canonical,
          );

        await disputeService
          .applyProviderSnapshot(
            canonical,
          );

        const loss =
          await SellerLedgerEntry
            .findOne({
              sourceKey:
                `dispute-loss:${canonical.providerDisputeId}`,
            });

        expect(
          loss?.amountSatang,
        ).toBe(
          -9609,
        );

        expect(
          await SellerLedgerEntry
            .countDocuments({
              sourceKey:
                `dispute-loss:${canonical.providerDisputeId}`,
            }),
        ).toBe(
          1,
        );

        expect(
          (
            await SellerFinancialState
              .findOne({
                sellerId:
                  seeded.sellerId,
              })
          )?.riskStatus,
        ).toBe(
          "dispute_lost",
        );
      },
    );

    it(
      "partial LOST dispute uses Seller-net pro-rata liability",
      async () => {
        const seeded =
          await seedSale(
            "PARTIAL",
          );

        const canonical =
          snapshot(
            seeded.chargeId,
            "lost",
            {
              amountSatang:
                5000,

              debitSatang:
                5000,
            },
          );

        await disputeService
          .applyProviderSnapshot(
            canonical,
          );

        /*
         * round(
         *   9609 * 5000 / 10000
         * ) = 4805
         */
        expect(
          (
            await Dispute
              .findOne({
                providerDisputeId:
                  canonical
                    .providerDisputeId,
              })
          )?.sellerLiabilitySatang,
        ).toBe(
          4805,
        );

        expect(
          (
            await SellerLedgerEntry
              .findOne({
                sourceKey:
                  `dispute-loss:${canonical.providerDisputeId}`,
              })
          )?.amountSatang,
        ).toBe(
          -4805,
        );
      },
    );

    it(
      "WON with provider credit reverses prior loss and restores Order",
      async () => {
        const seeded =
          await seedSale(
            "WON",
          );

        const disputeId =
          "dspt_test_won_recovery";

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "lost",
              {
                disputeId,
              },
            ),
          );

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "won",
              {
                disputeId,

                debitSatang:
                  10000,

                creditSatang:
                  10000,
              },
            ),
          );

        expect(
          (
            await SellerLedgerEntry
              .findOne({
                sourceKey:
                  `dispute-recovery:${disputeId}`,
              })
          )?.amountSatang,
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
          "completed",
        );

        const state =
          await SellerFinancialState
            .findOne({
              sellerId:
                seeded.sellerId,
            });

        expect(
          state?.payoutFrozen,
        ).toBe(
          false,
        );

        expect(
          state?.riskStatus,
        ).toBe(
          "clear",
        );
      },
    );

    it(
      "WON without provider credit remains frozen and disputed",
      async () => {
        const seeded =
          await seedSale(
            "WON-NO-CREDIT",
          );

        const disputeId =
          "dspt_test_won_no_credit";

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "open",
              {
                disputeId,
              },
            ),
          );

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "won",
              {
                disputeId,

                debitSatang:
                  10000,

                creditSatang:
                  0,
              },
            ),
          );

        expect(
          (
            await SellerFinancialState
              .findOne({
                sellerId:
                  seeded.sellerId,
              })
          )?.payoutFrozen,
        ).toBe(
          true,
        );

        expect(
          (
            await Order.findOne({
              orderId:
                seeded.orderId,
            })
          )?.status,
        ).toBe(
          "disputed",
        );
      },
    );

    it(
      "foreign Provider Charge is ignored",
      async () => {
        const result =
          await disputeService
            .applyProviderSnapshot(
              snapshot(
                "chrg_test_foreign",
                "open",
              ),
            );

        expect(
          result.ignored,
        ).toBe(
          true,
        );

        expect(
          await Dispute.countDocuments(),
        ).toBe(
          0,
        );
      },
    );

    it(
      "frozen Seller cannot advance reserved Payout to Transfer creation",
      async () => {
        const seeded =
          await seedSale(
            "PAYOUT-FREEZE",
          );

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "open",
            ),
          );

        const payoutId =
          "PO-PH61-FROZEN";

        await Payout.create({
          payoutId,

          sellerId:
            seeded.sellerId,

          shopId:
            seeded.shopId,

          payoutAccountId:
            "PA-PH61",

          provider:
            "omise",

          recipientId:
            "recp_test_phase61",

          amountSatang:
            3000,

          currency:
            "THB",

          feePolicy:
            "seller_pays",

          status:
            "reserved",

          idempotencyKey:
            "nexora-payout-phase61",
        });

        const provider =
          payoutProviderRegistry
            .get(
              "omise",
            );

        const createSpy =
          vi.spyOn(
            provider,
            "createTransfer",
          );

        await expect(
          payoutService
            .processPayout(
              payoutId,
            ),
        ).rejects.toThrow(
          /Financial Risk/,
        );

        expect(
          createSpy,
        ).not.toHaveBeenCalled();

        expect(
          (
            await Payout.findOne({
              payoutId,
            })
          )?.status,
        ).toBe(
          "reserved",
        );
      },
    );

    it(
      "Omise webhook dispute event uses canonical GET and becomes processed",
      async () => {
        const seeded =
          await seedSale(
            "WEBHOOK",
          );

        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase61";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify({
                  object:
                    "dispute",

                  id:
                    "dspt_test_webhook",

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

                  charge:
                    seeded
                      .chargeId,

                  status:
                    "open",

                  transactions: [
                    {
                      id:
                        "trxn_test_webhook_debit",

                      amount:
                        10000,

                      currency:
                        "THB",

                      direction:
                        "debit",

                      key:
                        "dispute.started.debit",

                      origin:
                        "dspt_test_webhook",
                    },
                  ],
                }),
                {
                  status:
                    200,
                },
              ),
            ),
        );

        expect(
          isSupportedOmiseReconciliationEvent(
            "dispute.create",
          ),
        ).toBe(
          true,
        );

        const result =
          await omiseWebhookReconciliationService
            .process({
              id:
                "evnt_test_phase61",

              key:
                "dispute.create",

              data: {
                id:
                  "dspt_test_webhook",
              },
            });

        expect(
          result.success,
        ).toBe(
          true,
        );

        expect(
          (
            await WebhookEvent
              .findOne({
                eventId:
                  "evnt_test_phase61",
              })
          )?.status,
        ).toBe(
          "processed",
        );

        expect(
          (
            await Order.findOne({
              orderId:
                seeded.orderId,
            })
          )?.status,
        ).toBe(
          "disputed",
        );
      },
    );

    it(
      "source guards keep risk checks at both payout boundaries",
      () => {
        const payoutSource =
          readFileSync(
            "src/services/payoutService.ts",
            "utf8",
          );

        const webhookSource =
          readFileSync(
            "src/services/omiseWebhookReconciliationService.ts",
            "utf8",
          );

        expect(
          payoutSource,
        ).toContain(
          "assertPayoutAllowed",
        );

        expect(
          payoutSource,
        ).toContain(
          "claimPayoutForTransfer",
        );

        expect(
          webhookSource,
        ).toContain(
          "dispute.create",
        );

        /*
         * webhook reconciliation
         * ห้าม accept/close Provider dispute
         * เอง
         */
        expect(
          webhookSource,
        ).not.toContain(
          "/accept",
        );

        expect(
          webhookSource,
        ).not.toContain(
          "/close",
        );
      },
    );
  },
);
