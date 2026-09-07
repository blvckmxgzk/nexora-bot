import {
  NotificationDelivery,
} from "../../models/NotificationDelivery.js";

import {
  runPreLiveFinancialAudit,
} from "./preLiveFinancialAuditService.js";

import {
  marketplaceOpsHealthService,
} from "./marketplaceOpsHealthService.js";

const STALE_NOTIFICATION_MS =
  15 *
  60 *
  1000;

interface FinancialAuditLike {
  ready:
    boolean;

  status?:
    string;

  reasons?:
    string[];
}

interface OperationalSnapshotLike {
  staleWebhookProcessingCount:
    number;

  recentFailedWebhookCount:
    number;

  staleCreatingPaymentCount:
    number;

  overduePendingPaymentCount:
    number;

  staleProcessingRefundCount:
    number;

  stalePayoutCount:
    number;

  staleDisputeCount:
    number;

  staleRiskReviewCount:
    number;
}

export async function runFinalLaunchAudit(
  options: {
    now?:
      Date;

    runFinancialAudit?:
      () =>
        Promise<
          FinancialAuditLike
        >;

    getOperationalSnapshot?:
      (
        now:
          Date,
      ) =>
        Promise<
          OperationalSnapshotLike
        >;
  } = {},
) {
  const now =
    options.now ??
    new Date();

  const staleBefore =
    new Date(
      now.getTime() -
      STALE_NOTIFICATION_MS,
    );

  const runFinancialAudit =
    options
      .runFinancialAudit ??
    (
      async () =>
        runPreLiveFinancialAudit()
    );

  const getOperationalSnapshot =
    options
      .getOperationalSnapshot ??
    (
      async (
        checkedAt:
          Date,
      ) =>
        marketplaceOpsHealthService
          .getOperationalSnapshot(
            checkedAt,
          )
    );

  const [
    financial,
    deadLetterCount,
    staleNotificationCount,
    ops,
  ] =
    await Promise.all([
      runFinancialAudit(),

      NotificationDelivery
        .countDocuments({
          status:
            "dead_letter",
        }),

      NotificationDelivery
        .countDocuments({
          status: {
            $in: [
              "pending",
              "retrying",
              "sending",
            ],
          },

          updatedAt: {
            $lte:
              staleBefore,
          },
        }),

      getOperationalSnapshot(
        now,
      ),
    ]);

  const reasons:
    string[] =
      [];

  if (
    !financial.ready
  ) {
    const financialReasons =
      Array.isArray(
        financial.reasons,
      )
        ? financial.reasons
        : [];

    if (
      financialReasons.length >
      0
    ) {
      for (
        const reason
        of financialReasons
      ) {
        reasons.push(
          `financial: ${reason}`,
        );
      }
    } else {
      reasons.push(
        "financial pre-live audit ไม่พร้อม",
      );
    }
  }

  if (
    deadLetterCount >
    0
  ) {
    reasons.push(
      `${deadLetterCount} customer notification(s) อยู่ใน dead-letter`,
    );
  }

  if (
    staleNotificationCount >
    0
  ) {
    reasons.push(
      `${staleNotificationCount} customer notification(s) ค้างเกิน 15 นาที`,
    );
  }

  const blockers: Array<
    [
      number,
      string,
    ]
  > = [
    [
      ops
        .staleWebhookProcessingCount,
      "Webhook processing ค้าง",
    ],

    [
      ops
        .recentFailedWebhookCount,
      "มี Webhook ล้มเหลวล่าสุด",
    ],

    [
      ops
        .staleCreatingPaymentCount,
      "Payment creating ค้าง",
    ],

    [
      ops
        .overduePendingPaymentCount,
      "Payment pending เลยเวลา",
    ],

    [
      ops
        .staleProcessingRefundCount,
      "Refund processing ค้าง",
    ],

    [
      ops
        .stalePayoutCount,
      "Payout reconciliation ค้าง",
    ],

    [
      ops
        .staleDisputeCount,
      "Dispute reconciliation ค้าง",
    ],

    [
      ops
        .staleRiskReviewCount,
      "Risk Review ค้างเกิน SLA",
    ],
  ];

  for (
    const [
      count,
      label,
    ]
    of blockers
  ) {
    if (
      count >
      0
    ) {
      reasons.push(
        `${label}: ${count}`,
      );
    }
  }

  return {
    status:
      reasons.length ===
      0
        ? "READY"
        : "NOT_READY",

    ready:
      reasons.length ===
      0,

    checkedAt:
      now,

    reasons,

    financialReady:
      financial.ready,

    financialStatus:
      financial.status ??
      null,

    deadLetterCount,

    staleNotificationCount,

    staleWebhookProcessingCount:
      ops
        .staleWebhookProcessingCount,

    recentFailedWebhookCount:
      ops
        .recentFailedWebhookCount,

    staleCreatingPaymentCount:
      ops
        .staleCreatingPaymentCount,

    overduePendingPaymentCount:
      ops
        .overduePendingPaymentCount,

    staleProcessingRefundCount:
      ops
        .staleProcessingRefundCount,

    stalePayoutCount:
      ops
        .stalePayoutCount,

    staleDisputeCount:
      ops
        .staleDisputeCount,

    staleRiskReviewCount:
      ops
        .staleRiskReviewCount,
  };
}
