import crypto from "node:crypto";
import mongoose from "mongoose";

import {
  Payment,
} from "../../models/Payment.js";

import {
  Refund,
} from "../../models/Refund.js";

import {
  Payout,
} from "../../models/Payout.js";

import {
  Dispute,
} from "../../models/Dispute.js";

import {
  WebhookEvent,
} from "../../models/WebhookEvent.js";

import {
  RiskReview,
} from "../../models/RiskReview.js";

import {
  MarketplaceOpsAlert,
} from "../../models/MarketplaceOpsAlert.js";

import {
  workerHealthService,
} from "./workerHealthService.js";

const WEBHOOK_STALE_MS =
  5 *
  60 *
  1000;

const PAYMENT_CREATING_STALE_MS =
  5 *
  60 *
  1000;

const PAYMENT_EXPIRED_GRACE_MS =
  2 *
  60 *
  1000;

const REFUND_PROCESSING_STALE_MS =
  15 *
  60 *
  1000;

const PAYOUT_RECONCILIATION_STALE_MS =
  10 *
  60 *
  1000;

const DISPUTE_RECONCILIATION_STALE_MS =
  10 *
  60 *
  1000;

const RISK_REVIEW_STALE_MS =
  24 *
  60 *
  60 *
  1000;

const RECENT_WEBHOOK_FAILURE_MS =
  15 *
  60 *
  1000;

interface AlertSignal {
  sourceKey:
    string;

  code:
    string;

  severity:
    "warning" |
    "critical";

  count:
    number;

  message:
    string;

  details?:
    Record<
      string,
      unknown
    >;
}

function alertId():
  string {
  return (
    "OPS-" +
    crypto
      .randomBytes(8)
      .toString(
        "hex",
      )
      .toUpperCase()
  );
}

export const marketplaceOpsHealthService = {
  async getOperationalSnapshot(
    now =
      new Date(),
  ) {
    const webhookStaleBefore =
      new Date(
        now.getTime() -
        WEBHOOK_STALE_MS,
      );

    const paymentCreatingBefore =
      new Date(
        now.getTime() -
        PAYMENT_CREATING_STALE_MS,
      );

    const paymentExpiredBefore =
      new Date(
        now.getTime() -
        PAYMENT_EXPIRED_GRACE_MS,
      );

    const refundProcessingBefore =
      new Date(
        now.getTime() -
        REFUND_PROCESSING_STALE_MS,
      );

    const payoutStaleBefore =
      new Date(
        now.getTime() -
        PAYOUT_RECONCILIATION_STALE_MS,
      );

    const disputeStaleBefore =
      new Date(
        now.getTime() -
        DISPUTE_RECONCILIATION_STALE_MS,
      );

    const riskReviewStaleBefore =
      new Date(
        now.getTime() -
        RISK_REVIEW_STALE_MS,
      );

    const webhookFailureSince =
      new Date(
        now.getTime() -
        RECENT_WEBHOOK_FAILURE_MS,
      );

    const [
      staleWebhookProcessingCount,
      recentFailedWebhookCount,
      staleCreatingPaymentCount,
      overduePendingPaymentCount,
      staleProcessingRefundCount,
      stalePayoutCount,
      staleDisputeCount,
      staleRiskReviewCount,
      workerHealth,
    ] =
      await Promise.all([
        WebhookEvent
          .countDocuments({
            status:
              "processing",

            updatedAt: {
              $lte:
                webhookStaleBefore,
            },
          }),

        WebhookEvent
          .countDocuments({
            status:
              "failed",

            updatedAt: {
              $gte:
                webhookFailureSince,
            },
          }),

        Payment.countDocuments({
          status:
            "creating",

          updatedAt: {
            $lte:
              paymentCreatingBefore,
          },
        }),

        Payment.countDocuments({
          status:
            "pending",

          expiresAt: {
            $lte:
              paymentExpiredBefore,
          },
        }),

        Refund.countDocuments({
          status:
            "processing",

          updatedAt: {
            $lte:
              refundProcessingBefore,
          },
        }),

        Payout.countDocuments({
          status: {
            $in: [
              "creating_transfer",
              "submitted",
              "sent",
            ],
          },

          $or: [
            {
              lastReconciledAt: {
                $lte:
                  payoutStaleBefore,
              },
            },

            {
              lastReconciledAt:
                null,

              updatedAt: {
                $lte:
                  payoutStaleBefore,
              },
            },
          ],
        }),

        Dispute.countDocuments({
          $and: [
            {
              $or: [
                {
                  status: {
                    $in: [
                      "open",
                      "pending",
                    ],
                  },
                },

                {
                  status:
                    "lost",

                  riskResolvedAt:
                    null,
                },

                {
                  status:
                    "won",

                  "metadata.providerCreditConfirmed": {
                    $ne:
                      true,
                  },
                },
              ],
            },

            {
              $or: [
                {
                  lastReconciledAt: {
                    $lte:
                      disputeStaleBefore,
                  },
                },

                {
                  lastReconciledAt:
                    null,

                  updatedAt: {
                    $lte:
                      disputeStaleBefore,
                  },
                },
              ],
            },
          ],
        }),

        RiskReview.countDocuments({
          status:
            "pending",

          createdAt: {
            $lte:
              riskReviewStaleBefore,
          },
        }),

        workerHealthService
          .getSnapshot(
            now,
          ),
      ]);

    return {
      checkedAt:
        now,

      staleWebhookProcessingCount,

      recentFailedWebhookCount,

      staleCreatingPaymentCount,

      overduePendingPaymentCount,

      staleProcessingRefundCount,

      stalePayoutCount,

      staleDisputeCount,

      staleRiskReviewCount,

      workerHealth,
    };
  },

  async getReadiness(
    now =
      new Date(),
  ) {
    if (
      mongoose.connection
        .readyState !==
      1
    ) {
      return {
        ready:
          false,

        status:
          "not_ready",

        database:
          "disconnected",

        workers:
          null,

        checkedAt:
          now,
      } as const;
    }

    try {
      const workers =
        await workerHealthService
          .getSnapshot(
            now,
          );

      return {
        ready:
          workers.healthy,

        status:
          workers.healthy
            ? "ready"
            : "not_ready",

        database:
          "connected",

        workers,

        checkedAt:
          now,
      } as const;
    } catch (error) {
      return {
        ready:
          false,

        status:
          "not_ready",

        database:
          "error",

        workers:
          null,

        checkedAt:
          now,

        error:
          error instanceof Error
            ? error.message
            : "Readiness check failed",
      } as const;
    }
  },

  async syncAlerts(
    now =
      new Date(),
  ) {
    const snapshot =
      await this
        .getOperationalSnapshot(
          now,
        );

    const signals:
      AlertSignal[] =
        [];

    const push =
      (
        signal:
          AlertSignal,
      ) => {
        if (
          signal.count >
          0
        ) {
          signals.push(
            signal,
          );
        }
      };

    push({
      sourceKey:
        "ops:webhook-processing-stale",

      code:
        "webhook_processing_stale",

      severity:
        "critical",

      count:
        snapshot
          .staleWebhookProcessingCount,

      message:
        "WebhookEvent ค้างอยู่ใน processing เกิน stale threshold",
    });

    push({
      sourceKey:
        "ops:webhook-failed-recent",

      code:
        "webhook_failed_recent",

      severity:
        "warning",

      count:
        snapshot
          .recentFailedWebhookCount,

      message:
        "มี WebhookEvent ล้มเหลวในช่วง 15 นาทีล่าสุด",
    });

    push({
      sourceKey:
        "ops:payment-creating-stale",

      code:
        "payment_creating_stale",

      severity:
        "critical",

      count:
        snapshot
          .staleCreatingPaymentCount,

      message:
        "Payment ค้างใน creating เกิน threshold",
    });

    push({
      sourceKey:
        "ops:payment-pending-overdue",

      code:
        "payment_pending_overdue",

      severity:
        "warning",

      count:
        snapshot
          .overduePendingPaymentCount,

      message:
        "Payment pending เลย expiresAt และ grace period แล้ว",
    });

    push({
      sourceKey:
        "ops:refund-processing-stale",

      code:
        "refund_processing_stale",

      severity:
        "critical",

      count:
        snapshot
          .staleProcessingRefundCount,

      message:
        "Refund ค้างใน processing และต้องตรวจ provider state",
    });

    push({
      sourceKey:
        "ops:payout-reconciliation-stale",

      code:
        "payout_reconciliation_stale",

      severity:
        "critical",

      count:
        snapshot
          .stalePayoutCount,

      message:
        "Payout provider-owned state ไม่ได้รับ reconciliation ตามเวลา",
    });

    push({
      sourceKey:
        "ops:dispute-reconciliation-stale",

      code:
        "dispute_reconciliation_stale",

      severity:
        "critical",

      count:
        snapshot
          .staleDisputeCount,

      message:
        "Unresolved Dispute ไม่ได้รับ canonical reconciliation ตามเวลา",
    });

    push({
      sourceKey:
        "ops:risk-review-stale",

      code:
        "risk_review_stale",

      severity:
        "warning",

      count:
        snapshot
          .staleRiskReviewCount,

      message:
        "Marketplace Risk Review pending เกิน 24 ชั่วโมง",
    });

    for (
      const worker
      of snapshot
        .workerHealth
        .workers
    ) {
      if (
        !worker.healthy
      ) {
        signals.push({
          sourceKey:
            `ops:worker:${worker.workerName}`,

          code:
            "worker_unhealthy",

          severity:
            "critical",

          count:
            1,

          message:
            `Worker ${worker.workerName} ไม่ healthy`,

          details: {
            workerName:
              worker.workerName,

            reason:
              worker.reason,

            lastSuccessAt:
              worker.lastSuccessAt,

            consecutiveFailures:
              worker
                .consecutiveFailures,
          },
        });
      }
    }

    const activeKeys =
      signals.map(
        (
          signal,
        ) =>
          signal.sourceKey,
      );

    for (
      const signal
      of signals
    ) {
      await MarketplaceOpsAlert
        .findOneAndUpdate(
          {
            sourceKey:
              signal.sourceKey,
          },
          {
            $set: {
              code:
                signal.code,

              severity:
                signal.severity,

              status:
                "active",

              count:
                signal.count,

              message:
                signal.message,

              details:
                signal.details ??
                {},

              lastDetectedAt:
                now,

              resolvedAt:
                null,
            },

            $setOnInsert: {
              alertId:
                alertId(),

              sourceKey:
                signal.sourceKey,

              firstDetectedAt:
                now,
            },
          },
          {
            upsert:
              true,

            new:
              true,
          },
        );
    }

    /*
     * แต่ละ subsystem ต้อง resolve เฉพาะ Alert
     * ที่ตัวเองเป็นเจ้าของเท่านั้น
     *
     * Notification dead-letter alerts ถูกสร้างและ
     * resolve โดย notificationDeliveryService
     * จึงห้าม Ops health sweep ไปแตะ
     */
    const managedSourceKeys = [
      "ops:webhook-processing-stale",
      "ops:webhook-failed-recent",
      "ops:payment-creating-stale",
      "ops:payment-pending-overdue",
      "ops:refund-processing-stale",
      "ops:payout-reconciliation-stale",
      "ops:dispute-reconciliation-stale",
      "ops:risk-review-stale",

      ...snapshot
        .workerHealth
        .workers
        .map(
          (
            worker,
          ) =>
            `ops:worker:${worker.workerName}`,
        ),
    ];

    await MarketplaceOpsAlert
      .updateMany(
        {
          status:
            "active",

          sourceKey: {
            $in:
              managedSourceKeys,

            $nin:
              activeKeys,
          },
        },
        {
          $set: {
            status:
              "resolved",

            resolvedAt:
              now,
          },
        },
      );

    return {
      snapshot,

      activeAlertCount:
        signals.length,

      criticalAlertCount:
        signals.filter(
          (
            signal,
          ) =>
            signal.severity ===
            "critical",
        ).length,

      warningAlertCount:
        signals.filter(
          (
            signal,
          ) =>
            signal.severity ===
            "warning",
        ).length,
    };
  },
};
