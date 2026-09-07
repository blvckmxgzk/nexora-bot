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
  FinancialRiskAction,
} from "../src/models/FinancialRiskAction.ts";

import {
  disputeService,
} from "../src/services/disputeService.ts";

import {
  omiseDisputeProvider,
  type ProviderDisputeSnapshot,
} from "../src/services/payment/providers/omiseDisputeProvider.ts";

import {
  reconcileDisputes,
} from "../src/services/disputeReconciliationService.ts";

import {
  financialIntegrityService,
} from "../src/services/marketplace/financialIntegrityService.ts";

import {
  runPreLiveFinancialAudit,
} from "../src/services/marketplace/preLiveFinancialAuditService.ts";

import {
  payoutProviderRegistry,
} from "../src/services/payment/payoutProviderRegistry.ts";

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
  const orderId =
    `ORD-PH61B-${suffix}`;

  const paymentId =
    `PAY-PH61B-${suffix}`;

  const sellerId =
    `SELLER-PH61B-${suffix}`;

  const shopId =
    `SHOP-PH61B-${suffix}`;

  const chargeId =
    `chrg_test_phase61b_${suffix.toLowerCase()}`;

  await Order.create({
    orderId,

    buyerId:
      `BUYER-${suffix}`,

    sellerId,

    shopId,

    productId:
      `PROD-${suffix}`,

    productName:
      "Phase 6.1B Product",

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
      `LED-PH61B-${suffix}`,

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
  });

  await SellerFinancialState.create({
    sellerId,
    shopId,
    revision:
      1,
  });

  return {
    orderId,
    paymentId,
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

    debit?:
      number;

    credit?:
      number;
  } = {},
): ProviderDisputeSnapshot {
  const disputeId =
    options.disputeId ??
    `dspt_test_${chargeId}`;

  const debit =
    options.debit ??
    10000;

  const credit =
    options.credit ??
    (
      status ===
        "won"
        ? 10000
        : 0
    );

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
        `trxn_debit_${disputeId}`,

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
        `trxn_credit_${disputeId}`,

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
    providerDisputeId:
      disputeId,

    providerChargeId:
      chargeId,

    status,

    amountSatang:
      10000,

    fundingAmountSatang:
      10000,

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

    activeDisputeCount:
      0,

    unresolvedLostDisputeCount:
      0,

    wonPendingCreditCount:
      0,

    unresolvedRiskDisputeCount:
      0,

    frozenSellerCount:
      0,

    providerDisputeNetDebitExposureSatang:
      0,
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
          "nexora-phase61b",
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

      FinancialRiskAction
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

    await Promise.all([
      Order.deleteMany({}),
      Payment.deleteMany({}),
      Dispute.deleteMany({}),

      SellerLedgerEntry
        .deleteMany({}),

      SellerFinancialState
        .deleteMany({}),

      FinancialRiskAction
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
  "NEXORA Marketplace Phase 6.1B dispute operations",
  () => {
    it(
      "lists Provider disputes with pagination",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase61b";

        const calls:
          string[] =
            [];

        vi.stubGlobal(
          "fetch",
          vi.fn(
            async (
              input:
                string |
                URL |
                Request,
            ) => {
              const url =
                String(
                  input,
                );

              calls.push(
                url,
              );

              const parsed =
                new URL(
                  url,
                );

              const offset =
                Number(
                  parsed.searchParams
                    .get(
                      "offset",
                    ) ??
                  "0",
                );

              const data =
                offset ===
                  0
                  ? [
                      {
                        object:
                          "dispute",

                        id:
                          "dspt_test_list_1",

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
                          "chrg_test_foreign_1",

                        status:
                          "open",

                        transactions:
                          [],
                      },
                    ]
                  : [];

              return new Response(
                JSON.stringify({
                  object:
                    "list",

                  total:
                    1,

                  data,
                }),

                {
                  status:
                    200,
                },
              );
            },
          ),
        );

        const result =
          await omiseDisputeProvider
            .listDisputes(
              "open",
              {
                maxRecords:
                  10,
              },
            );

        expect(
          result,
        ).toHaveLength(
          1,
        );

        expect(
          result[0]
            .providerDisputeId,
        ).toBe(
          "dspt_test_list_1",
        );

        expect(
          calls[0],
        ).toContain(
          "/disputes/open?",
        );
      },
    );

    it(
      "Provider discovery recovers dispute when webhook never created local record",
      async () => {
        const seeded =
          await seedSale(
            "DISCOVERY",
          );

        const canonical =
          snapshot(
            seeded.chargeId,
            "open",
            {
              disputeId:
                "dspt_test_discovery",
            },
          );

        vi.spyOn(
          omiseDisputeProvider,
          "listDisputes",
        ).mockImplementation(
          async (
            state,
          ) =>
            state ===
              "open"
              ? [
                  canonical,
                ]
              : [],
        );

        vi.spyOn(
          omiseDisputeProvider,
          "retrieveDispute",
        ).mockResolvedValue(
          canonical,
        );

        expect(
          await Dispute
            .countDocuments(),
        ).toBe(
          0,
        );

        const result =
          await reconcileDisputes(
            50,
          );

        expect(
          result.discovered,
        ).toBeGreaterThan(
          0,
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
      },
    );

    it(
      "known local dispute is retrieved canonically during fallback polling",
      async () => {
        const seeded =
          await seedSale(
            "KNOWN",
          );

        const open =
          snapshot(
            seeded.chargeId,
            "open",
            {
              disputeId:
                "dspt_test_known",
            },
          );

        await disputeService
          .applyProviderSnapshot(
            open,
          );

        const pending =
          snapshot(
            seeded.chargeId,
            "pending",
            {
              disputeId:
                "dspt_test_known",
            },
          );

        const retrieve =
          vi.spyOn(
            omiseDisputeProvider,
            "retrieveDispute",
          ).mockResolvedValue(
            pending,
          );

        vi.spyOn(
          omiseDisputeProvider,
          "listDisputes",
        ).mockResolvedValue(
          [],
        );

        await reconcileDisputes(
          50,
        );

        expect(
          retrieve,
        ).toHaveBeenCalledWith(
          "dspt_test_known",
        );

        expect(
          (
            await Dispute.findOne({
              providerDisputeId:
                "dspt_test_known",
            })
          )?.status,
        ).toBe(
          "pending",
        );
      },
    );

    it(
      "manual LOST resolution is blocked while Seller balance is negative",
      async () => {
        const seeded =
          await seedSale(
            "NEG",
          );

        const lost =
          snapshot(
            seeded.chargeId,
            "lost",
            {
              disputeId:
                "dspt_test_negative",
            },
          );

        await disputeService
          .applyProviderSnapshot(
            lost,
          );

        await SellerLedgerEntry
          .create({
            ledgerEntryId:
              "LED-PH61B-EXTRA-NEG",

            sourceKey:
              "phase61b-extra-negative",

            sellerId:
              seeded.sellerId,

            shopId:
              seeded.shopId,

            orderId:
              seeded.orderId,

            type:
              "accounting_adjustment_debit",

            amountSatang:
              -1,

            currency:
              "THB",
          });

        await expect(
          disputeService
            .resolveLostDisputeRisk({
              disputeId:
                (
                  await Dispute
                    .findOne({
                      providerDisputeId:
                        lost
                          .providerDisputeId,
                    })
                )!
                  .disputeId,

              actorId:
                "ADMIN-1",

              reason:
                "Seller ยังมียอด liability ค้างอยู่",
            }),
        ).rejects.toThrow(
          /ยอดติดลบ/,
        );
      },
    );

    it(
      "manual LOST resolution records immutable audit and clears Seller freeze when debt is settled",
      async () => {
        const seeded =
          await seedSale(
            "RESOLVE",
          );

        const lost =
          snapshot(
            seeded.chargeId,
            "lost",
            {
              disputeId:
                "dspt_test_resolve",
            },
          );

        await disputeService
          .applyProviderSnapshot(
            lost,
          );

        const dispute =
          await Dispute
            .findOne({
              providerDisputeId:
                lost.providerDisputeId,
            });

        const result =
          await disputeService
            .resolveLostDisputeRisk({
              disputeId:
                dispute!
                  .disputeId,

              actorId:
                "ADMIN-RESOLVE",

              reason:
                "Seller liability ถูกหักครบและตรวจสอบข้อมูลแล้ว",
            });

        expect(
          result
            .financialState
            .payoutFrozen,
        ).toBe(
          false,
        );

        expect(
          await FinancialRiskAction
            .countDocuments({
              disputeId:
                dispute!
                  .disputeId,
            }),
        ).toBe(
          1,
        );

        expect(
          (
            await Order.findOne({
              orderId:
                seeded.orderId,
            })
          )?.metadata
            ?.activeDisputeId,
        ).toBeNull();
      },
    );

    it(
      "repeated LOST resolution does not create duplicate audit actions",
      async () => {
        const seeded =
          await seedSale(
            "IDEMPOTENT",
          );

        const lost =
          snapshot(
            seeded.chargeId,
            "lost",
            {
              disputeId:
                "dspt_test_resolution_idempotent",
            },
          );

        await disputeService
          .applyProviderSnapshot(
            lost,
          );

        const dispute =
          await Dispute
            .findOne({
              providerDisputeId:
                lost.providerDisputeId,
            });

        const input = {
          disputeId:
            dispute!
              .disputeId,

          actorId:
            "ADMIN-IDEMPOTENT",

          reason:
            "Seller liability ถูก settle เรียบร้อยแล้ว",
        };

        await disputeService
          .resolveLostDisputeRisk(
            input,
          );

        const second =
          await disputeService
            .resolveLostDisputeRisk(
              input,
            );

        expect(
          second
            .alreadyResolved,
        ).toBe(
          true,
        );

        expect(
          await FinancialRiskAction
            .countDocuments(),
        ).toBe(
          1,
        );
      },
    );

    it(
      "Pre-Live audit blocks unresolved LOST dispute",
      async () => {
        const seeded =
          await seedSale(
            "AUDIT-LOST",
          );

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "lost",
            ),
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
          audit
            .unresolvedLostDisputeCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "Pre-Live audit blocks WON dispute until provider credit is confirmed",
      async () => {
        const seeded =
          await seedSale(
            "AUDIT-WON",
          );

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "won",
              {
                disputeId:
                  "dspt_test_won_no_credit_61b",

                credit:
                  0,
              },
            ),
          );

        const audit =
          await runPreLiveFinancialAudit({
            getHealthReport:
              async () =>
                healthyReport(),
          });

        expect(
          audit
            .wonPendingCreditCount,
        ).toBe(
          1,
        );

        expect(
          audit.ready,
        ).toBe(
          false,
        );
      },
    );

    it(
      "Pre-Live audit detects Dispute ledger mismatch",
      async () => {
        const seeded =
          await seedSale(
            "MISMATCH",
          );

        const lost =
          snapshot(
            seeded.chargeId,
            "lost",
          );

        await disputeService
          .applyProviderSnapshot(
            lost,
          );

        await SellerLedgerEntry
          .deleteOne({
            sourceKey:
              `dispute-loss:${lost.providerDisputeId}`,
          });

        const audit =
          await runPreLiveFinancialAudit({
            getHealthReport:
              async () =>
                healthyReport(),
          });

        expect(
          audit
            .disputeLedgerMismatchCount,
        ).toBeGreaterThan(
          0,
        );

        expect(
          audit.ready,
        ).toBe(
          false,
        );
      },
    );

    it(
      "resolved historical LOST dispute no longer counts as active disputed Order blocker",
      async () => {
        const seeded =
          await seedSale(
            "RESOLVED-AUDIT",
          );

        const lost =
          snapshot(
            seeded.chargeId,
            "lost",
          );

        await disputeService
          .applyProviderSnapshot(
            lost,
          );

        const dispute =
          await Dispute
            .findOne({
              providerDisputeId:
                lost.providerDisputeId,
            });

        await disputeService
          .resolveLostDisputeRisk({
            disputeId:
              dispute!
                .disputeId,

            actorId:
              "ADMIN-AUDIT",

            reason:
              "Seller liability ถูก settle และ review ครบแล้ว",
          });

        const audit =
          await runPreLiveFinancialAudit({
            getHealthReport:
              async () =>
                healthyReport(),
          });

        expect(
          audit.disputedOrderCount,
        ).toBe(
          0,
        );

        expect(
          audit
            .unresolvedLostDisputeCount,
        ).toBe(
          0,
        );

        expect(
          audit.frozenSellerCount,
        ).toBe(
          0,
        );
      },
    );

    it(
      "Financial health reports frozen Sellers and Provider dispute exposure",
      async () => {
        const seeded =
          await seedSale(
            "HEALTH",
          );

        await disputeService
          .applyProviderSnapshot(
            snapshot(
              seeded.chargeId,
              "open",
            ),
          );

        const provider =
          payoutProviderRegistry
            .get(
              "omise",
            );

        vi.spyOn(
          provider,
          "retrieveBalance",
        ).mockResolvedValue({
          currency:
            "THB",

          totalSatang:
            100000,

          transferableSatang:
            100000,

          onHoldSatang:
            0,

          reserveSatang:
            0,
        });

        const health =
          await financialIntegrityService
            .getHealthReport();

        expect(
          health
            .activeDisputeCount,
        ).toBe(
          1,
        );

        expect(
          health
            .frozenSellerCount,
        ).toBe(
          1,
        );

        expect(
          health
            .providerDisputeNetDebitExposureSatang,
        ).toBe(
          10000,
        );
      },
    );

    it(
      "source guards keep reconciliation GET-only and Administrator-only",
      () => {
        const command =
          readFileSync(
            "src/commands/marketplace/financial-risk.ts",
            "utf8",
          );

        const provider =
          readFileSync(
            "src/services/payment/providers/omiseDisputeProvider.ts",
            "utf8",
          );

        const worker =
          readFileSync(
            "src/services/disputeReconciliationWorker.ts",
            "utf8",
          );

        expect(
          command,
        ).toContain(
          "PermissionFlagsBits\n        .Administrator",
        );

        expect(
          provider,
        ).toContain(
          '"/disputes/open"',
        );

        expect(
          provider,
        ).toContain(
          '"/disputes/pending"',
        );

        expect(
          provider,
        ).toContain(
          '"/disputes/closed"',
        );

        expect(
          provider,
        ).not.toContain(
          '"/accept"',
        );

        expect(
          provider,
        ).not.toContain(
          '"/close"',
        );

        expect(
          worker,
        ).toContain(
          "cycleRunning",
        );
      },
    );
  },
);
