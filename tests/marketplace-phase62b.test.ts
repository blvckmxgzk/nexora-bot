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
  RiskEvent,
} from "../src/models/RiskEvent.ts";

import {
  RiskVelocityBucket,
} from "../src/models/RiskVelocityBucket.ts";

import {
  RiskReview,
} from "../src/models/RiskReview.ts";

import {
  RiskReviewAction,
} from "../src/models/RiskReviewAction.ts";

import {
  Refund,
} from "../src/models/Refund.ts";

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
  SellerLedgerEntry,
} from "../src/models/SellerLedgerEntry.ts";

import {
  marketplaceRiskService,
  type MarketplaceRiskDecision,
} from "../src/services/marketplace/marketplaceRiskService.ts";

import {
  marketplaceRiskReviewService,
} from "../src/services/marketplace/marketplaceRiskReviewService.ts";

import {
  runPreLiveFinancialAudit,
} from "../src/services/marketplace/preLiveFinancialAuditService.ts";

import {
  financialIntegrityService,
} from "../src/services/marketplace/financialIntegrityService.ts";

import {
  payoutProviderRegistry,
} from "../src/services/payment/payoutProviderRegistry.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

function reviewDecision(
  riskEventId:
    string,
): MarketplaceRiskDecision {
  return {
    riskEventId,

    decision:
      "review",

    score:
      60,

    reasonCodes: [
      "phase62b_test_review",
    ],

    metrics: {},
  };
}

async function createRiskEvent(
  id:
    string,

  subjectType:
    "buyer" |
    "seller" =
      "seller",
) {
  await RiskEvent.create({
    riskEventId:
      id,

    subjectType,

    subjectId:
      subjectType ===
        "seller"
        ? "SELLER-62B"
        : "BUYER-62B",

    action:
      subjectType ===
        "seller"
        ? "payout_request"
        : "refund_request",

    decision:
      "review",

    score:
      60,

    reasonCodes: [
      "phase62b_test_review",
    ],

    policyVersion:
      "marketplace_risk_v1",

    occurredAt:
      new Date(),
  });
}

async function createRefund(
  suffix:
    string,
) {
  return Refund.create({
    refundId:
      `REF-62B-${suffix}`,

    orderId:
      `ORD-62B-${suffix}`,

    paymentId:
      `PAY-62B-${suffix}`,

    shopId:
      "SHOP-62B",

    buyerId:
      `BUYER-62B-${suffix}`,

    sellerId:
      "SELLER-62B",

    provider:
      "omise",

    providerPaymentId:
      `chrg_test_62b_${suffix}`,

    amount:
      100,

    currency:
      "THB",

    reason:
      "Phase 6.2B test refund",

    status:
      "requested",

    requestedBy:
      `BUYER-62B-${suffix}`,
  });
}

async function createReservedPayout(
  suffix:
    string,
) {
  const payout =
    await Payout.create({
      payoutId:
        `PO-62B-${suffix}`,

      sellerId:
        `SELLER-62B-${suffix}`,

      shopId:
        `SHOP-62B-${suffix}`,

      payoutAccountId:
        `PA-62B-${suffix}`,

      provider:
        "omise",

      recipientId:
        `recp_test_62b_${suffix}`,

      amountSatang:
        5000,

      currency:
        "THB",

      feePolicy:
        "seller_pays",

      status:
        "reserved",

      idempotencyKey:
        `nexora-62b-${suffix}`,

      requestedAt:
        new Date(),

      metadata: {},
    });

  await SellerLedgerEntry.create({
    ledgerEntryId:
      `LED-62B-RESERVE-${suffix}`,

    sourceKey:
      `payout-reserve:${payout.payoutId}`,

    sellerId:
      payout.sellerId,

    shopId:
      payout.shopId,

    payoutId:
      payout.payoutId,

    type:
      "payout_reserve",

    amountSatang:
      -5000,

    currency:
      "THB",
  });

  return payout;
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
          "nexora-phase62b",
      },
    );

    await Promise.all([
      RiskEvent.syncIndexes(),

      RiskVelocityBucket
        .syncIndexes(),

      RiskReview.syncIndexes(),

      RiskReviewAction
        .syncIndexes(),

      Refund.syncIndexes(),

      Payment.syncIndexes(),

      Payout.syncIndexes(),

      Dispute.syncIndexes(),

      SellerLedgerEntry
        .syncIndexes(),
    ]);
  },
  120_000,
);

afterEach(
  async () => {
    vi.restoreAllMocks();

    await Promise.all([
      RiskEvent.deleteMany({}),

      RiskVelocityBucket
        .deleteMany({}),

      RiskReview.deleteMany({}),

      RiskReviewAction
        .deleteMany({}),

      Refund.deleteMany({}),

      Payment.deleteMany({}),

      Payout.deleteMany({}),

      Dispute.deleteMany({}),

      SellerLedgerEntry
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
  "NEXORA Marketplace Phase 6.2B Risk Reviews",
  () => {
    it(
      "normal Refund risk evaluation allows first request",
      async () => {
        const result =
          await marketplaceRiskService
            .evaluateRefundRequest({
              refundId:
                "REF-EVAL-ALLOW",

              orderId:
                "ORD-EVAL-ALLOW",

              buyerId:
                "BUYER-EVAL-ALLOW",

              sellerId:
                "SELLER-EVAL-ALLOW",

              shopId:
                "SHOP-EVAL",

              amountBaht:
                100,
            });

        expect(
          result.decision,
        ).toBe(
          "allow",
        );
      },
    );

    it(
      "Refund velocity enters REVIEW at third attempt",
      async () => {
        let result:
          any;

        for (
          let i = 1;
          i <= 3;
          i++
        ) {
          result =
            await marketplaceRiskService
              .evaluateRefundRequest({
                refundId:
                  `REF-EVAL-REVIEW-${i}`,

                orderId:
                  `ORD-EVAL-REVIEW-${i}`,

                buyerId:
                  "BUYER-EVAL-REVIEW",

                sellerId:
                  "SELLER-EVAL-REVIEW",

                shopId:
                  "SHOP-EVAL",

                amountBaht:
                  100,
              });
        }

        expect(
          result.decision,
        ).toBe(
          "review",
        );

        expect(
          result.reasonCodes,
        ).toContain(
          "buyer_refund_velocity_review",
        );
      },
    );

    it(
      "Refund velocity BLOCKS at fifth attempt",
      async () => {
        let result:
          any;

        for (
          let i = 1;
          i <= 5;
          i++
        ) {
          result =
            await marketplaceRiskService
              .evaluateRefundRequest({
                refundId:
                  `REF-EVAL-BLOCK-${i}`,

                orderId:
                  `ORD-EVAL-BLOCK-${i}`,

                buyerId:
                  "BUYER-EVAL-BLOCK",

                sellerId:
                  "SELLER-EVAL-BLOCK",

                shopId:
                  "SHOP-EVAL",

                amountBaht:
                  100,
              });
        }

        expect(
          result.decision,
        ).toBe(
          "block",
        );

        expect(
          result.reasonCodes,
        ).toContain(
          "buyer_refund_velocity_block",
        );
      },
    );

    it(
      "seller refund/dispute history contributes real review signals",
      async () => {
        const sellerId =
          "SELLER-HISTORY";

        for (
          let i = 0;
          i < 5;
          i++
        ) {
          await Payment.create({
            paymentId:
              `PAY-HISTORY-${i}`,

            orderId:
              `ORD-HISTORY-${i}`,

            buyerId:
              `BUYER-HISTORY-${i}`,

            sellerId,

            shopId:
              "SHOP-HISTORY",

            provider:
              "promptpay",

            amount:
              100,

            status:
              "paid",

            expiresAt:
              new Date(),
          });
        }

        for (
          let i = 0;
          i < 3;
          i++
        ) {
          await Refund.create({
            refundId:
              `REF-HISTORY-${i}`,

            orderId:
              `ORD-HISTORY-${i}`,

            paymentId:
              `PAY-HISTORY-${i}`,

            shopId:
              "SHOP-HISTORY",

            buyerId:
              `OTHER-BUYER-${i}`,

            sellerId,

            provider:
              "omise",

            providerPaymentId:
              `chrg_test_history_${i}`,

            amount:
              100,

            reason:
              "History refund",

            status:
              "completed",

            requestedBy:
              `OTHER-BUYER-${i}`,
          });
        }

        await Dispute.create({
          disputeId:
            "DSP-HISTORY",

          provider:
            "omise",

          providerDisputeId:
            "dspt_test_history",

          providerChargeId:
            "chrg_test_history",

          paymentId:
            "PAY-DSP-HISTORY",

          orderId:
            "ORD-DSP-HISTORY",

          sellerId,

          shopId:
            "SHOP-HISTORY",

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

        const result =
          await marketplaceRiskService
            .evaluateRefundRequest({
              refundId:
                "REF-HISTORY-CURRENT",

              orderId:
                "ORD-HISTORY-CURRENT",

              buyerId:
                "BUYER-HISTORY-CURRENT",

              sellerId,

              shopId:
                "SHOP-HISTORY",

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
          "seller_high_refund_ratio",
        );

        expect(
          result.reasonCodes,
        ).toContain(
          "seller_recent_adverse_dispute",
        );
      },
    );

    it(
      "creates pending RiskReview only for REVIEW decision",
      async () => {
        await createRiskEvent(
          "RSE-CREATE",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-CREATE",
                ),

              resourceType:
                "payout",

              resourceId:
                "PO-CREATE",

              subjectType:
                "seller",

              subjectId:
                "SELLER-62B",

              sellerId:
                "SELLER-62B",

              shopId:
                "SHOP-62B",
            });

        expect(
          review.status,
        ).toBe(
          "pending",
        );
      },
    );

    it(
      "pending Payout review blocks Transfer",
      async () => {
        const payout =
          await createReservedPayout(
            "PENDING",
          );

        await createRiskEvent(
          "RSE-PAYOUT-PENDING",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-PAYOUT-PENDING",
                ),

              resourceType:
                "payout",

              resourceId:
                payout.payoutId,

              subjectType:
                "seller",

              subjectId:
                payout.sellerId,

              sellerId:
                payout.sellerId,

              shopId:
                payout.shopId,
            });

        payout.metadata = {
          riskDecision:
            "review",

          riskReviewId:
            review.reviewId,

          riskReviewStatus:
            "pending",
        };

        await payout.save();

        await expect(
          marketplaceRiskReviewService
            .assertPayoutTransferAllowed(
              payout,
            ),
        ).rejects.toThrow(
          /Risk Review/,
        );
      },
    );

    it(
      "approved Payout review releases Transfer gate",
      async () => {
        const payout =
          await createReservedPayout(
            "APPROVE",
          );

        await createRiskEvent(
          "RSE-PAYOUT-APPROVE",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-PAYOUT-APPROVE",
                ),

              resourceType:
                "payout",

              resourceId:
                payout.payoutId,

              subjectType:
                "seller",

              subjectId:
                payout.sellerId,

              sellerId:
                payout.sellerId,

              shopId:
                payout.shopId,
            });

        payout.metadata = {
          riskDecision:
            "review",

          riskReviewId:
            review.reviewId,

          riskReviewStatus:
            "pending",
        };

        await payout.save();

        await marketplaceRiskReviewService
          .resolveReview({
            reviewId:
              review.reviewId,

            action:
              "approve",

            actorId:
              "ADMIN-62B",

            reason:
              "ตรวจสอบหลักฐานแล้วสามารถอนุมัติ payout ได้",
          });

        const latest =
          await Payout.findOne({
            payoutId:
              payout.payoutId,
          });

        await expect(
          marketplaceRiskReviewService
            .assertPayoutTransferAllowed(
              latest,
            ),
        ).resolves.toBeUndefined();
      },
    );

    it(
      "rejected Payout review fails Payout and releases reservation",
      async () => {
        const payout =
          await createReservedPayout(
            "REJECT",
          );

        await createRiskEvent(
          "RSE-PAYOUT-REJECT",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-PAYOUT-REJECT",
                ),

              resourceType:
                "payout",

              resourceId:
                payout.payoutId,

              subjectType:
                "seller",

              subjectId:
                payout.sellerId,

              sellerId:
                payout.sellerId,

              shopId:
                payout.shopId,
            });

        payout.metadata = {
          riskDecision:
            "review",

          riskReviewId:
            review.reviewId,

          riskReviewStatus:
            "pending",
        };

        await payout.save();

        await marketplaceRiskReviewService
          .resolveReview({
            reviewId:
              review.reviewId,

            action:
              "reject",

            actorId:
              "ADMIN-62B",

            reason:
              "พบความเสี่ยงผิดปกติและไม่อนุมัติ payout",
          });

        const latest =
          await Payout.findOne({
            payoutId:
              payout.payoutId,
          });

        expect(
          latest?.status,
        ).toBe(
          "failed",
        );

        expect(
          await SellerLedgerEntry
            .countDocuments({
              sourceKey:
                `payout-release:${payout.payoutId}`,
            }),
        ).toBe(
          1,
        );
      },
    );

    it(
      "pending Refund review blocks normal Refund approval",
      async () => {
        const refund =
          await createRefund(
            "REF-PENDING",
          );

        await createRiskEvent(
          "RSE-REF-PENDING",
          "buyer",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-REF-PENDING",
                ),

              resourceType:
                "refund",

              resourceId:
                refund.refundId,

              subjectType:
                "buyer",

              subjectId:
                refund.buyerId,

              buyerId:
                refund.buyerId,

              sellerId:
                refund.sellerId,

              shopId:
                refund.shopId,
            });

        refund.riskDecision =
          "review";

        refund.riskReviewId =
          review.reviewId;

        refund.riskReviewStatus =
          "pending";

        await refund.save();

        await expect(
          marketplaceRiskReviewService
            .assertRefundApprovalAllowed(
              refund,
            ),
        ).rejects.toThrow(
          /Risk Review/,
        );
      },
    );

    it(
      "approved Refund review releases approval gate",
      async () => {
        const refund =
          await createRefund(
            "REF-APPROVE",
          );

        await createRiskEvent(
          "RSE-REF-APPROVE",
          "buyer",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-REF-APPROVE",
                ),

              resourceType:
                "refund",

              resourceId:
                refund.refundId,

              subjectType:
                "buyer",

              subjectId:
                refund.buyerId,

              buyerId:
                refund.buyerId,

              sellerId:
                refund.sellerId,

              shopId:
                refund.shopId,
            });

        refund.riskDecision =
          "review";

        refund.riskReviewId =
          review.reviewId;

        refund.riskReviewStatus =
          "pending";

        await refund.save();

        await marketplaceRiskReviewService
          .resolveReview({
            reviewId:
              review.reviewId,

            action:
              "approve",

            actorId:
              "ADMIN-62B",

            reason:
              "ตรวจสอบคำขอและอนุมัติให้เข้าสู่ refund workflow",
          });

        const latest =
          await Refund.findOne({
            refundId:
              refund.refundId,
          });

        await expect(
          marketplaceRiskReviewService
            .assertRefundApprovalAllowed(
              latest,
            ),
        ).resolves.toBeUndefined();
      },
    );

    it(
      "rejected Refund review closes Refund without Provider processing",
      async () => {
        const refund =
          await createRefund(
            "REF-REJECT",
          );

        await createRiskEvent(
          "RSE-REF-REJECT",
          "buyer",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-REF-REJECT",
                ),

              resourceType:
                "refund",

              resourceId:
                refund.refundId,

              subjectType:
                "buyer",

              subjectId:
                refund.buyerId,

              buyerId:
                refund.buyerId,

              sellerId:
                refund.sellerId,

              shopId:
                refund.shopId,
            });

        await marketplaceRiskReviewService
          .resolveReview({
            reviewId:
              review.reviewId,

            action:
              "reject",

            actorId:
              "ADMIN-62B",

            reason:
              "หลักฐานไม่เพียงพอและปฏิเสธคำขอ refund นี้",
          });

        expect(
          (
            await Refund.findOne({
              refundId:
                refund.refundId,
            })
          )?.status,
        ).toBe(
          "rejected",
        );
      },
    );

    it(
      "Risk Review resolution writes immutable action once",
      async () => {
        const payout =
          await createReservedPayout(
            "AUDIT",
          );

        await createRiskEvent(
          "RSE-AUDIT",
        );

        const review =
          await marketplaceRiskReviewService
            .createReview({
              decision:
                reviewDecision(
                  "RSE-AUDIT",
                ),

              resourceType:
                "payout",

              resourceId:
                payout.payoutId,

              subjectType:
                "seller",

              subjectId:
                payout.sellerId,

              sellerId:
                payout.sellerId,

              shopId:
                payout.shopId,
            });

        const input = {
          reviewId:
            review.reviewId,

          action:
            "approve" as const,

          actorId:
            "ADMIN-AUDIT",

          reason:
            "ตรวจสอบ Risk Review นี้ครบถ้วนและอนุมัติแล้ว",
        };

        await marketplaceRiskReviewService
          .resolveReview(
            input,
          );

        const second =
          await marketplaceRiskReviewService
            .resolveReview(
              input,
            );

        expect(
          second
            .alreadyResolved,
        ).toBe(
          true,
        );

        expect(
          await RiskReviewAction
            .countDocuments({
              reviewId:
                review.reviewId,
            }),
        ).toBe(
          1,
        );
      },
    );

    it(
      "Pre-Live audit is NOT_READY while Risk Review remains pending",
      async () => {
        await createRiskEvent(
          "RSE-PRELIVE",
        );

        await marketplaceRiskReviewService
          .createReview({
            decision:
              reviewDecision(
                "RSE-PRELIVE",
              ),

            resourceType:
              "payout",

            resourceId:
              "PO-PRELIVE",

            subjectType:
              "seller",

            subjectId:
              "SELLER-PRELIVE",

            sellerId:
              "SELLER-PRELIVE",

            shopId:
              "SHOP-PRELIVE",
          });

        const audit =
          await runPreLiveFinancialAudit({
            getHealthReport:
              async () => ({
                negativeSellerBalanceCount:
                  0,

                openPayoutCount:
                  0,

                conservativeTotalCoverageGapSatang:
                  100000,

                transferableAfterReservedDemandSatang:
                  100000,
              }),
          });

        expect(
          audit
            .pendingRiskReviewCount,
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
      "Financial Health reports pending review breakdown without changing liabilities",
      async () => {
        await createRiskEvent(
          "RSE-HEALTH-PAYOUT",
        );

        await marketplaceRiskReviewService
          .createReview({
            decision:
              reviewDecision(
                "RSE-HEALTH-PAYOUT",
              ),

            resourceType:
              "payout",

            resourceId:
              "PO-HEALTH",

            subjectType:
              "seller",

            subjectId:
              "SELLER-HEALTH",

            sellerId:
              "SELLER-HEALTH",

            shopId:
              "SHOP-HEALTH",
          });

        await createRiskEvent(
          "RSE-HEALTH-REFUND",
          "buyer",
        );

        await marketplaceRiskReviewService
          .createReview({
            decision:
              reviewDecision(
                "RSE-HEALTH-REFUND",
              ),

            resourceType:
              "refund",

            resourceId:
              "REF-HEALTH",

            subjectType:
              "buyer",

            subjectId:
              "BUYER-HEALTH",

            buyerId:
              "BUYER-HEALTH",

            sellerId:
              "SELLER-HEALTH",

            shopId:
              "SHOP-HEALTH",
          });

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
            .pendingRiskReviewCount,
        ).toBe(
          2,
        );

        expect(
          health
            .pendingPayoutRiskReviewCount,
        ).toBe(
          1,
        );

        expect(
          health
            .pendingRefundRiskReviewCount,
        ).toBe(
          1,
        );
      },
    );
  },
);
