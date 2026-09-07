import crypto from "node:crypto";

import {
  RiskEvent,
} from "../../models/RiskEvent.js";

import {
  RiskVelocityBucket,
} from "../../models/RiskVelocityBucket.js";

import {
  User,
} from "../../models/User.js";

import {
  Payment,
} from "../../models/Payment.js";

import {
  Payout,
} from "../../models/Payout.js";

import {
  Refund,
} from "../../models/Refund.js";

import {
  Dispute,
} from "../../models/Dispute.js";

export type MarketplaceRiskDecisionType =
  | "allow"
  | "review"
  | "block";

export interface MarketplaceRiskDecision {
  riskEventId:
    string;

  decision:
    MarketplaceRiskDecisionType;

  score:
    number;

  reasonCodes:
    string[];

  metrics:
    Record<
      string,
      unknown
    >;
}

export const MARKETPLACE_RISK_POLICY = {
  orderVelocity: {
    windowMs:
      5 *
      60 *
      1000,

    reviewAt:
      6,

    blockAt:
      10,
  },

  paymentVelocity: {
    windowMs:
      10 *
      60 *
      1000,

    reviewAt:
      5,

    blockAt:
      8,
  },

  failedPayments: {
    windowMs:
      30 *
      60 *
      1000,

    reviewAt:
      3,

    blockAt:
      5,
  },

  payoutVelocity: {
    windowMs:
      30 *
      60 *
      1000,

    reviewAt:
      2,

    blockAt:
      4,
  },

  refundVelocity: {
    windowMs:
      24 *
      60 *
      60 *
      1000,

    reviewAt:
      3,

    blockAt:
      5,
  },

  refundHistoryWindowMs:
    30 *
    24 *
    60 *
    60 *
    1000,

  payoutCooldownMs:
    10 *
    60 *
    1000,

  recentDisputeWindowMs:
    30 *
    24 *
    60 *
    60 *
    1000,

  newPlatformUserMs:
    24 *
    60 *
    60 *
    1000,
} as const;

export class MarketplaceRiskBlockedError
  extends Error {
  readonly riskEventId:
    string;

  readonly reasonCodes:
    string[];

  constructor(
    decision:
      MarketplaceRiskDecision,
  ) {
    super(
      `Marketplace Risk blocked this action (${decision.reasonCodes.join(
        ", ",
      )})`,
    );

    this.name =
      "MarketplaceRiskBlockedError";

    this.riskEventId =
      decision.riskEventId;

    this.reasonCodes =
      decision.reasonCodes;
  }
}

function generateRiskEventId():
  string {
  return (
    "RSE-" +
    crypto
      .randomBytes(8)
      .toString(
        "hex",
      )
      .toUpperCase()
  );
}

function clampScore(
  value:
    number,
): number {
  return Math.max(
    0,
    Math.min(
      100,
      Math.trunc(
        value,
      ),
    ),
  );
}

function duplicateKey(
  error:
    unknown,
): boolean {
  return (
    typeof error ===
      "object" &&
    error !==
      null &&
    "code" in error &&
    (
      error as {
        code?:
          unknown;
      }
    ).code ===
      11000
  );
}

async function consumeVelocity(
  data: {
    subjectType:
      "buyer" |
      "seller";

    subjectId:
      string;

    action:
      "order_create" |
      "payment_create" |
      "payout_request" |
      "refund_request";

    windowMs:
      number;

    now:
      Date;
  },
): Promise<number> {
  const nowMs =
    data.now.getTime();

  const windowStartMs =
    Math.floor(
      nowMs /
      data.windowMs,
    ) *
    data.windowMs;

  const windowStartedAt =
    new Date(
      windowStartMs,
    );

  const bucketKey =
    [
      data.subjectType,
      data.subjectId,
      data.action,
      String(
        windowStartMs,
      ),
    ].join(
      ":",
    );

  /*
   * Bucket เก็บไว้นานกว่า window เล็กน้อย
   * เพื่อ debugging แต่ TTL จะ cleanup เอง
   */
  const expiresAt =
    new Date(
      windowStartMs +
      Math.max(
        data.windowMs * 4,
        60 *
          60 *
          1000,
      ),
    );

  let bucket:
    any =
      null;

  try {
    bucket =
      await RiskVelocityBucket
        .findOneAndUpdate(
          {
            bucketKey,
          },
          {
            $setOnInsert: {
              bucketKey,

              subjectType:
                data.subjectType,

              subjectId:
                data.subjectId,

              action:
                data.action,

              windowStartedAt,

              windowMs:
                data.windowMs,

              expiresAt,
            },

            $inc: {
              count:
                1,
            },
          },
          {
            upsert:
              true,

            new:
              true,
          },
        );
  } catch (error) {
    /*
     * Concurrent first-upsert:
     * unique bucketKey อาจชนกันได้
     * ให้ retry แบบ non-upsert
     */
    if (
      !duplicateKey(
        error,
      )
    ) {
      throw error;
    }

    bucket =
      await RiskVelocityBucket
        .findOneAndUpdate(
          {
            bucketKey,
          },
          {
            $inc: {
              count:
                1,
            },
          },
          {
            new:
              true,
          },
        );
  }

  if (
    !bucket ||
    !Number.isSafeInteger(
      bucket.count,
    ) ||
    bucket.count <
      1
  ) {
    throw new Error(
      "Risk velocity bucket ไม่ถูกต้อง",
    );
  }

  return bucket.count;
}

async function getPlatformAgeSignal(
  discordId:
    string,

  now:
    Date,
) {
  const user =
    await User
      .findOne({
        discordId,
      })
      .lean();

  if (!user) {
    return {
      isNew:
        false,

      platformAgeMs:
        null,
    };
  }

  const firstSeen =
    user.firstSeenAt;

  if (
    !(firstSeen instanceof
      Date) ||
    !Number.isFinite(
      firstSeen.getTime(),
    )
  ) {
    return {
      isNew:
        false,

      platformAgeMs:
        null,
    };
  }

  const age =
    Math.max(
      0,
      now.getTime() -
        firstSeen.getTime(),
    );

  return {
    isNew:
      age <
      MARKETPLACE_RISK_POLICY
        .newPlatformUserMs,

    platformAgeMs:
      age,
  };
}

async function saveRiskEvent(
  data: {
    subjectType:
      "buyer" |
      "seller";

    subjectId:
      string;

    action:
      "order_create" |
      "payment_create" |
      "payout_request" |
      "refund_request";

    decision:
      MarketplaceRiskDecisionType;

    score:
      number;

    reasonCodes:
      string[];

    metrics:
      Record<
        string,
        unknown
      >;

    buyerId?:
      string |
      null;

    sellerId?:
      string |
      null;

    shopId?:
      string |
      null;

    productId?:
      string |
      null;

    orderId?:
      string |
      null;

    paymentId?:
      string |
      null;

    payoutId?:
      string |
      null;

    refundId?:
      string |
      null;

    now:
      Date;
  },
): Promise<
  MarketplaceRiskDecision
> {
  const riskEventId =
    generateRiskEventId();

  await RiskEvent.create({
    riskEventId,

    subjectType:
      data.subjectType,

    subjectId:
      data.subjectId,

    action:
      data.action,

    decision:
      data.decision,

    score:
      clampScore(
        data.score,
      ),

    reasonCodes:
      data.reasonCodes,

    buyerId:
      data.buyerId ??
      null,

    sellerId:
      data.sellerId ??
      null,

    shopId:
      data.shopId ??
      null,

    productId:
      data.productId ??
      null,

    orderId:
      data.orderId ??
      null,

    paymentId:
      data.paymentId ??
      null,

    payoutId:
      data.payoutId ??
      null,

    refundId:
      data.refundId ??
      null,

    metrics:
      data.metrics,

    policyVersion:
      "marketplace_risk_v1",

    occurredAt:
      data.now,
  });

  return {
    riskEventId,

    decision:
      data.decision,

    score:
      clampScore(
        data.score,
      ),

    reasonCodes:
      data.reasonCodes,

    metrics:
      data.metrics,
  };
}

export const marketplaceRiskService = {
  assertNotBlocked(
    decision:
      MarketplaceRiskDecision,
  ): void {
    /*
     * Phase 6.2A:
     * REVIEW = soft signal
     *
     * 6.2B จะเพิ่ม manual-review hold
     * สำหรับ high-risk financial actions
     */
    if (
      decision.decision ===
      "block"
    ) {
      throw new MarketplaceRiskBlockedError(
        decision,
      );
    }
  },

  async evaluateOrderCreation(
    data: {
      orderId:
        string;

      buyerId:
        string;

      sellerId:
        string;

      shopId:
        string;

      productId:
        string;

      quantity:
        number;

      requestedUnitPrice:
        number;

      now?:
        Date;
    },
  ) {
    const now =
      data.now ??
      new Date();

    const attemptCount =
      await consumeVelocity({
        subjectType:
          "buyer",

        subjectId:
          data.buyerId,

        action:
          "order_create",

        windowMs:
          MARKETPLACE_RISK_POLICY
            .orderVelocity
            .windowMs,

        now,
      });

    const ageSignal =
      await getPlatformAgeSignal(
        data.buyerId,
        now,
      );

    const reasons:
      string[] =
        [];

    let score =
      0;

    let hardBlock =
      false;

    if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .orderVelocity
        .blockAt
    ) {
      reasons.push(
        "buyer_order_velocity_block",
      );

      score =
        100;

      hardBlock =
        true;
    } else if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .orderVelocity
        .reviewAt
    ) {
      reasons.push(
        "buyer_order_velocity_review",
      );

      score +=
        60;
    }

    if (
      ageSignal.isNew
    ) {
      reasons.push(
        "new_nexora_buyer",
      );

      score +=
        10;
    }

    const decision:
      MarketplaceRiskDecisionType =
        hardBlock
          ? "block"
          : score >=
              50
            ? "review"
            : "allow";

    return saveRiskEvent({
      subjectType:
        "buyer",

      subjectId:
        data.buyerId,

      action:
        "order_create",

      decision,

      score,

      reasonCodes:
        reasons,

      buyerId:
        data.buyerId,

      sellerId:
        data.sellerId,

      shopId:
        data.shopId,

      productId:
        data.productId,

      orderId:
        data.orderId,

      metrics: {
        attemptCount,

        windowMs:
          MARKETPLACE_RISK_POLICY
            .orderVelocity
            .windowMs,

        platformAgeMs:
          ageSignal
            .platformAgeMs,

        quantity:
          data.quantity,

        requestedUnitPrice:
          data.requestedUnitPrice,
      },

      now,
    });
  },

  async evaluatePaymentCreation(
    data: {
      orderId:
        string;

      buyerId:
        string;

      sellerId:
        string;

      shopId:
        string;

      provider:
        "promptpay" |
        "truemoney";

      amountBaht:
        number;

      now?:
        Date;
    },
  ) {
    const now =
      data.now ??
      new Date();

    const attemptCount =
      await consumeVelocity({
        subjectType:
          "buyer",

        subjectId:
          data.buyerId,

        action:
          "payment_create",

        windowMs:
          MARKETPLACE_RISK_POLICY
            .paymentVelocity
            .windowMs,

        now,
      });

    const failedSince =
      new Date(
        now.getTime() -
        MARKETPLACE_RISK_POLICY
          .failedPayments
          .windowMs,
      );

    const [
      failedPaymentCount,
      ageSignal,
    ] =
      await Promise.all([
        Payment.countDocuments({
          buyerId:
            data.buyerId,

          status:
            "failed",

          updatedAt: {
            $gte:
              failedSince,
          },
        }),

        getPlatformAgeSignal(
          data.buyerId,
          now,
        ),
      ]);

    const reasons:
      string[] =
        [];

    let score =
      0;

    let hardBlock =
      false;

    if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .paymentVelocity
        .blockAt
    ) {
      reasons.push(
        "buyer_payment_velocity_block",
      );

      hardBlock =
        true;

      score =
        100;
    } else if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .paymentVelocity
        .reviewAt
    ) {
      reasons.push(
        "buyer_payment_velocity_review",
      );

      score +=
        50;
    }

    if (
      failedPaymentCount >=
      MARKETPLACE_RISK_POLICY
        .failedPayments
        .blockAt
    ) {
      reasons.push(
        "repeated_failed_payments_block",
      );

      hardBlock =
        true;

      score =
        100;
    } else if (
      failedPaymentCount >=
      MARKETPLACE_RISK_POLICY
        .failedPayments
        .reviewAt
    ) {
      reasons.push(
        "repeated_failed_payments_review",
      );

      score +=
        50;
    }

    if (
      ageSignal.isNew
    ) {
      reasons.push(
        "new_nexora_buyer",
      );

      score +=
        10;
    }

    const decision:
      MarketplaceRiskDecisionType =
        hardBlock
          ? "block"
          : score >=
              50
            ? "review"
            : "allow";

    return saveRiskEvent({
      subjectType:
        "buyer",

      subjectId:
        data.buyerId,

      action:
        "payment_create",

      decision,

      score,

      reasonCodes:
        reasons,

      buyerId:
        data.buyerId,

      sellerId:
        data.sellerId,

      shopId:
        data.shopId,

      orderId:
        data.orderId,

      metrics: {
        attemptCount,

        failedPaymentCount,

        paymentVelocityWindowMs:
          MARKETPLACE_RISK_POLICY
            .paymentVelocity
            .windowMs,

        failedPaymentWindowMs:
          MARKETPLACE_RISK_POLICY
            .failedPayments
            .windowMs,

        platformAgeMs:
          ageSignal
            .platformAgeMs,

        provider:
          data.provider,

        amountBaht:
          data.amountBaht,
      },

      now,
    });
  },

  async evaluateRefundRequest(
    data: {
      refundId:
        string;

      orderId:
        string;

      buyerId:
        string;

      sellerId:
        string;

      shopId:
        string;

      amountBaht:
        number;

      now?:
        Date;
    },
  ) {
    const now =
      data.now ??
      new Date();

    const attemptCount =
      await consumeVelocity({
        subjectType:
          "buyer",

        subjectId:
          data.buyerId,

        action:
          "refund_request",

        windowMs:
          MARKETPLACE_RISK_POLICY
            .refundVelocity
            .windowMs,

        now,
      });

    const historySince =
      new Date(
        now.getTime() -
        MARKETPLACE_RISK_POLICY
          .refundHistoryWindowMs,
      );

    const [
      recentBuyerRefundCount,
      sellerPaymentCount,
      sellerRefundCount,
      sellerAdverseDisputeCount,
    ] =
      await Promise.all([
        Refund.countDocuments({
          buyerId:
            data.buyerId,

          requestedAt: {
            $gte:
              historySince,
          },

          status: {
            $nin: [
              "rejected",
              "cancelled",
            ],
          },
        }),

        Payment.countDocuments({
          sellerId:
            data.sellerId,

          createdAt: {
            $gte:
              historySince,
          },

          status: {
            $in: [
              "paid",
              "refunded",
            ],
          },
        }),

        Refund.countDocuments({
          sellerId:
            data.sellerId,

          requestedAt: {
            $gte:
              historySince,
          },

          status: {
            $nin: [
              "rejected",
              "cancelled",
            ],
          },
        }),

        Dispute.countDocuments({
          sellerId:
            data.sellerId,

          openedAt: {
            $gte:
              historySince,
          },

          status: {
            $in: [
              "open",
              "pending",
              "lost",
            ],
          },
        }),
      ]);

    const sellerRefundRatio =
      sellerPaymentCount >
        0
        ? sellerRefundCount /
          sellerPaymentCount
        : 0;

    const reasons:
      string[] =
        [];

    let score =
      0;

    let hardBlock =
      false;

    if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .refundVelocity
        .blockAt
    ) {
      reasons.push(
        "buyer_refund_velocity_block",
      );

      hardBlock =
        true;

      score =
        100;
    } else if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .refundVelocity
        .reviewAt
    ) {
      reasons.push(
        "buyer_refund_velocity_review",
      );

      score +=
        60;
    }

    if (
      recentBuyerRefundCount >=
      2
    ) {
      reasons.push(
        "buyer_recent_refund_history",
      );

      score +=
        20;
    }

    if (
      sellerPaymentCount >=
      5 &&
      sellerRefundRatio >=
      0.5
    ) {
      reasons.push(
        "seller_high_refund_ratio",
      );

      score +=
        40;
    } else if (
      sellerPaymentCount >=
        5 &&
      sellerRefundRatio >=
        0.3
    ) {
      reasons.push(
        "seller_elevated_refund_ratio",
      );

      score +=
        30;
    }

    if (
      sellerAdverseDisputeCount >=
      2
    ) {
      reasons.push(
        "seller_multiple_adverse_disputes",
      );

      score +=
        40;
    } else if (
      sellerAdverseDisputeCount ===
      1
    ) {
      reasons.push(
        "seller_recent_adverse_dispute",
      );

      score +=
        20;
    }

    const decision:
      MarketplaceRiskDecisionType =
        hardBlock
          ? "block"
          : score >=
              50
            ? "review"
            : "allow";

    return saveRiskEvent({
      subjectType:
        "buyer",

      subjectId:
        data.buyerId,

      action:
        "refund_request",

      decision,

      score,

      reasonCodes:
        reasons,

      buyerId:
        data.buyerId,

      sellerId:
        data.sellerId,

      shopId:
        data.shopId,

      orderId:
        data.orderId,

      refundId:
        data.refundId,

      metrics: {
        attemptCount,

        recentBuyerRefundCount,

        sellerPaymentCount,

        sellerRefundCount,

        sellerRefundRatio,

        sellerAdverseDisputeCount,

        amountBaht:
          data.amountBaht,

        refundVelocityWindowMs:
          MARKETPLACE_RISK_POLICY
            .refundVelocity
            .windowMs,

        historyWindowMs:
          MARKETPLACE_RISK_POLICY
            .refundHistoryWindowMs,
      },

      now,
    });
  },

  async evaluatePayoutRequest(
    data: {
      sellerId:
        string;

      shopId:
        string;

      amountSatang:
        number;

      now?:
        Date;
    },
  ) {
    const now =
      data.now ??
      new Date();

    const attemptCount =
      await consumeVelocity({
        subjectType:
          "seller",

        subjectId:
          data.sellerId,

        action:
          "payout_request",

        windowMs:
          MARKETPLACE_RISK_POLICY
            .payoutVelocity
            .windowMs,

        now,
      });

    const payoutCooldownSince =
      new Date(
        now.getTime() -
        MARKETPLACE_RISK_POLICY
          .payoutCooldownMs,
      );

    const disputeSince =
      new Date(
        now.getTime() -
        MARKETPLACE_RISK_POLICY
          .recentDisputeWindowMs,
      );

    const [
      recentPaidPayout,
      recentDisputeCount,
    ] =
      await Promise.all([
        Payout.findOne({
          sellerId:
            data.sellerId,

          status:
            "paid",

          paidAt: {
            $gte:
              payoutCooldownSince,
          },
        })
          .sort({
            paidAt:
              -1,
          })
          .lean(),

        Dispute.countDocuments({
          sellerId:
            data.sellerId,

          openedAt: {
            $gte:
              disputeSince,
          },
        }),
      ]);

    const reasons:
      string[] =
        [];

    let score =
      0;

    let hardBlock =
      false;

    if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .payoutVelocity
        .blockAt
    ) {
      reasons.push(
        "seller_payout_velocity_block",
      );

      hardBlock =
        true;

      score =
        100;
    } else if (
      attemptCount >=
      MARKETPLACE_RISK_POLICY
        .payoutVelocity
        .reviewAt
    ) {
      reasons.push(
        "seller_payout_velocity_review",
      );

      score +=
        50;
    }

    if (
      recentPaidPayout
    ) {
      reasons.push(
        "seller_payout_cooldown",
      );

      hardBlock =
        true;

      score =
        100;
    }

    if (
      recentDisputeCount >
      0
    ) {
      reasons.push(
        "seller_recent_dispute",
      );

      score +=
        40;
    }

    const decision:
      MarketplaceRiskDecisionType =
        hardBlock
          ? "block"
          : score >=
              50
            ? "review"
            : "allow";

    return saveRiskEvent({
      subjectType:
        "seller",

      subjectId:
        data.sellerId,

      action:
        "payout_request",

      decision,

      score,

      reasonCodes:
        reasons,

      sellerId:
        data.sellerId,

      shopId:
        data.shopId,

      metrics: {
        attemptCount,

        amountSatang:
          data.amountSatang,

        payoutVelocityWindowMs:
          MARKETPLACE_RISK_POLICY
            .payoutVelocity
            .windowMs,

        payoutCooldownMs:
          MARKETPLACE_RISK_POLICY
            .payoutCooldownMs,

        recentPaidPayoutId:
          recentPaidPayout
            ?.payoutId ??
          null,

        recentDisputeCount,
      },

      now,
    });
  },
};
