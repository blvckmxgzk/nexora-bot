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
  SellerLedgerEntry,
} from "../src/models/SellerLedgerEntry.ts";

import {
  SellerFinancialState,
} from "../src/models/SellerFinancialState.ts";

import {
  SellerPayoutAccount,
} from "../src/models/SellerPayoutAccount.ts";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  sellerLedgerService,
} from "../src/services/sellerLedgerService.ts";

import {
  sellerPayoutAccountService,
} from "../src/services/sellerPayoutAccountService.ts";

import {
  payoutService,
} from "../src/services/payoutService.ts";

import {
  omisePayoutProvider,
} from "../src/services/payment/providers/omisePayoutProvider.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

async function seedBalance(
  suffix:
    string,

  amountBaht:
    number,
) {
  const sellerId =
    `SELLER-${suffix}`;

  const shopId =
    `SHOP-${suffix}`;

  const session =
    await mongoose
      .startSession();

  try {
    await session.withTransaction(
      async () => {
        await sellerLedgerService
          .creditCompletedOrder(
            {
              orderId:
                `ORDER-${suffix}`,

              sellerId,

              shopId,

              totalAmount:
                amountBaht,

              paymentId:
                `PAY-${suffix}`,
            },
            session,
          );
      },
    );
  } finally {
    await session.endSession();
  }

  return {
    sellerId,
    shopId,
  };
}

async function seedReadyAccount(
  sellerId:
    string,

  shopId:
    string,
) {
  return SellerPayoutAccount
    .create({
      payoutAccountId:
        `PACC-${sellerId}`,

      sellerId,

      shopId,

      provider:
        "omise",

      status:
        "ready",

      recipientId:
        `recp_test_${sellerId}`,

      recipientActive:
        true,

      recipientVerified:
        true,

      bankCode:
        "test",

      bankBrand:
        "Test Bank",

      bankLastDigits:
        "6789",

      accountHolderName:
        "TEST SELLER",
    });
}

function transferResult(
  data: {
    id:
      string;

    recipientId:
      string;

    amountSatang:
      number;

    sent?:
      boolean;

    paid?:
      boolean;

    failureCode?:
      string | null;
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
      !data.failureCode,

    sent:
      data.sent ??
      false,

    paid:
      data.paid ??
      false,

    deleted:
      false,

    sentAt:
      data.sent
        ? new Date()
        : null,

    paidAt:
      data.paid
        ? new Date()
        : null,

    failureCode:
      data.failureCode ??
      null,

    failureMessage:
      data.failureCode
        ? "simulated transfer failure"
        : null,

    feeSatang:
      30,

    netSatang:
      data.amountSatang -
      30,
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
          "nexora-marketplace-phase53",
      },
    );

    await Promise.all([
      SellerLedgerEntry
        .syncIndexes(),

      SellerFinancialState
        .syncIndexes(),

      SellerPayoutAccount
        .syncIndexes(),

      Payout
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
    SellerLedgerEntry
      .deleteMany({}),

    SellerFinancialState
      .deleteMany({}),

    SellerPayoutAccount
      .deleteMany({}),

    Payout
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
  "NEXORA Marketplace Phase 5.3 payouts",
  () => {
    it(
      "stores only Omise Recipient snapshot and never persists the full test account number",
      async () => {
        const fullAccountNumber =
          "acc123456789";

        const createSpy =
          vi.spyOn(
            omisePayoutProvider,
            "createRecipient",
          ).mockResolvedValue({
            recipientId:
              "recp_test_phase53",

            active:
              true,

            verified:
              false,

            failureCode:
              null,

            bankCode:
              "test",

            bankBrand:
              "Test Bank",

            bankLastDigits:
              "6789",

            accountHolderName:
              "TEST SELLER",
          });

        vi.spyOn(
          omisePayoutProvider,
          "verifyRecipientForTest",
        ).mockResolvedValue({
          recipientId:
            "recp_test_phase53",

          active:
            true,

          verified:
            true,

          failureCode:
            null,

          bankCode:
            "test",

          bankBrand:
            "Test Bank",

          bankLastDigits:
            "6789",

          accountHolderName:
            "TEST SELLER",
        });

        const account =
          await sellerPayoutAccountService
            .setup({
              sellerId:
                "SELLER-ACCOUNT",

              shopId:
                "SHOP-ACCOUNT",

              accountHolderName:
                "TEST SELLER",

              bankCode:
                "test",

              accountNumber:
                fullAccountNumber,
            });

        expect(
          account.status,
        ).toBe(
          "ready",
        );

        expect(
          createSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        const stored =
          await SellerPayoutAccount
            .findOne({
              sellerId:
                "SELLER-ACCOUNT",
            })
            .lean();

        expect(
          JSON.stringify(
            stored,
          ),
        ).not.toContain(
          fullAccountNumber,
        );

        expect(
          stored
            ?.bankLastDigits,
        ).toBe(
          "6789",
        );
      },
    );

    it(
      "allows only one concurrent payout reservation to consume seller balance",
      async () => {
        const state =
          await seedBalance(
            "RESERVE-RACE",
            100,
          );

        await seedReadyAccount(
          state.sellerId,
          state.shopId,
        );

        const results =
          await Promise.allSettled([
            payoutService
              .requestPayout({
                sellerId:
                  state.sellerId,

                amountSatang:
                  8000,
              }),

            payoutService
              .requestPayout({
                sellerId:
                  state.sellerId,

                amountSatang:
                  8000,
              }),
          ]);

        expect(
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          ),
        ).toHaveLength(
          1,
        );

        expect(
          results.filter(
            (result) =>
              result.status ===
              "rejected",
          ),
        ).toHaveLength(
          1,
        );

        expect(
          await Payout
            .countDocuments({}),
        ).toBe(
          1,
        );

        expect(
          await sellerLedgerService
            .getAvailableBalanceSatang(
              state.sellerId,
            ),
        ).toBe(
          2000,
        );
      },
    );

    it(
      "creates only one Omise Transfer when processPayout races",
      async () => {
        const state =
          await seedBalance(
            "PROCESS-RACE",
            100,
          );

        const account =
          await seedReadyAccount(
            state.sellerId,
            state.shopId,
          );

        const payout =
          await payoutService
            .requestPayout({
              sellerId:
                state.sellerId,

              amountSatang:
                5000,
            });

        const createSpy =
          vi.spyOn(
            omisePayoutProvider,
            "createTransfer",
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

              return transferResult({
                id:
                  "trsf_test_race",

                recipientId:
                  input.recipientId,

                amountSatang:
                  input.amountSatang,
              });
            },
          );

        vi.spyOn(
          omisePayoutProvider,
          "findExistingTransfer",
        ).mockResolvedValue(
          null,
        );

        const results =
          await Promise.allSettled([
            payoutService
              .processPayout(
                payout.payoutId,
              ),

            payoutService
              .processPayout(
                payout.payoutId,
              ),
          ]);

        expect(
          createSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          results.some(
            (result) =>
              result.status ===
              "fulfilled",
          ),
        ).toBe(
          true,
        );

        const current =
          await Payout.findOne({
            payoutId:
              payout.payoutId,
          });

        expect(
          current?.status,
        ).toBe(
          "submitted",
        );

        expect(
          current
            ?.providerTransferId,
        ).toBe(
          "trsf_test_race",
        );

        expect(
          createSpy.mock
            .calls[0]?.[0]
            .idempotencyKey,
        ).toBe(
          payout.idempotencyKey,
        );

        expect(
          account.recipientId,
        ).toBe(
          current
            ?.recipientId,
        );
      },
    );

    it(
      "keeps reservation after an ambiguous provider failure and never creates a second Transfer automatically",
      async () => {
        const state =
          await seedBalance(
            "AMBIGUOUS",
            100,
          );

        await seedReadyAccount(
          state.sellerId,
          state.shopId,
        );

        const payout =
          await payoutService
            .requestPayout({
              sellerId:
                state.sellerId,

              amountSatang:
                5000,
            });

        const createSpy =
          vi.spyOn(
            omisePayoutProvider,
            "createTransfer",
          ).mockRejectedValue(
            new Error(
              "simulated timeout after transfer creation",
            ),
          );

        vi.spyOn(
          omisePayoutProvider,
          "findExistingTransfer",
        ).mockResolvedValue(
          null,
        );

        await expect(
          payoutService
            .processPayout(
              payout.payoutId,
            ),
        ).rejects.toThrow(
          /simulated timeout/,
        );

        await expect(
          payoutService
            .processPayout(
              payout.payoutId,
            ),
        ).rejects.toThrow(
          /ไม่สร้าง Transfer ซ้ำ/,
        );

        expect(
          createSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        const current =
          await Payout.findOne({
            payoutId:
              payout.payoutId,
          });

        expect(
          current?.status,
        ).toBe(
          "creating_transfer",
        );

        expect(
          await sellerLedgerService
            .getAvailableBalanceSatang(
              state.sellerId,
            ),
        ).toBe(
          5000,
        );
      },
    );

    it(
      "recovers an existing Omise Transfer without creating another one",
      async () => {
        const state =
          await seedBalance(
            "RECOVERY",
            100,
          );

        const account =
          await seedReadyAccount(
            state.sellerId,
            state.shopId,
          );

        const payout =
          await payoutService
            .requestPayout({
              sellerId:
                state.sellerId,

              amountSatang:
                4000,
            });

        await Payout.updateOne(
          {
            payoutId:
              payout.payoutId,
          },
          {
            $set: {
              status:
                "creating_transfer",
            },
          },
        );

        const createSpy =
          vi.spyOn(
            omisePayoutProvider,
            "createTransfer",
          );

        vi.spyOn(
          omisePayoutProvider,
          "findExistingTransfer",
        ).mockResolvedValue(
          transferResult({
            id:
              "trsf_test_recovered",

            recipientId:
              account.recipientId!,

            amountSatang:
              4000,
          }),
        );

        const result =
          await payoutService
            .processPayout(
              payout.payoutId,
            );

        expect(
          createSpy,
        ).not.toHaveBeenCalled();

        expect(
          result.status,
        ).toBe(
          "submitted",
        );

        expect(
          result.providerTransferId,
        ).toBe(
          "trsf_test_recovered",
        );
      },
    );

    it(
      "releases reserved seller balance after a definite fail-fast Omise failure",
      async () => {
        const state =
          await seedBalance(
            "FAIL-RELEASE",
            100,
          );

        const account =
          await seedReadyAccount(
            state.sellerId,
            state.shopId,
          );

        const payout =
          await payoutService
            .requestPayout({
              sellerId:
                state.sellerId,

              amountSatang:
                4000,
            });

        vi.spyOn(
          omisePayoutProvider,
          "createTransfer",
        ).mockResolvedValue(
          transferResult({
            id:
              "trsf_test_failed",

            recipientId:
              account.recipientId!,

            amountSatang:
              4000,

            failureCode:
              "insufficient_balance",
          }),
        );

        const result =
          await payoutService
            .processPayout(
              payout.payoutId,
            );

        expect(
          result.status,
        ).toBe(
          "failed",
        );

        expect(
          await sellerLedgerService
            .getAvailableBalanceSatang(
              state.sellerId,
            ),
        ).toBe(
          10000,
        );

        const movements =
          await SellerLedgerEntry
            .find({
              payoutId:
                payout.payoutId,
            });

        expect(
          movements.map(
            (entry) =>
              entry.amountSatang,
          ).sort(
            (a, b) =>
              a - b,
          ),
        ).toEqual([
          -4000,
          4000,
        ]);
      },
    );

    it(
      "rejects payout when the Recipient is not active and verified",
      async () => {
        const state =
          await seedBalance(
            "NOT-READY",
            100,
          );

        await SellerPayoutAccount
          .create({
            payoutAccountId:
              "PACC-NOT-READY",

            sellerId:
              state.sellerId,

            shopId:
              state.shopId,

            status:
              "pending_verification",

            provider:
              "omise",

            recipientId:
              "recp_test_notready",

            recipientActive:
              true,

            recipientVerified:
              false,
          });

        await expect(
          payoutService
            .requestPayout({
              sellerId:
                state.sellerId,

              amountSatang:
                5000,
            }),
        ).rejects.toThrow(
          /ยังไม่พร้อม/,
        );

        expect(
          await Payout
            .countDocuments({}),
        ).toBe(
          0,
        );

        expect(
          await sellerLedgerService
            .getAvailableBalanceSatang(
              state.sellerId,
            ),
        ).toBe(
          10000,
        );
      },
    );
  },
);
