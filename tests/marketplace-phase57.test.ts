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
  Payout,
} from "../src/models/Payout.ts";

import {
  SellerPayoutAccount,
} from "../src/models/SellerPayoutAccount.ts";

import {
  WebhookEvent,
} from "../src/models/WebhookEvent.ts";

import {
  omisePayoutProvider,
} from "../src/services/payment/providers/omisePayoutProvider.ts";

import {
  omiseWebhookReconciliationService,
} from "../src/services/omiseWebhookReconciliationService.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

function transferSnapshot(
  data: {
    id:
      string;

    recipientId:
      string;

    amountSatang?:
      number;

    sent?:
      boolean;

    paid?:
      boolean;

    deleted?:
      boolean;

    failureCode?:
      string |
      null;

    feeSatang?:
      number |
      null;

    netSatang?:
      number |
      null;
  },
) {
  const amount =
    data.amountSatang ??
    5000;

  return {
    providerTransferId:
      data.id,

    recipientId:
      data.recipientId,

    amountSatang:
      amount,

    currency:
      "THB",

    sendable:
      !data.sent &&
      !data.paid,

    sent:
      data.sent ??
      data.paid ??
      false,

    paid:
      data.paid ??
      false,

    deleted:
      data.deleted ??
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
      data.failureCode ??
      null,

    failureMessage:
      null,

    feeSatang:
      data.feeSatang ??
      null,

    netSatang:
      data.netSatang ??
      null,
  };
}

function recipientSnapshot(
  data: {
    id:
      string;

    active:
      boolean;

    verified:
      boolean;

    deleted?:
      boolean;
  },
) {
  return {
    recipientId:
      data.id,

    deleted:
      data.deleted ??
      false,

    active:
      data.active,

    verified:
      data.verified,

    failureCode:
      null,

    bankCode:
      "test",

    bankBrand:
      "Test Bank",

    bankLastDigits:
      "1234",

    accountHolderName:
      "NEXORA TEST",
  };
}

async function seedPayout(
  suffix:
    string,

  options: {
    status?:
      "creating_transfer" |
      "submitted" |
      "sent" |
      "paid";

    providerTransferId?:
      string |
      null;
  } = {},
) {
  const status =
    options.status ??
    "submitted";

  return Payout.create({
    payoutId:
      `PO-PH57-${suffix}`,

    sellerId:
      `SELLER-PH57-${suffix}`,

    shopId:
      `SHOP-PH57-${suffix}`,

    payoutAccountId:
      `PACC-PH57-${suffix}`,

    provider:
      "omise",

    recipientId:
      `recp_test_ph57_${suffix}`,

    amountSatang:
      5000,

    currency:
      "THB",

    feePolicy:
      "seller_pays",

    status,

    idempotencyKey:
      `nexora-ph57-${suffix}`,

    providerTransferId:
      options
        .providerTransferId ??
      null,

    submittedAt:
      status ===
        "submitted" ||
      status ===
        "sent" ||
      status ===
        "paid"
        ? new Date()
        : null,
  });
}

async function seedAccount(
  suffix:
    string,

  recipientId:
    string |
    null,
) {
  return SellerPayoutAccount
    .create({
      payoutAccountId:
        `PACC-PH57-${suffix}`,

      sellerId:
        `SELLER-PH57-${suffix}`,

      shopId:
        `SHOP-PH57-${suffix}`,

      provider:
        "omise",

      status:
        recipientId
          ? "ready"
          : "creating",

      recipientId,

      recipientActive:
        !!recipientId,

      recipientVerified:
        !!recipientId,

      bankCode:
        recipientId
          ? "test"
          : null,

      bankLastDigits:
        recipientId
          ? "1234"
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
          "nexora-phase57",
      },
    );

    await Promise.all([
      Payout.syncIndexes(),
      SellerPayoutAccount
        .syncIndexes(),
      WebhookEvent
        .syncIndexes(),
    ]);
  },
  120_000,
);

afterEach(
  async () => {
    vi.restoreAllMocks();

    await Promise.all([
      Payout.deleteMany({}),
      SellerPayoutAccount
        .deleteMany({}),
      WebhookEvent
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
  "NEXORA Marketplace Phase 5.7 provider reconciliation",
  () => {
    it(
      "attaches a Transfer when transfer.create arrives before local providerTransferId finalize",
      async () => {
        const payout =
          await seedPayout(
            "EARLY-TRANSFER",
            {
              status:
                "creating_transfer",

              providerTransferId:
                null,
            },
          );

        const transferId =
          "trsf_test_ph57_early";

        vi.spyOn(
          omisePayoutProvider,
          "retrieveTransfer",
        ).mockResolvedValue(
          transferSnapshot({
            id:
              transferId,

            recipientId:
              payout.recipientId,
          }),
        );

        const result =
          await omiseWebhookReconciliationService
            .process({
              id:
                "EV-PH57-EARLY-TRANSFER",

              key:
                "transfer.create",

              data: {
                id:
                  transferId,

                metadata: {
                  nexora_payout_id:
                    payout.payoutId,
                },
              },
            });

        expect(
          result.processed,
        ).toBe(
          true,
        );

        const stored =
          await Payout.findOne({
            payoutId:
              payout.payoutId,
          });

        expect(
          stored
            ?.providerTransferId,
        ).toBe(
          transferId,
        );

        expect(
          stored?.status,
        ).toBe(
          "submitted",
        );
      },
    );

    it(
      "reconciles transfer.pay accounting exactly once for the same event ID",
      async () => {
        const transferId =
          "trsf_test_ph57_paid";

        const payout =
          await seedPayout(
            "PAID",
            {
              status:
                "submitted",

              providerTransferId:
                transferId,
            },
          );

        const retrieveSpy =
          vi.spyOn(
            omisePayoutProvider,
            "retrieveTransfer",
          ).mockResolvedValue(
            transferSnapshot({
              id:
                transferId,

              recipientId:
                payout.recipientId,

              sent:
                true,

              paid:
                true,

              feeSatang:
                2000,

              netSatang:
                3000,
            }),
          );

        const event = {
          id:
            "EV-PH57-PAID",

          key:
            "transfer.pay",

          data: {
            id:
              transferId,
          },
        };

        const first =
          await omiseWebhookReconciliationService
            .process(
              event,
            );

        const second =
          await omiseWebhookReconciliationService
            .process(
              event,
            );

        expect(
          first.processed,
        ).toBe(
          true,
        );

        expect(
          second.duplicate,
        ).toBe(
          true,
        );

        expect(
          retrieveSpy,
        ).toHaveBeenCalledTimes(
          1,
        );

        const stored =
          await Payout.findOne({
            payoutId:
              payout.payoutId,
          });

        expect(
          stored?.status,
        ).toBe(
          "paid",
        );

        expect(
          stored?.feeSatang,
        ).toBe(
          2000,
        );

        expect(
          stored?.netSatang,
        ).toBe(
          3000,
        );
      },
    );

    it(
      "reclaims a failed webhook event and reconciles it on retry",
      async () => {
        const transferId =
          "trsf_test_ph57_retry";

        const payout =
          await seedPayout(
            "RETRY",
            {
              status:
                "submitted",

              providerTransferId:
                transferId,
            },
          );

        vi.spyOn(
          omisePayoutProvider,
          "retrieveTransfer",
        )
          .mockRejectedValueOnce(
            new Error(
              "network timeout",
            ),
          )
          .mockResolvedValueOnce(
            transferSnapshot({
              id:
                transferId,

              recipientId:
                payout.recipientId,

              sent:
                true,

              paid:
                true,

              feeSatang:
                2000,

              netSatang:
                3000,
            }),
          );

        const event = {
          id:
            "EV-PH57-RETRY",

          key:
            "transfer.pay",

          data: {
            id:
              transferId,
          },
        };

        await expect(
          omiseWebhookReconciliationService
            .process(
              event,
            ),
        ).rejects.toThrow(
          "network timeout",
        );

        expect(
          (
            await WebhookEvent
              .findOne({
                eventId:
                  event.id,
              })
          )?.status,
        ).toBe(
          "failed",
        );

        const retried =
          await omiseWebhookReconciliationService
            .process(
              event,
            );

        expect(
          retried.processed,
        ).toBe(
          true,
        );

        expect(
          (
            await WebhookEvent
              .findOne({
                eventId:
                  event.id,
              })
          )?.status,
        ).toBe(
          "processed",
        );
      },
    );

    it(
      "attaches Recipient when recipient.create arrives before local recipientId finalize",
      async () => {
        const account =
          await seedAccount(
            "EARLY-RECIPIENT",
            null,
          );

        const recipientId =
          "recp_test_ph57_early";

        vi.spyOn(
          omisePayoutProvider,
          "retrieveRecipient",
        ).mockResolvedValue(
          recipientSnapshot({
            id:
              recipientId,

            active:
              true,

            verified:
              true,
          }),
        );

        const result =
          await omiseWebhookReconciliationService
            .process({
              id:
                "EV-PH57-EARLY-RECIPIENT",

              key:
                "recipient.create",

              data: {
                id:
                  recipientId,

                metadata: {
                  nexora_payout_account_id:
                    account.payoutAccountId,
                },
              },
            });

        expect(
          result.processed,
        ).toBe(
          true,
        );

        const stored =
          await SellerPayoutAccount
            .findOne({
              payoutAccountId:
                account.payoutAccountId,
            });

        expect(
          stored?.recipientId,
        ).toBe(
          recipientId,
        );

        expect(
          stored?.status,
        ).toBe(
          "ready",
        );
      },
    );

    it(
      "removes payout readiness when Recipient becomes inactive",
      async () => {
        const recipientId =
          "recp_test_ph57_inactive";

        const account =
          await seedAccount(
            "INACTIVE",
            recipientId,
          );

        vi.spyOn(
          omisePayoutProvider,
          "retrieveRecipient",
        ).mockResolvedValue(
          recipientSnapshot({
            id:
              recipientId,

            active:
              false,

            verified:
              true,
          }),
        );

        await omiseWebhookReconciliationService
          .process({
            id:
              "EV-PH57-INACTIVE",

            key:
              "recipient.deactivate",

            data: {
              id:
                recipientId,
            },
          });

        const stored =
          await SellerPayoutAccount
            .findOne({
              payoutAccountId:
                account.payoutAccountId,
            });

        expect(
          stored
            ?.recipientActive,
        ).toBe(
          false,
        );

        expect(
          stored?.status,
        ).toBe(
          "pending_verification",
        );
      },
    );

    it(
      "ignores provider resources that do not belong to NEXORA",
      async () => {
        const result =
          await omiseWebhookReconciliationService
            .process({
              id:
                "EV-PH57-FOREIGN",

              key:
                "transfer.pay",

              data: {
                id:
                  "trsf_test_foreign",

                metadata: {
                  nexora_payout_id:
                    "PO-DOES-NOT-EXIST",
                },
              },
            });

        expect(
          result.ignored,
        ).toBe(
          true,
        );

        expect(
          await WebhookEvent
            .countDocuments({
              eventId:
                "EV-PH57-FOREIGN",
            }),
        ).toBe(
          0,
        );
      },
    );

    it(
      "wires Transfer and Recipient reconciliation into the signed webhook route",
      () => {
        const source =
          readFileSync(
            "src/api/routes/webhooks.ts",
            "utf8",
          );

        expect(
          source,
        ).toContain(
          "isSupportedOmiseReconciliationEvent",
        );

        expect(
          source,
        ).toContain(
          "omiseWebhookReconciliationService",
        );

        expect(
          source,
        ).toContain(
          "verifyOmiseWebhookSignature",
        );
      },
    );
  },
);
