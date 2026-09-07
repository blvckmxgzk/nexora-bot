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
  User,
} from "../src/models/User.ts";

import {
  Payment,
} from "../src/models/Payment.ts";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  Dispute,
} from "../src/models/Dispute.ts";

import {
  RiskEvent,
} from "../src/models/RiskEvent.ts";

import {
  RiskVelocityBucket,
} from "../src/models/RiskVelocityBucket.ts";

import {
  marketplaceRiskService,
  MarketplaceRiskBlockedError,
} from "../src/services/marketplace/marketplaceRiskService.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

function orderInput(
  buyerId:
    string,
) {
  return {
    orderId:
      `ORD-RISK-${Math.random()}`,

    buyerId,

    sellerId:
      "SELLER-RISK",

    shopId:
      "SHOP-RISK",

    productId:
      "PROD-RISK",

    quantity:
      1,

    requestedUnitPrice:
      100,
  };
}

async function seedFailedPayments(
  buyerId:
    string,

  count:
    number,
) {
  for (
    let i = 0;
    i < count;
    i++
  ) {
    await Payment.create({
      paymentId:
        `PAY-FAIL-${buyerId}-${i}`,

      orderId:
        `ORD-FAIL-${buyerId}-${i}`,

      buyerId,

      sellerId:
        "SELLER-RISK",

      shopId:
        "SHOP-RISK",

      provider:
        "promptpay",

      amount:
        100,

      status:
        "failed",

      expiresAt:
        new Date(
          Date.now() +
          60_000,
        ),
    });
  }
}

async function seedPaidPayout(
  sellerId:
    string,
) {
  await Payout.create({
    payoutId:
      `PO-PAID-${sellerId}`,

    sellerId,

    shopId:
      "SHOP-RISK",

    payoutAccountId:
      `PA-${sellerId}`,

    provider:
      "omise",

    recipientId:
      `recp_test_${sellerId}`,

    amountSatang:
      5000,

    currency:
      "THB",

    feePolicy:
      "seller_pays",

    status:
      "paid",

    idempotencyKey:
      `payout-risk-${sellerId}`,

    paidAt:
      new Date(),
  });
}

async function seedDispute(
  sellerId:
    string,
) {
  await Dispute.create({
    disputeId:
      `DSP-${sellerId}`,

    provider:
      "omise",

    providerDisputeId:
      `dspt_test_${sellerId}`,

    providerChargeId:
      `chrg_test_${sellerId}`,

    paymentId:
      `PAY-DSP-${sellerId}`,

    orderId:
      `ORD-DSP-${sellerId}`,

    sellerId,

    shopId:
      "SHOP-RISK",

    status:
      "open",

    amountSatang:
      10000,

    fundingAmountSatang:
      10000,

    sellerLiabilitySatang:
      9609,

    currency:
      "THB",

    fundingCurrency:
      "THB",

    providerDebitSatang:
      10000,

    providerCreditSatang:
      0,

    openedAt:
      new Date(),
  });
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
          "nexora-phase62",
      },
    );

    await Promise.all([
      User.syncIndexes(),
      Payment.syncIndexes(),
      Payout.syncIndexes(),
      Dispute.syncIndexes(),
      RiskEvent.syncIndexes(),
      RiskVelocityBucket
        .syncIndexes(),
    ]);
  },
  120_000,
);

afterEach(
  async () => {
    await Promise.all([
      User.deleteMany({}),
      Payment.deleteMany({}),
      Payout.deleteMany({}),
      Dispute.deleteMany({}),
      RiskEvent.deleteMany({}),
      RiskVelocityBucket
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
  "NEXORA Marketplace Phase 6.2A Risk Engine",
  () => {
    it(
      "allows normal Order creation attempt",
      async () => {
        const result =
          await marketplaceRiskService
            .evaluateOrderCreation(
              orderInput(
                "BUYER-ALLOW",
              ),
            );

        expect(
          result.decision,
        ).toBe(
          "allow",
        );

        expect(
          await RiskEvent
            .countDocuments({
              riskEventId:
                result
                  .riskEventId,
            }),
        ).toBe(
          1,
        );
      },
    );

    it(
      "new NEXORA Buyer is a soft signal only",
      async () => {
        await User.create({
          discordId:
            "BUYER-NEW",

          username:
            "new-user",

          firstSeenAt:
            new Date(),
        });

        const result =
          await marketplaceRiskService
            .evaluateOrderCreation(
              orderInput(
                "BUYER-NEW",
              ),
            );

        expect(
          result.decision,
        ).toBe(
          "allow",
        );

        expect(
          result.reasonCodes,
        ).toContain(
          "new_nexora_buyer",
        );
      },
    );

    it(
      "reviews Buyer at Order velocity review threshold",
      async () => {
        let result:
          any;

        for (
          let i = 0;
          i < 6;
          i++
        ) {
          result =
            await marketplaceRiskService
              .evaluateOrderCreation(
                orderInput(
                  "BUYER-ORDER-REVIEW",
                ),
              );
        }

        expect(
          result.decision,
        ).toBe(
          "review",
        );
      },
    );

    it(
      "blocks Buyer at Order velocity hard limit",
      async () => {
        let result:
          any;

        for (
          let i = 0;
          i < 10;
          i++
        ) {
          result =
            await marketplaceRiskService
              .evaluateOrderCreation(
                orderInput(
                  "BUYER-ORDER-BLOCK",
                ),
              );
        }

        expect(
          result.decision,
        ).toBe(
          "block",
        );

        expect(
          () =>
            marketplaceRiskService
              .assertNotBlocked(
                result,
              ),
        ).toThrow(
          MarketplaceRiskBlockedError,
        );
      },
    );

    it(
      "atomic velocity bucket handles concurrent Order attempts",
      async () => {
        const results =
          await Promise.all(
            Array.from({
              length:
                10,
            }).map(
              () =>
                marketplaceRiskService
                  .evaluateOrderCreation(
                    orderInput(
                      "BUYER-CONCURRENT",
                    ),
                  ),
            ),
          );

        expect(
          await RiskVelocityBucket
            .countDocuments({
              subjectId:
                "BUYER-CONCURRENT",

              action:
                "order_create",
            }),
        ).toBe(
          1,
        );

        const bucket =
          await RiskVelocityBucket
            .findOne({
              subjectId:
                "BUYER-CONCURRENT",
            });

        expect(
          bucket?.count,
        ).toBe(
          10,
        );

        expect(
          results.filter(
            (
              result,
            ) =>
              result.decision ===
              "block",
          ),
        ).toHaveLength(
          1,
        );
      },
    );

    it(
      "reviews Buyer after 3 recent failed Payments",
      async () => {
        await seedFailedPayments(
          "BUYER-FAIL-REVIEW",
          3,
        );

        const result =
          await marketplaceRiskService
            .evaluatePaymentCreation({
              orderId:
                "ORD-NEW",

              buyerId:
                "BUYER-FAIL-REVIEW",

              sellerId:
                "SELLER-RISK",

              shopId:
                "SHOP-RISK",

              provider:
                "promptpay",

              amountBaht:
                100,
            });

        expect(
          result.decision,
        ).toBe(
          "review",
        );

        expect(
          result.reasonCodes,
        ).toContain(
          "repeated_failed_payments_review",
        );
      },
    );

    it(
      "blocks Buyer after 5 recent failed Payments",
      async () => {
        await seedFailedPayments(
          "BUYER-FAIL-BLOCK",
          5,
        );

        const result =
          await marketplaceRiskService
            .evaluatePaymentCreation({
              orderId:
                "ORD-NEW",

              buyerId:
                "BUYER-FAIL-BLOCK",

              sellerId:
                "SELLER-RISK",

              shopId:
                "SHOP-RISK",

              provider:
                "promptpay",

              amountBaht:
                100,
            });

        expect(
          result.decision,
        ).toBe(
          "block",
        );
      },
    );

    it(
      "blocks excessive Payment creation velocity",
      async () => {
        let result:
          any;

        for (
          let i = 0;
          i < 8;
          i++
        ) {
          result =
            await marketplaceRiskService
              .evaluatePaymentCreation({
                orderId:
                  `ORD-PAY-VEL-${i}`,

                buyerId:
                  "BUYER-PAY-VEL",

                sellerId:
                  "SELLER-RISK",

                shopId:
                  "SHOP-RISK",

                provider:
                  "promptpay",

                amountBaht:
                  100,
              });
        }

        expect(
          result.decision,
        ).toBe(
          "block",
        );
      },
    );

    it(
      "blocks Payout during post-paid cooldown",
      async () => {
        await seedPaidPayout(
          "SELLER-COOLDOWN",
        );

        const result =
          await marketplaceRiskService
            .evaluatePayoutRequest({
              sellerId:
                "SELLER-COOLDOWN",

              shopId:
                "SHOP-RISK",

              amountSatang:
                5000,
            });

        expect(
          result.decision,
        ).toBe(
          "block",
        );

        expect(
          result.reasonCodes,
        ).toContain(
          "seller_payout_cooldown",
        );
      },
    );

    it(
      "reviews then blocks repeated Payout attempts",
      async () => {
        let second:
          any;

        let fourth:
          any;

        for (
          let i = 1;
          i <= 4;
          i++
        ) {
          const result =
            await marketplaceRiskService
              .evaluatePayoutRequest({
                sellerId:
                  "SELLER-PAYOUT-VEL",

                shopId:
                  "SHOP-RISK",

                amountSatang:
                  5000,
              });

          if (
            i ===
            2
          ) {
            second =
              result;
          }

          if (
            i ===
            4
          ) {
            fourth =
              result;
          }
        }

        expect(
          second.decision,
        ).toBe(
          "review",
        );

        expect(
          fourth.decision,
        ).toBe(
          "block",
        );
      },
    );

    it(
      "recent Seller dispute produces Payout review signal",
      async () => {
        await seedDispute(
          "SELLER-DISPUTE",
        );

        const result =
          await marketplaceRiskService
            .evaluatePayoutRequest({
              sellerId:
                "SELLER-DISPUTE",

              shopId:
                "SHOP-RISK",

              amountSatang:
                5000,
            });

        expect(
          result.decision,
        ).toBe(
          "allow",
        );

        /*
         * 40 คะแนนยังไม่ถึง review threshold 50
         * แต่ signal ต้องถูกเก็บไว้
         */
        expect(
          result.reasonCodes,
        ).toContain(
          "seller_recent_dispute",
        );
      },
    );

    it(
      "source guards wire Risk Engine into business mutation boundaries",
      () => {
        const orderSource =
          readFileSync(
            "src/services/orderService.ts",
            "utf8",
          );

        const paymentSource =
          readFileSync(
            "src/services/paymentService.ts",
            "utf8",
          );

        const payoutSource =
          readFileSync(
            "src/services/payoutService.ts",
            "utf8",
          );

        expect(
          orderSource,
        ).toContain(
          "evaluateOrderCreation",
        );

        expect(
          paymentSource,
        ).toContain(
          "evaluatePaymentCreation",
        );

        expect(
          payoutSource,
        ).toContain(
          "evaluatePayoutRequest",
        );

        expect(
          orderSource,
        ).toContain(
          "assertNotBlocked",
        );

        expect(
          paymentSource,
        ).toContain(
          "assertNotBlocked",
        );

        expect(
          payoutSource,
        ).toContain(
          "assertNotBlocked",
        );
      },
    );
  },
);
