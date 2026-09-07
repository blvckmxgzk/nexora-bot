import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import Fastify from "fastify";

import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  WorkerHeartbeat,
} from "../src/models/WorkerHeartbeat.ts";

import {
  MarketplaceOpsAlert,
} from "../src/models/MarketplaceOpsAlert.ts";

import {
  WebhookEvent,
} from "../src/models/WebhookEvent.ts";

import {
  Payment,
} from "../src/models/Payment.ts";

import {
  Refund,
} from "../src/models/Refund.ts";

import {
  Payout,
} from "../src/models/Payout.ts";

import {
  Dispute,
} from "../src/models/Dispute.ts";

import {
  RiskReview,
} from "../src/models/RiskReview.ts";

import {
  workerHealthService,
  MARKETPLACE_WORKERS,
  type MarketplaceWorkerName,
} from "../src/services/marketplace/workerHealthService.ts";

import {
  marketplaceOpsHealthService,
} from "../src/services/marketplace/marketplaceOpsHealthService.ts";

import {
  healthRoute,
} from "../src/api/routes/health.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

const OLD =
  new Date(
    Date.now() -
    60 *
      60 *
      1000,
  );

async function seedHealthyWorkers() {
  for (
    const workerName
    of Object.keys(
      MARKETPLACE_WORKERS,
    ) as
      MarketplaceWorkerName[]
  ) {
    const config =
      MARKETPLACE_WORKERS[
        workerName
      ];

    await workerHealthService
      .markStarted(
        workerName,
        config.intervalMs,
      );

    await workerHealthService
      .markCycleSuccess(
        workerName,
        10,
        {
          test:
            true,
        },
      );
  }
}

async function makeWebhook(
  eventId:
    string,

  status:
    "processing" |
    "processed" |
    "failed",
) {
  return WebhookEvent.create({
    eventId,

    provider:
      "omise",

    eventKey:
      "transfer.update",

    resourceType:
      "payout",

    resourceId:
      `trsf_${eventId}`,

    status,

    receivedAt:
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
          "nexora-phase63",
      },
    );

    await Promise.all([
      WorkerHeartbeat
        .syncIndexes(),

      MarketplaceOpsAlert
        .syncIndexes(),

      WebhookEvent
        .syncIndexes(),

      Payment
        .syncIndexes(),

      Refund
        .syncIndexes(),

      Payout
        .syncIndexes(),

      Dispute
        .syncIndexes(),

      RiskReview
        .syncIndexes(),
    ]);
  },
  120_000,
);

afterEach(
  async () => {
    vi.restoreAllMocks();

    await Promise.all([
      WorkerHeartbeat
        .deleteMany({}),

      MarketplaceOpsAlert
        .deleteMany({}),

      WebhookEvent
        .deleteMany({}),

      Payment
        .deleteMany({}),

      Refund
        .deleteMany({}),

      Payout
        .deleteMany({}),

      Dispute
        .deleteMany({}),

      RiskReview
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
  "NEXORA Marketplace Phase 6.3A Operations",
  () => {
    it(
      "missing Worker heartbeat is unhealthy",
      async () => {
        const result =
          await workerHealthService
            .getSnapshot();

        expect(
          result.healthy,
        ).toBe(
          false,
        );

        expect(
          result.workers,
        ).toHaveLength(
          4,
        );

        expect(
          result.workers.every(
            (
              worker,
            ) =>
              worker.reason ===
              "heartbeat_missing",
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "healthy Workers make readiness READY",
      async () => {
        await seedHealthyWorkers();

        const workers =
          await workerHealthService
            .getSnapshot();

        expect(
          workers.healthy,
        ).toBe(
          true,
        );

        const readiness =
          await marketplaceOpsHealthService
            .getReadiness();

        expect(
          readiness.ready,
        ).toBe(
          true,
        );

        expect(
          readiness.database,
        ).toBe(
          "connected",
        );
      },
    );

    it(
      "three consecutive Worker failures become unhealthy",
      async () => {
        await seedHealthyWorkers();

        for (
          let i = 0;
          i < 3;
          i++
        ) {
          await workerHealthService
            .markCycleFailure(
              "payment_expiration",
              5,
              new Error(
                `failure-${i}`,
              ),
            );
        }

        const result =
          await workerHealthService
            .getSnapshot();

        const paymentWorker =
          result.workers.find(
            (
              worker,
            ) =>
              worker.workerName ===
              "payment_expiration",
          );

        expect(
          paymentWorker?.healthy,
        ).toBe(
          false,
        );

        expect(
          paymentWorker?.reason,
        ).toBe(
          "consecutive_failures",
        );
      },
    );

    it(
      "stale Worker heartbeat becomes unhealthy",
      async () => {
        await seedHealthyWorkers();

        await WorkerHeartbeat
          .updateOne(
            {
              workerName:
                "payout_reconciliation",
            },
            {
              $set: {
                lastSuccessAt:
                  OLD,
              },
            },
            {
              timestamps:
                false,
            },
          );

        const result =
          await workerHealthService
            .getSnapshot();

        const payoutWorker =
          result.workers.find(
            (
              worker,
            ) =>
              worker.workerName ===
              "payout_reconciliation",
          );

        expect(
          payoutWorker?.healthy,
        ).toBe(
          false,
        );

        expect(
          payoutWorker?.reason,
        ).toBe(
          "heartbeat_stale",
        );
      },
    );

    it(
      "detects stale processing Webhook",
      async () => {
        await seedHealthyWorkers();

        await makeWebhook(
          "EVT-STALE",
          "processing",
        );

        await WebhookEvent
          .updateOne(
            {
              eventId:
                "EVT-STALE",
            },
            {
              $set: {
                updatedAt:
                  OLD,
              },
            },
            {
              timestamps:
                false,
            },
          );

        const result =
          await marketplaceOpsHealthService
            .getOperationalSnapshot();

        expect(
          result
            .staleWebhookProcessingCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "detects recently failed Webhook",
      async () => {
        await seedHealthyWorkers();

        await makeWebhook(
          "EVT-FAILED",
          "failed",
        );

        const result =
          await marketplaceOpsHealthService
            .getOperationalSnapshot();

        expect(
          result
            .recentFailedWebhookCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "detects stale creating and overdue pending Payments",
      async () => {
        await seedHealthyWorkers();

        await Payment.create({
          paymentId:
            "PAY-CREATING-STALE",

          orderId:
            "ORD-CREATING-STALE",

          buyerId:
            "BUYER-63",

          sellerId:
            "SELLER-63",

          shopId:
            "SHOP-63",

          provider:
            "promptpay",

          amount:
            100,

          status:
            "creating",

          expiresAt:
            new Date(
              Date.now() +
              60_000,
            ),
        });

        await Payment
          .updateOne(
            {
              paymentId:
                "PAY-CREATING-STALE",
            },
            {
              $set: {
                updatedAt:
                  OLD,
              },
            },
            {
              timestamps:
                false,
            },
          );

        await Payment.create({
          paymentId:
            "PAY-PENDING-OVERDUE",

          orderId:
            "ORD-PENDING-OVERDUE",

          buyerId:
            "BUYER-63B",

          sellerId:
            "SELLER-63",

          shopId:
            "SHOP-63",

          provider:
            "promptpay",

          amount:
            100,

          status:
            "pending",

          expiresAt:
            OLD,
        });

        const result =
          await marketplaceOpsHealthService
            .getOperationalSnapshot();

        expect(
          result
            .staleCreatingPaymentCount,
        ).toBe(
          1,
        );

        expect(
          result
            .overduePendingPaymentCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "detects stale processing Refund",
      async () => {
        await seedHealthyWorkers();

        await Refund.create({
          refundId:
            "REF-STALE",

          orderId:
            "ORD-REF-STALE",

          paymentId:
            "PAY-REF-STALE",

          shopId:
            "SHOP-63",

          buyerId:
            "BUYER-REF",

          sellerId:
            "SELLER-REF",

          provider:
            "omise",

          providerPaymentId:
            "chrg_test_ref_stale",

          amount:
            100,

          currency:
            "THB",

          reason:
            "Phase 6.3 stale refund",

          status:
            "processing",

          requestedBy:
            "BUYER-REF",
        });

        await Refund.updateOne(
          {
            refundId:
              "REF-STALE",
          },
          {
            $set: {
              updatedAt:
                OLD,
            },
          },
          {
            timestamps:
              false,
          },
        );

        const result =
          await marketplaceOpsHealthService
            .getOperationalSnapshot();

        expect(
          result
            .staleProcessingRefundCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "detects stale provider-owned Payout",
      async () => {
        await seedHealthyWorkers();

        await Payout.create({
          payoutId:
            "PO-STALE",

          sellerId:
            "SELLER-PO",

          shopId:
            "SHOP-PO",

          payoutAccountId:
            "PA-PO",

          provider:
            "omise",

          recipientId:
            "recp_test_ops",

          amountSatang:
            5000,

          currency:
            "THB",

          feePolicy:
            "seller_pays",

          status:
            "submitted",

          idempotencyKey:
            "ops-payout-stale",

          providerTransferId:
            "trsf_test_ops",

          requestedAt:
            OLD,

          submittedAt:
            OLD,

          lastReconciledAt:
            OLD,
        });

        const result =
          await marketplaceOpsHealthService
            .getOperationalSnapshot();

        expect(
          result
            .stalePayoutCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "detects stale unresolved Dispute",
      async () => {
        await seedHealthyWorkers();

        await Dispute.create({
          disputeId:
            "DSP-STALE",

          provider:
            "omise",

          providerDisputeId:
            "dspt_test_ops",

          providerChargeId:
            "chrg_test_ops",

          paymentId:
            "PAY-DSP-OPS",

          orderId:
            "ORD-DSP-OPS",

          sellerId:
            "SELLER-DSP",

          shopId:
            "SHOP-DSP",

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
            OLD,

          lastReconciledAt:
            OLD,
        });

        const result =
          await marketplaceOpsHealthService
            .getOperationalSnapshot();

        expect(
          result
            .staleDisputeCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "detects Risk Review pending longer than 24 hours",
      async () => {
        await seedHealthyWorkers();

        await RiskReview.create({
          reviewId:
            "RRV-STALE",

          sourceKey:
            "risk-review:stale",

          riskEventId:
            "RSE-STALE",

          resourceType:
            "payout",

          resourceId:
            "PO-RISK-STALE",

          subjectType:
            "seller",

          subjectId:
            "SELLER-RISK",

          sellerId:
            "SELLER-RISK",

          shopId:
            "SHOP-RISK",

          score:
            70,

          reasonCodes: [
            "ops_test",
          ],

          status:
            "pending",
        });

        await RiskReview.collection
          .updateOne(
            {
              reviewId:
                "RRV-STALE",
            },
            {
              $set: {
                createdAt:
                  new Date(
                    Date.now() -
                    25 *
                      60 *
                      60 *
                      1000,
                  ),
              },
            },
          );

        const result =
          await marketplaceOpsHealthService
            .getOperationalSnapshot();

        expect(
          result
            .staleRiskReviewCount,
        ).toBe(
          1,
        );
      },
    );

    it(
      "syncAlerts creates structured active alert",
      async () => {
        await seedHealthyWorkers();

        await makeWebhook(
          "EVT-ALERT",
          "processing",
        );

        await WebhookEvent.updateOne(
          {
            eventId:
              "EVT-ALERT",
          },
          {
            $set: {
              updatedAt:
                OLD,
            },
          },
          {
            timestamps:
              false,
          },
        );

        const result =
          await marketplaceOpsHealthService
            .syncAlerts();

        expect(
          result
            .criticalAlertCount,
        ).toBeGreaterThan(
          0,
        );

        const alert =
          await MarketplaceOpsAlert
            .findOne({
              sourceKey:
                "ops:webhook-processing-stale",
            });

        expect(
          alert?.status,
        ).toBe(
          "active",
        );

        expect(
          alert?.count,
        ).toBe(
          1,
        );
      },
    );

    it(
      "syncAlerts automatically resolves recovered condition",
      async () => {
        await seedHealthyWorkers();

        await makeWebhook(
          "EVT-RECOVER",
          "processing",
        );

        await WebhookEvent.updateOne(
          {
            eventId:
              "EVT-RECOVER",
          },
          {
            $set: {
              updatedAt:
                OLD,
            },
          },
          {
            timestamps:
              false,
          },
        );

        await marketplaceOpsHealthService
          .syncAlerts();

        await WebhookEvent.updateOne(
          {
            eventId:
              "EVT-RECOVER",
          },
          {
            $set: {
              status:
                "processed",

              processedAt:
                new Date(),
            },
          },
        );

        await marketplaceOpsHealthService
          .syncAlerts();

        const alert =
          await MarketplaceOpsAlert
            .findOne({
              sourceKey:
                "ops:webhook-processing-stale",
            });

        expect(
          alert?.status,
        ).toBe(
          "resolved",
        );

        expect(
          alert?.resolvedAt,
        ).not.toBeNull();
      },
    );

    it(
      "health route separates liveness from readiness",
      async () => {
        const app =
          Fastify();

        await app.register(
          healthRoute,
        );

        const health =
          await app.inject({
            method:
              "GET",

            url:
              "/health",
          });

        expect(
          health.statusCode,
        ).toBe(
          200,
        );

        expect(
          health.json()
            .status,
        ).toBe(
          "healthy",
        );

        vi.spyOn(
          marketplaceOpsHealthService,
          "getReadiness",
        ).mockResolvedValue({
          ready:
            false,

          status:
            "not_ready",

          database:
            "connected",

          workers:
            null,

          checkedAt:
            new Date(),
        });

        const ready =
          await app.inject({
            method:
              "GET",

            url:
              "/ready",
          });

        expect(
          ready.statusCode,
        ).toBe(
          503,
        );

        expect(
          ready.json()
            .success,
        ).toBe(
          false,
        );

        await app.close();
      },
    );
  },
);
