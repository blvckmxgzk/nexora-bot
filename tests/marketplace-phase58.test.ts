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
  SellerFinancialState,
} from "../src/models/SellerFinancialState.ts";

import {
  SellerLedgerEntry,
} from "../src/models/SellerLedgerEntry.ts";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  backfillSellerFinancialStates,
} from "../src/services/marketplace/sellerFinancialStateBackfillService.ts";

import {
  financialIntegrityService,
} from "../src/services/marketplace/financialIntegrityService.ts";

import {
  payoutService,
} from "../src/services/payoutService.ts";

import {
  omisePayoutProvider,
} from "../src/services/payment/providers/omisePayoutProvider.ts";

import {
  payoutProviderRegistry,
} from "../src/services/payment/payoutProviderRegistry.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

const originalSecretKey =
  process.env
    .OMISE_SECRET_KEY;

const originalLiquidityTest =
  process.env
    .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT;

async function ledger(
  data: {
    id:
      string;

    sellerId:
      string;

    shopId:
      string;

    amountSatang:
      number;

    type?:
      "sale_credit" |
      "refund_debit" |
      "payout_reserve" |
      "payout_release";

    payoutId?:
      string;
  },
) {
  return SellerLedgerEntry
    .create({
      ledgerEntryId:
        `LED-PH58-${data.id}`,

      sourceKey:
        `PH58:${data.id}`,

      sellerId:
        data.sellerId,

      shopId:
        data.shopId,

      payoutId:
        data.payoutId ??
        null,

      type:
        data.type ??
        "sale_credit",

      amountSatang:
        data.amountSatang,

      currency:
        "THB",
    });
}

async function payout(
  id:
    string,

  status:
    "reserved" |
    "creating_transfer" |
    "submitted" |
    "sent" =
      "reserved",

  amountSatang =
    5000,
) {
  return Payout.create({
    payoutId:
      `PO-PH58-${id}`,

    sellerId:
      `SELLER-PH58-${id}`,

    shopId:
      `SHOP-PH58-${id}`,

    payoutAccountId:
      `PACC-PH58-${id}`,

    provider:
      "omise",

    recipientId:
      `recp_test_ph58_${id}`,

    amountSatang,

    currency:
      "THB",

    feePolicy:
      "seller_pays",

    status,

    idempotencyKey:
      `nexora-ph58-${id}`,
  });
}

function balance(
  transferableSatang:
    number,

  totalSatang =
    transferableSatang,
) {
  return {
    currency:
      "THB",

    totalSatang,

    transferableSatang,

    onHoldSatang:
      null,

    reserveSatang:
      0,
  };
}

function transfer(
  data: {
    id:
      string;

    recipientId:
      string;

    amountSatang:
      number;
  },
) {
  return {
    providerTransferId:
      data.id,

    recipientId:
      data.recipientId,

    amountSatang:
      data.amountSatang,

    currency:
      "THB",

    sendable:
      true,

    sent:
      false,

    paid:
      false,

    deleted:
      false,

    sentAt:
      null,

    paidAt:
      null,

    failureCode:
      null,

    failureMessage:
      null,

    feeSatang:
      null,

    netSatang:
      null,
  };
}

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
          "nexora-phase58",
      },
    );

    await Promise.all([
      SellerFinancialState
        .syncIndexes(),

      SellerLedgerEntry
        .syncIndexes(),

      Payout
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
      originalSecretKey ===
      undefined
    ) {
      delete process.env
        .OMISE_SECRET_KEY;
    } else {
      process.env
        .OMISE_SECRET_KEY =
        originalSecretKey;
    }

    if (
      originalLiquidityTest ===
      undefined
    ) {
      delete process.env
        .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT;
    } else {
      process.env
        .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT =
        originalLiquidityTest;
    }

    await Promise.all([
      SellerFinancialState
        .deleteMany({}),

      SellerLedgerEntry
        .deleteMany({}),

      Payout
        .deleteMany({}),
    ]);
  },
);

afterAll(
  async () => {
    if (
      mongoose.connection
        .readyState !==
      0
    ) {
      await mongoose.disconnect();
    }

    if (replSet) {
      await replSet.stop();
    }
  },
  120_000,
);

describe(
  "NEXORA Marketplace Phase 5.8 financial integrity",
  () => {
    it(
      "backfills SellerFinancialState for legacy ledger sellers",
      async () => {
        await ledger({
          id:
            "BACKFILL",

          sellerId:
            "SELLER-A",

          shopId:
            "SHOP-A",

          amountSatang:
            5000,
        });

        const result =
          await backfillSellerFinancialStates();

        expect(
          result.created,
        ).toBe(
          1,
        );

        const state =
          await SellerFinancialState
            .findOne({
              sellerId:
                "SELLER-A",
            });

        expect(
          state?.shopId,
        ).toBe(
          "SHOP-A",
        );

        expect(
          state?.revision,
        ).toBe(
          0,
        );
      },
    );

    it(
      "backfill is idempotent and does not increment revision",
      async () => {
        await ledger({
          id:
            "IDEMPOTENT",

          sellerId:
            "SELLER-B",

          shopId:
            "SHOP-B",

          amountSatang:
            5000,
        });

        await backfillSellerFinancialStates();

        const second =
          await backfillSellerFinancialStates();

        expect(
          second.created,
        ).toBe(
          0,
        );

        expect(
          second.existing,
        ).toBe(
          1,
        );

        expect(
          await SellerFinancialState
            .countDocuments({
              sellerId:
                "SELLER-B",
            }),
        ).toBe(
          1,
        );

        expect(
          (
            await SellerFinancialState
              .findOne({
                sellerId:
                  "SELLER-B",
              })
          )?.revision,
        ).toBe(
          0,
        );
      },
    );

    it(
      "fails closed when one legacy seller has multiple shop identities",
      async () => {
        await ledger({
          id:
            "MULTI-1",

          sellerId:
            "SELLER-C",

          shopId:
            "SHOP-C1",

          amountSatang:
            5000,
        });

        await ledger({
          id:
            "MULTI-2",

          sellerId:
            "SELLER-C",

          shopId:
            "SHOP-C2",

          amountSatang:
            1000,
        });

        await expect(
          backfillSellerFinancialStates(),
        ).rejects.toThrow(
          /shop identity/,
        );

        expect(
          await SellerFinancialState
            .countDocuments({
              sellerId:
                "SELLER-C",
            }),
        ).toBe(
          0,
        );
      },
    );

    it(
      "normalizes real Omise Balance API fields as integer satang",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase58";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify({
                  object:
                    "balance",

                  livemode:
                    false,

                  currency:
                    "THB",

                  total:
                    10000,

                  transferable:
                    7000,

                  on_hold:
                    3000,

                  reserve:
                    0,
                }),
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
          await omisePayoutProvider
            .retrieveBalance();

        expect(
          result,
        ).toEqual({
          currency:
            "THB",

          totalSatang:
            10000,

          transferableSatang:
            7000,

          onHoldSatang:
            3000,

          reserveSatang:
            0,
        });
      },
    );

    it(
      "rejects a Live Omise Balance response in pre-live mode",
      async () => {
        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase58";

        vi.stubGlobal(
          "fetch",
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify({
                  object:
                    "balance",

                  livemode:
                    true,

                  currency:
                    "THB",

                  total:
                    10000,

                  transferable:
                    10000,

                  reserve:
                    0,
                }),
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

        await expect(
          omisePayoutProvider
            .retrieveBalance(),
        ).rejects.toThrow(
          /Live Balance/,
        );
      },
    );

    it(
      "keeps payout reserved when provider transferable balance is insufficient",
      async () => {
        process.env
          .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT =
          "1";

        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase58";

        const current =
          await payout(
            "LOW-LIQUIDITY",
          );

        const fetchMock =
          vi.fn()
            .mockResolvedValue(
              new Response(
                JSON.stringify({
                  object:
                    "balance",

                  livemode:
                    false,

                  currency:
                    "THB",

                  total:
                    10000,

                  transferable:
                    1000,

                  on_hold:
                    9000,

                  reserve:
                    0,
                }),
                {
                  status:
                    200,

                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                },
              ),
            );

        vi.stubGlobal(
          "fetch",
          fetchMock,
        );

        await expect(
          payoutService
            .processPayout(
              current.payoutId,
            ),
        ).rejects.toThrow(
          /transferable/,
        );

        /*
         * ต้องเรียกแค่ GET /balance
         *
         * ถ้ามี request ที่สอง
         * แปลว่าหลุดไป create Transfer
         */
        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          String(
            fetchMock.mock
              .calls[0]?.[0],
          ),
        ).toContain(
          "/balance",
        );

        const stored =
          await Payout.findOne({
            payoutId:
              current.payoutId,
          });

        expect(
          stored?.status,
        ).toBe(
          "reserved",
        );

        expect(
          stored?.metadata
            ?.lastProviderTransferableSatang,
        ).toBe(
          1000,
        );
      },
    );

    it(
      "keeps payout reserved when provider balance lookup fails",
      async () => {
        process.env
          .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT =
          "1";

        process.env
          .OMISE_SECRET_KEY =
          "skey_test_phase58";

        const current =
          await payout(
            "BALANCE-DOWN",
          );

        const fetchMock =
          vi.fn()
            .mockRejectedValue(
              new Error(
                "balance API timeout",
              ),
            );

        vi.stubGlobal(
          "fetch",
          fetchMock,
        );

        await expect(
          payoutService
            .processPayout(
              current.payoutId,
            ),
        ).rejects.toThrow(
          "balance API timeout",
        );

        /*
         * Balance lookup ล้มเหลวแล้วต้อง
         * fail closed ทันที
         *
         * ห้ามมี POST /transfers
         */
        expect(
          fetchMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          (
            await Payout.findOne({
              payoutId:
                current.payoutId,
            })
          )?.status,
        ).toBe(
          "reserved",
        );
      },
    );

    it(
      "creates Transfer after sufficient provider liquidity preflight",
      async () => {
        process.env
          .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT =
          "1";

        const current =
          await payout(
            "ENOUGH",
          );

        const provider =
          payoutProviderRegistry
            .get(
              "omise",
            );

        vi.spyOn(
          provider,
          "retrieveBalance",
        ).mockResolvedValue(
          balance(
            50000,
          ),
        );

        const createSpy =
          vi.spyOn(
            provider,
            "createTransfer",
          ).mockResolvedValue(
            transfer({
              id:
                "trsf_test_phase58_enough",

              recipientId:
                current.recipientId,

              amountSatang:
                current.amountSatang,
            }),
          );

        const result =
          await payoutService
            .processPayout(
              current.payoutId,
            );

        expect(
          createSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          result.status,
        ).toBe(
          "submitted",
        );
      },
    );

    it(
      "reports liabilities without netting negative sellers against positive sellers",
      async () => {
        await ledger({
          id:
            "A-SALE",

          sellerId:
            "SELLER-HEALTH-A",

          shopId:
            "SHOP-HEALTH-A",

          amountSatang:
            10000,
        });

        await ledger({
          id:
            "A-RESERVE",

          sellerId:
            "SELLER-HEALTH-A",

          shopId:
            "SHOP-HEALTH-A",

          amountSatang:
            -4000,

          type:
            "payout_reserve",

          payoutId:
            "PO-PH58-HEALTH",
        });

        await ledger({
          id:
            "B-SALE",

          sellerId:
            "SELLER-HEALTH-B",

          shopId:
            "SHOP-HEALTH-B",

          amountSatang:
            2000,
        });

        await ledger({
          id:
            "B-DEBIT",

          sellerId:
            "SELLER-HEALTH-B",

          shopId:
            "SHOP-HEALTH-B",

          amountSatang:
            -3000,

          type:
            "refund_debit",
        });

        await Payout.create({
          payoutId:
            "PO-PH58-HEALTH",

          sellerId:
            "SELLER-HEALTH-A",

          shopId:
            "SHOP-HEALTH-A",

          payoutAccountId:
            "PACC-PH58-HEALTH",

          provider:
            "omise",

          recipientId:
            "recp_test_phase58_health",

          amountSatang:
            4000,

          currency:
            "THB",

          feePolicy:
            "seller_pays",

          status:
            "reserved",

          idempotencyKey:
            "nexora-ph58-health",
        });

        vi.spyOn(
          omisePayoutProvider,
          "retrieveBalance",
        ).mockResolvedValue(
          balance(
            8000,
            12000,
          ),
        );

        const report =
          await financialIntegrityService
            .getHealthReport();

        expect(
          report
            .ledgerAvailableLiabilitySatang,
        ).toBe(
          6000,
        );

        expect(
          report
            .negativeSellerBalanceExposureSatang,
        ).toBe(
          1000,
        );

        expect(
          report
            .openPayoutLiabilitySatang,
        ).toBe(
          4000,
        );

        expect(
          report
            .totalOutstandingSellerLiabilitySatang,
        ).toBe(
          10000,
        );

        expect(
          report
            .conservativeTotalCoverageGapSatang,
        ).toBe(
          2000,
        );

        expect(
          report
            .transferableAfterReservedDemandSatang,
        ).toBe(
          4000,
        );
      },
    );

    it(
      "runs financial backfill before workers start",
      () => {
        const source =
          readFileSync(
            "src/index.ts",
            "utf8",
          );

        const backfill =
          source.indexOf(
            "await backfillSellerFinancialStates()",
          );

        const paymentWorker =
          source.indexOf(
            "paymentExpirationWorker.start()",
          );

        const payoutWorker =
          source.indexOf(
            "payoutReconciliationWorker.start()",
          );

        expect(
          backfill,
        ).toBeGreaterThan(
          -1,
        );

        expect(
          paymentWorker,
        ).toBeGreaterThan(
          backfill,
        );

        expect(
          payoutWorker,
        ).toBeGreaterThan(
          backfill,
        );
      },
    );
  },
);
