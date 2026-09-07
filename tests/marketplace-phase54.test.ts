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
  Refund,
} from "../src/models/Refund.ts";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  shopArchiveService,
} from "../src/services/shopArchiveService.ts";

import {
  payoutService,
  reconcileOpenPayouts,
} from "../src/services/payoutService.ts";

import {
  omisePayoutProvider,
} from "../src/services/payment/providers/omisePayoutProvider.ts";

import {
  assertMarketplaceFinancialRuntimeSafety,
} from "../src/services/marketplace/financialRuntimeSafety.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

async function seedShop(
  suffix:
    string,
) {
  return Shop.create({
    shopId:
      `SHOP-${suffix}`,

    ownerId:
      `SELLER-${suffix}`,

    forumThreadId:
      `THREAD-${suffix}`,

    name:
      `Shop ${suffix}`,

    description:
      "Phase 5.4",

    category:
      "other",

    status:
      "verified",
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

    feeSatang:
      number |
      null;

    netSatang:
      number |
      null;

    paid?:
      boolean;

    sent?:
      boolean;
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
      data.sent ??
      data.paid ??
      false,

    paid:
      data.paid ??
      false,

    deleted:
      false,

    sentAt:
      data.sent ||
      data.paid
        ? new Date()
        : null,

    paidAt:
      data.paid
        ? new Date()
        : null,

    failureCode:
      null,

    failureMessage:
      null,

    feeSatang:
      data.feeSatang,

    netSatang:
      data.netSatang,
  };
}

async function seedPayout(
  suffix:
    string,

  status:
    | "reserved"
    | "creating_transfer"
    | "submitted"
    | "sent"
    | "paid"
    | "failed" =
      "submitted",
) {
  return Payout.create({
    payoutId:
      `PO-${suffix}`,

    sellerId:
      `SELLER-${suffix}`,

    shopId:
      `SHOP-${suffix}`,

    payoutAccountId:
      `PACC-${suffix}`,

    recipientId:
      `recp_test_${suffix}`,

    amountSatang:
      10_000,

    currency:
      "THB",

    feePolicy:
      "seller_pays",

    status,

    idempotencyKey:
      `nexora-payout-${suffix}`,

    providerTransferId:
      status ===
        "submitted" ||
      status ===
        "sent" ||
      status ===
        "paid"
        ? `trsf_test_${suffix}`
        : null,
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
          "nexora-marketplace-phase54",
      },
    );

    await Promise.all([
      Shop.syncIndexes(),
      Order.syncIndexes(),
      Refund.syncIndexes(),
      Payout.syncIndexes(),
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

afterEach(
  async () => {
    vi.restoreAllMocks();

    await Promise.all([
      Shop.deleteMany({}),
      Order.deleteMany({}),
      Refund.deleteMany({}),
      Payout.deleteMany({}),
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
);

describe(
  "NEXORA Marketplace Phase 5.4 production financial safety",
  () => {
    it(
      "blocks a live Omise key in production",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_live_DO_NOT_USE",

              OMISE_PUBLIC_KEY:
                "pkey_test_nexora",

              NEXORA_PAYMENT_METHODS:
                "promptpay,truemoney",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "other",

              OMISE_WEBHOOK_SECRET:
                "abcdefghijklmnop",

              NEXORA_PAYMENT_RETURN_URL:
                "https://example.com",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",
            }),
        ).toThrow(
          /Live Omise key/,
        );
      },
    );

    it(
      "accepts complete Test Mode production configuration",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_phase54",

              OMISE_PUBLIC_KEY:
                "pkey_test_nexora",

              NEXORA_PAYMENT_METHODS:
                "promptpay,truemoney",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "other",

              OMISE_WEBHOOK_SECRET:
                "abcdefghijklmnop",

              NEXORA_PAYMENT_RETURN_URL:
                "https://example.com",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",
            }),
        ).not.toThrow();
      },
    );

    it(
      "archives Shop without deleting its financial identity",
      async () => {
        const shop =
          await seedShop(
            "ARCHIVE",
          );

        const result =
          await shopArchiveService
            .archiveShop({
              ownerId:
                shop.ownerId,

              actorId:
                shop.ownerId,
            });

        expect(
          result.forumThreadId,
        ).toBe(
          "THREAD-ARCHIVE",
        );

        expect(
          await Shop.countDocuments({
            shopId:
              shop.shopId,
          }),
        ).toBe(
          1,
        );

        const stored =
          await Shop.findOne({
            shopId:
              shop.shopId,
          });

        expect(
          stored?.status,
        ).toBe(
          "closed",
        );

        expect(
          stored?.deletedAt,
        ).toBeInstanceOf(
          Date,
        );

        expect(
          stored?.forumThreadId,
        ).toBeNull();

        expect(
          stored
            ?.archivedForumThreadId,
        ).toBe(
          "THREAD-ARCHIVE",
        );
      },
    );

    it(
      "blocks Shop archive while an Order is active",
      async () => {
        const shop =
          await seedShop(
            "ACTIVE-ORDER",
          );

        await Order.create({
          orderId:
            "ORDER-ACTIVE",

          buyerId:
            "BUYER-ACTIVE",

          sellerId:
            shop.ownerId,

          shopId:
            shop.shopId,

          productId:
            "PRODUCT-ACTIVE",

          productName:
            "Product",

          quantity:
            1,

          unitPrice:
            100,

          totalAmount:
            100,

          status:
            "paid",

          paymentMethod:
            "promptpay",

          metadata: {
            stockReserved:
              true,

            stockReleased:
              false,
          },
        });

        await expect(
          shopArchiveService
            .archiveShop({
              ownerId:
                shop.ownerId,

              actorId:
                shop.ownerId,
            }),
        ).rejects.toThrow(
          /คำสั่งซื้อ/,
        );

        const stored =
          await Shop.findOne({
            shopId:
              shop.shopId,
          });

        expect(
          stored?.status,
        ).toBe(
          "verified",
        );

        expect(
          stored?.deletedAt,
        ).toBeNull();
      },
    );

    it(
      "blocks Shop archive while a Payout is active",
      async () => {
        const shop =
          await seedShop(
            "ACTIVE-PAYOUT",
          );

        await Payout.create({
          payoutId:
            "PO-ACTIVE-PAYOUT",

          sellerId:
            shop.ownerId,

          shopId:
            shop.shopId,

          payoutAccountId:
            "PACC-ACTIVE",

          recipientId:
            "recp_test_active",

          amountSatang:
            5000,

          currency:
            "THB",

          status:
            "submitted",

          idempotencyKey:
            "nexora-payout-active",

          providerTransferId:
            "trsf_test_active",
        });

        await expect(
          shopArchiveService
            .archiveShop({
              ownerId:
                shop.ownerId,

              actorId:
                shop.ownerId,
            }),
        ).rejects.toThrow(
          /Payout/,
        );

        expect(
          (
            await Shop.findOne({
              shopId:
                shop.shopId,
            })
          )?.deletedAt,
        ).toBeNull();
      },
    );

    it(
      "prevents an archived Shop from being reopened through a stale update",
      async () => {
        const shop =
          await seedShop(
            "IMMUTABLE",
          );

        await shopArchiveService
          .archiveShop({
            ownerId:
              shop.ownerId,

            actorId:
              shop.ownerId,
          });

        const reopened =
          await Shop
            .findOneAndUpdate(
              {
                shopId:
                  shop.shopId,
              },
              {
                $set: {
                  status:
                    "verified",
                },
              },
              {
                new: true,
              },
            );

        expect(
          reopened,
        ).toBeNull();

        const stored =
          await Shop.findOne({
            shopId:
              shop.shopId,
          });

        expect(
          stored?.status,
        ).toBe(
          "closed",
        );
      },
    );

    it(
      "records seller-pays fee and net when Omise Transfer reaches paid",
      async () => {
        const payout =
          await seedPayout(
            "FEE-PAID",
          );

        vi.spyOn(
          omisePayoutProvider,
          "retrieveTransfer",
        ).mockResolvedValue(
          transferResult({
            id:
              payout.providerTransferId!,

            recipientId:
              payout.recipientId,

            amountSatang:
              10_000,

            feeSatang:
              3000,

            netSatang:
              7000,

            paid:
              true,
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
          "paid",
        );

        expect(
          result.feePolicy,
        ).toBe(
          "seller_pays",
        );

        expect(
          result.feeSatang,
        ).toBe(
          3000,
        );

        expect(
          result.netSatang,
        ).toBe(
          7000,
        );

        expect(
          result.lastReconciledAt,
        ).toBeInstanceOf(
          Date,
        );
      },
    );

    it(
      "rejects an inconsistent Omise amount fee and net combination",
      async () => {
        const payout =
          await seedPayout(
            "BAD-NET",
          );

        vi.spyOn(
          omisePayoutProvider,
          "retrieveTransfer",
        ).mockResolvedValue(
          transferResult({
            id:
              payout.providerTransferId!,

            recipientId:
              payout.recipientId,

            amountSatang:
              10_000,

            feeSatang:
              3000,

            netSatang:
              8000,

            paid:
              true,
          }),
        );

        await expect(
          payoutService
            .processPayout(
              payout.payoutId,
            ),
        ).rejects.toThrow(
          /amount - total_fee/,
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
      },
    );

    it(
      "reconciles open Payouts without creating a new Transfer",
      async () => {
        const payout =
          await seedPayout(
            "WORKER",
          );

        const retrieveSpy =
          vi.spyOn(
            omisePayoutProvider,
            "retrieveTransfer",
          ).mockResolvedValue(
            transferResult({
              id:
                payout.providerTransferId!,

              recipientId:
                payout.recipientId,

              amountSatang:
                10_000,

              feeSatang:
                3000,

              netSatang:
                7000,

              paid:
                true,
            }),
          );

        const createSpy =
          vi.spyOn(
            omisePayoutProvider,
            "createTransfer",
          );

        const result =
          await reconcileOpenPayouts(
            50,
          );

        expect(
          result,
        ).toEqual({
          checked:
            1,

          reconciled:
            1,

          failed:
            0,
        });

        expect(
          retrieveSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          createSpy,
        ).not.toHaveBeenCalled();

        expect(
          (
            await Payout.findOne({
              payoutId:
                payout.payoutId,
            })
          )?.status,
        ).toBe(
          "paid",
        );
      },
    );
  },
);
