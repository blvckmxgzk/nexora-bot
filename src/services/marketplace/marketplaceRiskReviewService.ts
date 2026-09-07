import crypto from "node:crypto";
import mongoose, {
  type ClientSession,
} from "mongoose";

import {
  RiskReview,
} from "../../models/RiskReview.js";

import {
  RiskReviewAction,
} from "../../models/RiskReviewAction.js";

import {
  Payout,
} from "../../models/Payout.js";

import {
  Refund,
} from "../../models/Refund.js";

import {
  sellerLedgerService,
} from "../sellerLedgerService.js";

import type {
  MarketplaceRiskDecision,
} from "./marketplaceRiskService.js";

function generateReviewId():
  string {
  return (
    "RRV-" +
    crypto
      .randomBytes(8)
      .toString(
        "hex",
      )
      .toUpperCase()
  );
}

function generateActionId():
  string {
  return (
    "RRA-" +
    crypto
      .randomBytes(8)
      .toString(
        "hex",
      )
      .toUpperCase()
  );
}

function validateResolution(
  actorId:
    string,

  reason:
    string,
) {
  const actor =
    actorId.trim();

  const trimmedReason =
    reason.trim();

  if (!actor) {
    throw new Error(
      "ไม่พบ Admin ที่ดำเนินการ Risk Review",
    );
  }

  if (
    trimmedReason.length <
    10
  ) {
    throw new Error(
      "เหตุผล Risk Review ต้องอย่างน้อย 10 ตัวอักษร",
    );
  }

  return {
    actor,
    reason:
      trimmedReason,
  };
}

export const marketplaceRiskReviewService = {
  async createReview(
    data: {
      decision:
        MarketplaceRiskDecision;

      resourceType:
        "payout" |
        "refund";

      resourceId:
        string;

      subjectType:
        "buyer" |
        "seller";

      subjectId:
        string;

      buyerId?:
        string |
        null;

      sellerId?:
        string |
        null;

      shopId?:
        string |
        null;

      metadata?:
        Record<
          string,
          unknown
        >;
    },

    session?:
      ClientSession,
  ) {
    if (
      data.decision
        .decision !==
      "review"
    ) {
      throw new Error(
        "สร้าง Risk Review ได้เฉพาะ decision=review",
      );
    }

    const existing =
      await RiskReview
        .findOne({
          riskEventId:
            data.decision
              .riskEventId,
        })
        .session(
          session ??
          null,
        );

    if (existing) {
      return existing;
    }

    const review =
      new RiskReview({
        reviewId:
          generateReviewId(),

        sourceKey:
          `risk-review:${data.decision.riskEventId}`,

        riskEventId:
          data.decision
            .riskEventId,

        resourceType:
          data.resourceType,

        resourceId:
          data.resourceId,

        subjectType:
          data.subjectType,

        subjectId:
          data.subjectId,

        buyerId:
          data.buyerId ??
          null,

        sellerId:
          data.sellerId ??
          null,

        shopId:
          data.shopId ??
          null,

        score:
          data.decision
            .score,

        reasonCodes:
          data.decision
            .reasonCodes,

        status:
          "pending",

        metadata:
          data.metadata ??
          {},
      });

    await review.save({
      session,
    });

    return review;
  },

  async assertPayoutTransferAllowed(
    payout:
      any,

    session?:
      ClientSession,
  ): Promise<void> {
    if (
      payout.metadata
        ?.riskDecision !==
      "review"
    ) {
      return;
    }

    const reviewId =
      payout.metadata
        ?.riskReviewId;

    if (
      typeof reviewId !==
        "string" ||
      !reviewId
    ) {
      throw new Error(
        "Payout REVIEW ไม่มี Risk Review record",
      );
    }

    const review =
      await RiskReview
        .findOne({
          reviewId,
          resourceType:
            "payout",
          resourceId:
            payout.payoutId,
        })
        .session(
          session ??
          null,
        );

    if (!review) {
      throw new Error(
        "ไม่พบ Risk Review ของ Payout",
      );
    }

    if (
      review.status ===
      "pending"
    ) {
      throw new Error(
        "Payout อยู่ระหว่าง Risk Review",
      );
    }

    if (
      review.status ===
      "rejected"
    ) {
      throw new Error(
        "Payout ถูกปฏิเสธโดย Risk Review",
      );
    }
  },

  async assertRefundApprovalAllowed(
    refund:
      any,
  ): Promise<void> {
    if (
      refund.riskDecision !==
      "review"
    ) {
      return;
    }

    if (
      !refund.riskReviewId
    ) {
      throw new Error(
        "Refund REVIEW ไม่มี Risk Review record",
      );
    }

    const review =
      await RiskReview.findOne({
        reviewId:
          refund.riskReviewId,

        resourceType:
          "refund",

        resourceId:
          refund.refundId,
      });

    if (!review) {
      throw new Error(
        "ไม่พบ Risk Review ของ Refund",
      );
    }

    if (
      review.status ===
      "pending"
    ) {
      throw new Error(
        "Refund อยู่ระหว่าง Risk Review",
      );
    }

    if (
      review.status ===
      "rejected"
    ) {
      throw new Error(
        "Refund ถูกปฏิเสธโดย Risk Review",
      );
    }
  },

  async resolveReview(
    data: {
      reviewId:
        string;

      action:
        "approve" |
        "reject";

      actorId:
        string;

      reason:
        string;
    },
  ) {
    const validated =
      validateResolution(
        data.actorId,
        data.reason,
      );

    const session =
      await mongoose
        .startSession();

    let result:
      any =
        null;

    try {
      await session
        .withTransaction(
          async () => {
            const review =
              await RiskReview
                .findOne({
                  reviewId:
                    data.reviewId,
                })
                .session(
                  session,
                );

            if (!review) {
              throw new Error(
                "ไม่พบ Risk Review",
              );
            }

            const targetStatus =
              data.action ===
                "approve"
                ? "approved"
                : "rejected";

            if (
              review.status ===
              targetStatus
            ) {
              result = {
                review,
                alreadyResolved:
                  true,
              };

              return;
            }

            if (
              review.status !==
              "pending"
            ) {
              throw new Error(
                `Risk Review ถูก resolve เป็น ${review.status} แล้ว`,
              );
            }

            const now =
              new Date();

            if (
              review.resourceType ===
              "payout"
            ) {
              const payout =
                await Payout
                  .findOne({
                    payoutId:
                      review.resourceId,
                  })
                  .session(
                    session,
                  );

              if (!payout) {
                throw new Error(
                  "ไม่พบ Payout ของ Risk Review",
                );
              }

              if (
                payout.status !==
                  "reserved" ||
                payout
                  .providerTransferId
              ) {
                throw new Error(
                  "Payout ไม่อยู่ในสถานะที่ Risk Review สามารถ resolve ได้",
                );
              }

              payout.metadata = {
                ...(
                  payout.metadata ??
                  {}
                ),

                riskReviewStatus:
                  targetStatus,

                riskReviewResolvedAt:
                  now,

                riskReviewResolvedBy:
                  validated.actor,
              };

              payout.markModified(
                "metadata",
              );

              if (
                data.action ===
                "reject"
              ) {
                await sellerLedgerService
                  .releasePayout(
                    payout,
                    session,
                  );

                payout.status =
                  "failed";

                payout.failedAt =
                  now;

                payout.failureCode =
                  "risk_review_rejected";

                payout.failureMessage =
                  validated.reason;
              }

              await payout.save({
                session,
              });
            } else {
              const refund =
                await Refund
                  .findOne({
                    refundId:
                      review.resourceId,
                  })
                  .session(
                    session,
                  );

              if (!refund) {
                throw new Error(
                  "ไม่พบ Refund ของ Risk Review",
                );
              }

              if (
                refund.status !==
                "requested"
              ) {
                throw new Error(
                  "Refund ไม่อยู่ในสถานะที่ Risk Review สามารถ resolve ได้",
                );
              }

              refund.riskReviewStatus =
                targetStatus;

              if (
                data.action ===
                "reject"
              ) {
                refund.status =
                  "rejected";

                refund.rejectedBy =
                  validated.actor;

                refund.rejectionReason =
                  validated.reason;
              }

              await refund.save({
                session,
              });
            }

            review.status =
              targetStatus;

            review.resolvedAt =
              now;

            review.resolvedBy =
              validated.actor;

            review.resolutionReason =
              validated.reason;

            await review.save({
              session,
            });

            const action =
              new RiskReviewAction({
                actionId:
                  generateActionId(),

                sourceKey:
                  `risk-review-action:${review.reviewId}:${targetStatus}`,

                reviewId:
                  review.reviewId,

                action:
                  data.action,

                resourceType:
                  review.resourceType,

                resourceId:
                  review.resourceId,

                actorId:
                  validated.actor,

                reason:
                  validated.reason,

                metadata: {
                  riskEventId:
                    review.riskEventId,

                  score:
                    review.score,

                  reasonCodes:
                    review.reasonCodes,
                },

                occurredAt:
                  now,
              });

            await action.save({
              session,
            });

            result = {
              review,
              alreadyResolved:
                false,
            };
          },
        );
    } finally {
      await session
        .endSession();
    }

    if (!result) {
      throw new Error(
        "Risk Review resolution ไม่ได้ผลลัพธ์",
      );
    }

    return result;
  },
};
