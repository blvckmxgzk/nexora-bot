import crypto from "node:crypto";

import mongoose from "mongoose";

import {
  Dispute,
} from "../models/Dispute.js";

import {
  Payment,
} from "../models/Payment.js";

import {
  Order,
} from "../models/Order.js";

import {
  SellerLedgerEntry,
} from "../models/SellerLedgerEntry.js";

import {
  FinancialRiskAction,
} from "../models/FinancialRiskAction.js";

import {
  sellerLedgerService,
} from "./sellerLedgerService.js";

import {
  sellerFinancialRiskService,
} from "./marketplace/sellerFinancialRiskService.js";

import {
  omiseDisputeProvider,
  type ProviderDisputeSnapshot,
} from "./payment/providers/omiseDisputeProvider.js";

function generateRiskActionId():
  string {
  return (
    "RISK-" +
    crypto
      .randomBytes(8)
      .toString(
        "hex",
      )
      .toUpperCase()
  );
}

function generateDisputeId():
  string {
  return (
    "DSP-" +
    crypto
      .randomBytes(8)
      .toString(
        "hex",
      )
      .toUpperCase()
  );
}

function sellerLiability(
  gross:
    number,

  sellerNet:
    number,

  disputed:
    number,
): number {
  for (
    const [
      name,
      value,
    ]
    of [
      [
        "gross",
        gross,
      ],
      [
        "sellerNet",
        sellerNet,
      ],
      [
        "disputed",
        disputed,
      ],
    ] as const
  ) {
    if (
      !Number.isSafeInteger(
        value,
      ) ||
      value <
        0
    ) {
      throw new Error(
        `${name} ไม่ใช่ safe integer`,
      );
    }
  }

  if (
    gross <=
      0 ||
    disputed >
      gross
  ) {
    throw new Error(
      "Dispute amount มากกว่า Payment gross หรือ gross ไม่ถูกต้อง",
    );
  }

  /*
   * ใช้ BigInt เพื่อไม่ overflow
   *
   * round(
   *   sellerNet *
   *   disputed /
   *   gross
   * )
   */
  const numerator =
    BigInt(
      sellerNet,
    ) *
    BigInt(
      disputed,
    );

  const denominator =
    BigInt(
      gross,
    );

  const rounded =
    (
      numerator +
      denominator /
        2n
    ) /
    denominator;

  const result =
    Number(
      rounded,
    );

  if (
    !Number.isSafeInteger(
      result,
    ) ||
    result <
      0 ||
    result >
      sellerNet
  ) {
    throw new Error(
      "Seller dispute liability ไม่ถูกต้อง",
    );
  }

  return result;
}

const DISPUTABLE_ORDER_STATUSES =
  new Set([
    "paid",
    "processing",
    "completed",
    "refunded",
  ]);

export const disputeService = {
  async applyProviderSnapshot(
    snapshot:
      ProviderDisputeSnapshot,
  ) {
    const payment =
      await Payment.findOne({
        providerPaymentId:
          snapshot
            .providerChargeId,
      });

    /*
     * Foreign Omise Charge:
     * acknowledge webhook แต่ห้ามสร้าง
     * NEXORA financial record
     */
    if (!payment) {
      return {
        ignored:
          true,

        providerDisputeId:
          snapshot
            .providerDisputeId,
      };
    }

    const gross =
      payment
        .grossAmountSatang;

    const net =
      payment
        .sellerNetSatang;

    if (
      typeof gross !==
        "number" ||
      !Number.isSafeInteger(
        gross,
      ) ||
      gross <=
        0 ||
      typeof net !==
        "number" ||
      !Number.isSafeInteger(
        net,
      ) ||
      net <
        0
    ) {
      throw new Error(
        "Payment ไม่มี modern gross/seller-net accounting สำหรับ Dispute",
      );
    }

    if (
      snapshot.currency !==
        "THB" ||
      snapshot
        .fundingCurrency !==
        "THB" ||
      snapshot
        .amountSatang !==
        snapshot
          .fundingAmountSatang
    ) {
      throw new Error(
        "Dispute accounting currency/funding ไม่รองรับ",
      );
    }

    if (
      snapshot
        .amountSatang >
      gross
    ) {
      throw new Error(
        "Dispute amount มากกว่า Payment gross",
      );
    }

    const liability =
      sellerLiability(
        gross,
        net,
        snapshot
          .amountSatang,
      );

    /*
     * LOST ต้องมี provider debit
     * financial evidence ก่อน
     * crystallize Seller loss
     */
    if (
      snapshot.status ===
        "lost" &&
      snapshot
        .providerDebitSatang <
        snapshot
          .fundingAmountSatang
    ) {
      throw new Error(
        "Dispute LOST แต่ยังไม่มี Provider debit transaction ครบ",
      );
    }

    /*
     * WON จะปลด risk ได้ต่อเมื่อ
     * Provider credit ถูกเห็นจริง
     */
    const providerCreditConfirmed =
      snapshot.status ===
        "won" &&
      snapshot
        .providerCreditSatang >=
        snapshot
          .fundingAmountSatang;

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
            const currentPayment =
              await Payment
                .findOne({
                  paymentId:
                    payment
                      .paymentId,
                })
                .session(
                  session,
                );

            if (
              !currentPayment ||
              currentPayment
                .providerPaymentId !==
                snapshot
                  .providerChargeId
            ) {
              throw new Error(
                "Payment identity เปลี่ยนระหว่าง Dispute reconciliation",
              );
            }

            const order =
              await Order
                .findOne({
                  orderId:
                    currentPayment
                      .orderId,
                })
                .session(
                  session,
                );

            if (!order) {
              throw new Error(
                "ไม่พบ Order สำหรับ Dispute",
              );
            }

            if (
              order.sellerId !==
                currentPayment
                  .sellerId ||
              order.shopId !==
                currentPayment
                  .shopId
            ) {
              throw new Error(
                "Order/Payment Seller identity ไม่ตรงกัน",
              );
            }

            let dispute =
              await Dispute
                .findOne({
                  providerDisputeId:
                    snapshot
                      .providerDisputeId,
                })
                .session(
                  session,
                );

            const previousProviderStatus =
              dispute?.status ??
              null;

            if (
              previousProviderStatus &&
              (
                previousProviderStatus ===
                  "won" ||
                previousProviderStatus ===
                  "lost"
              ) &&
              (
                snapshot.status ===
                  "open" ||
                snapshot.status ===
                  "pending"
              )
            ) {
              throw new Error(
                "Canonical Dispute พยายามย้อนจาก terminal กลับ active",
              );
            }

            if (!dispute) {
              const previousOrderStatus =
                order.status ===
                  "disputed"
                  ? (
                      order.metadata
                        ?.disputePreviousStatus ??
                      null
                    )
                  : order.status;

              dispute =
                new Dispute({
                  disputeId:
                    generateDisputeId(),

                  provider:
                    "omise",

                  providerDisputeId:
                    snapshot
                      .providerDisputeId,

                  providerChargeId:
                    snapshot
                      .providerChargeId,

                  paymentId:
                    currentPayment
                      .paymentId,

                  orderId:
                    currentPayment
                      .orderId,

                  sellerId:
                    currentPayment
                      .sellerId,

                  shopId:
                    currentPayment
                      .shopId,

                  previousOrderStatus,
                });
            } else {
              if (
                dispute.paymentId !==
                  currentPayment
                    .paymentId ||
                dispute.orderId !==
                  currentPayment
                    .orderId ||
                dispute.sellerId !==
                  currentPayment
                    .sellerId ||
                dispute.shopId !==
                  currentPayment
                    .shopId ||
                dispute
                  .providerChargeId !==
                  snapshot
                    .providerChargeId
              ) {
                throw new Error(
                  "Dispute identity ไม่ตรงกับ Payment เดิม",
                );
              }
            }

            if (
              snapshot.status ===
                "lost" &&
              previousProviderStatus !==
                "lost"
            ) {
              dispute.riskResolvedAt =
                null;

              dispute.riskResolvedBy =
                null;

              dispute
                .riskResolutionReason =
                null;
            }

            dispute.status =
              snapshot.status;

            dispute.amountSatang =
              snapshot
                .amountSatang;

            dispute
              .fundingAmountSatang =
              snapshot
                .fundingAmountSatang;

            dispute
              .sellerLiabilitySatang =
              liability;

            dispute.currency =
              "THB";

            dispute.fundingCurrency =
              "THB";

            dispute
              .providerDebitSatang =
              snapshot
                .providerDebitSatang;

            dispute
              .providerCreditSatang =
              snapshot
                .providerCreditSatang;

            dispute
              .providerTransactionIds =
              snapshot.transactions
                .map(
                  (
                    transaction,
                  ) =>
                    transaction
                      .providerTransactionId,
                );

            dispute.reasonCode =
              snapshot
                .reasonCode;

            dispute.reasonMessage =
              snapshot
                .reasonMessage;

            dispute.message =
              snapshot.message;

            dispute.adminMessage =
              snapshot
                .adminMessage;

            dispute.openedAt =
              dispute.openedAt ??
              snapshot.createdAt ??
              new Date();

            dispute.closedAt =
              snapshot.closedAt;

            dispute
              .lastReconciledAt =
              new Date();

            dispute.metadata = {
              ...(
                dispute.metadata ??
                {}
              ),

              providerCreditConfirmed,

              lastProviderStatus:
                snapshot.status,
            };

            /*
             * OPEN / PENDING / LOST
             * ทำให้ Order อยู่ disputed
             */
            if (
              snapshot.status ===
                "open" ||
              snapshot.status ===
                "pending" ||
              snapshot.status ===
                "lost"
            ) {
              if (
                order.status !==
                "disputed"
              ) {
                if (
                  !DISPUTABLE_ORDER_STATUSES
                    .has(
                      order.status,
                    )
                ) {
                  throw new Error(
                    `Order สถานะ ${order.status} ไม่สามารถเข้า dispute ได้`,
                  );
                }

                order.metadata = {
                  ...(
                    order.metadata ??
                    {}
                  ),

                  disputePreviousStatus:
                    order.status,

                  activeDisputeId:
                    dispute
                      .disputeId,

                  providerDisputeId:
                    snapshot
                      .providerDisputeId,

                  disputedAt:
                    new Date(),
                };

                order.status =
                  "disputed";

                order.markModified(
                  "metadata",
                );

                await order.save({
                  session,
                });
              }
            }

            await dispute.save({
              session,
            });

            if (
              snapshot.status ===
              "lost"
            ) {
              const loss =
                await sellerLedgerService
                  .applyDisputeLoss(
                    dispute,
                    session,
                  );

              if (
                loss &&
                !dispute
                  .lossAppliedAt
              ) {
                dispute.lossAppliedAt =
                  new Date();

                await dispute.save({
                  session,
                });
              }
            }

            if (
              snapshot.status ===
                "won" &&
              providerCreditConfirmed
            ) {
              const recovery =
                await sellerLedgerService
                  .reverseDisputeLoss(
                    dispute,
                    session,
                  );

              if (
                recovery &&
                !dispute
                  .recoveryAppliedAt
              ) {
                dispute
                  .recoveryAppliedAt =
                  new Date();

                await dispute.save({
                  session,
                });
              }
            }

            const financialState =
              await sellerFinancialRiskService
                .refreshSellerRisk(
                  dispute.sellerId,
                  dispute.shopId,
                  session,
                );

            /*
             * WON + provider credit confirmed:
             * restore Order เมื่อไม่มี
             * dispute blocker อื่นบน Order นี้
             */
            if (
              snapshot.status ===
                "won" &&
              providerCreditConfirmed &&
              order.status ===
                "disputed"
            ) {
              const otherBlocker =
                await Dispute
                  .findOne({
                    orderId:
                      order.orderId,

                    providerDisputeId: {
                      $ne:
                        snapshot
                          .providerDisputeId,
                    },

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
                  })
                  .session(
                    session,
                  );

              if (!otherBlocker) {
                const restoreStatus =
                  dispute
                    .previousOrderStatus;

                /*
                 * ใช้ literal validation แทน Set.has()
                 * เพื่อให้ TypeScript narrow type
                 * เป็น Order status union ได้ด้วย
                 */
                if (
                  restoreStatus !==
                    "paid" &&
                  restoreStatus !==
                    "processing" &&
                  restoreStatus !==
                    "completed" &&
                  restoreStatus !==
                    "refunded"
                ) {
                  throw new Error(
                    "ไม่สามารถ restore Order หลัง WON dispute ได้",
                  );
                }

                order.status =
                  restoreStatus;

                order.metadata = {
                  ...(
                    order.metadata ??
                    {}
                  ),

                  activeDisputeId:
                    null,

                  disputeOutcome:
                    "won",

                  disputeResolvedAt:
                    new Date(),
                };

                order.markModified(
                  "metadata",
                );

                await order.save({
                  session,
                });
              }
            }

            result = {
              ignored:
                false,

              dispute,

              financialState,
            };
          },
        );
    } finally {
      await session
        .endSession();
    }

    if (!result) {
      throw new Error(
        "Dispute reconciliation ไม่ได้ผลลัพธ์",
      );
    }

    return result;
  },

  async resolveLostDisputeRisk(
    data: {
      disputeId:
        string;

      actorId:
        string;

      reason:
        string;
    },
  ) {
    const reason =
      data.reason
        .trim();

    if (
      !data.disputeId
        .trim() ||
      !data.actorId
        .trim()
    ) {
      throw new Error(
        "Dispute ID / Actor ID ไม่ถูกต้อง",
      );
    }

    if (
      reason.length <
      10
    ) {
      throw new Error(
        "เหตุผลในการปลด Financial Risk ต้องอย่างน้อย 10 ตัวอักษร",
      );
    }

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
            const dispute =
              await Dispute
                .findOne({
                  disputeId:
                    data.disputeId,
                })
                .session(
                  session,
                );

            if (!dispute) {
              throw new Error(
                "ไม่พบ Dispute",
              );
            }

            if (
              dispute.status !==
              "lost"
            ) {
              throw new Error(
                "ปลด Financial Risk ได้เฉพาะ Dispute ที่ Provider ยืนยัน LOST แล้วเท่านั้น",
              );
            }

            if (
              dispute
                .providerDebitSatang <
              dispute
                .fundingAmountSatang
            ) {
              throw new Error(
                "LOST Dispute ยังไม่มี Provider debit accounting ครบ",
              );
            }

            if (
              dispute
                .sellerLiabilitySatang >
              0
            ) {
              const loss =
                await SellerLedgerEntry
                  .findOne({
                    sourceKey:
                      `dispute-loss:${dispute.providerDisputeId}`,
                  })
                  .session(
                    session,
                  );

              if (
                !loss ||
                loss.amountSatang !==
                  -dispute
                    .sellerLiabilitySatang
              ) {
                throw new Error(
                  "Dispute loss ledger ยังไม่ reconcile",
                );
              }
            }

            const balances =
              await SellerLedgerEntry
                .aggregate<{
                  balanceSatang:
                    number;
                }>([
                  {
                    $match: {
                      sellerId:
                        dispute.sellerId,
                    },
                  },

                  {
                    $group: {
                      _id:
                        null,

                      balanceSatang: {
                        $sum:
                          "$amountSatang",
                      },
                    },
                  },
                ])
                .session(
                  session,
                );

            const balance =
              balances[0]
                ?.balanceSatang ??
              0;

            if (
              !Number.isSafeInteger(
                balance,
              )
            ) {
              throw new Error(
                "Seller balance ไม่ใช่ safe integer",
              );
            }

            /*
             * ห้าม Admin ปลด freeze
             * ขณะที่ Seller ยังติดหนี้
             */
            if (
              balance <
              0
            ) {
              throw new Error(
                `Seller ยังมียอดติดลบ ${Math.abs(
                  balance,
                )} satang — ห้ามปลด Financial Risk`,
              );
            }

            if (
              dispute
                .riskResolvedAt
            ) {
              const state =
                await sellerFinancialRiskService
                  .refreshSellerRisk(
                    dispute.sellerId,
                    dispute.shopId,
                    session,
                  );

              result = {
                dispute,
                financialState:
                  state,
                alreadyResolved:
                  true,
              };

              return;
            }

            const now =
              new Date();

            dispute
              .riskResolvedAt =
              now;

            dispute
              .riskResolvedBy =
              data.actorId;

            dispute
              .riskResolutionReason =
              reason;

            await dispute.save({
              session,
            });

            const sourceKey =
              `risk-resolve:${dispute.disputeId}`;

            const existingAction =
              await FinancialRiskAction
                .findOne({
                  sourceKey,
                })
                .session(
                  session,
                );

            if (!existingAction) {
              const action =
                new FinancialRiskAction({
                  actionId:
                    generateRiskActionId(),

                  sourceKey,

                  action:
                    "resolve_lost_dispute",

                  disputeId:
                    dispute.disputeId,

                  providerDisputeId:
                    dispute
                      .providerDisputeId,

                  sellerId:
                    dispute.sellerId,

                  shopId:
                    dispute.shopId,

                  actorId:
                    data.actorId,

                  reason,

                  sellerBalanceSatang:
                    balance,

                  metadata: {
                    sellerLiabilitySatang:
                      dispute
                        .sellerLiabilitySatang,

                    providerDebitSatang:
                      dispute
                        .providerDebitSatang,
                  },
                });

              await action.save({
                session,
              });
            }

            /*
             * LOST ยังคงเป็น historical
             * Order.status = disputed
             *
             * แต่ active blocker ถูกปิด
             */
            const order =
              await Order
                .findOne({
                  orderId:
                    dispute.orderId,
                })
                .session(
                  session,
                );

            if (
              order &&
              order.status ===
                "disputed" &&
              order.metadata
                ?.activeDisputeId ===
                dispute.disputeId
            ) {
              order.metadata = {
                ...(
                  order.metadata ??
                  {}
                ),

                activeDisputeId:
                  null,

                disputeOutcome:
                  "lost",

                disputeRiskResolvedAt:
                  now,

                disputeRiskResolvedBy:
                  data.actorId,
              };

              order.markModified(
                "metadata",
              );

              await order.save({
                session,
              });
            }

            const state =
              await sellerFinancialRiskService
                .refreshSellerRisk(
                  dispute.sellerId,
                  dispute.shopId,
                  session,
                );

            result = {
              dispute,
              financialState:
                state,
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
        "Financial Risk resolution ไม่ได้ผลลัพธ์",
      );
    }

    return result;
  },

  async reconcileProviderDispute(
    providerDisputeId:
      string,
  ) {
    /*
     * Webhook เป็น trigger เท่านั้น
     * GET canonical Provider state ใหม่เสมอ
     */
    const snapshot =
      await omiseDisputeProvider
        .retrieveDispute(
          providerDisputeId,
        );

    return this
      .applyProviderSnapshot(
        snapshot,
      );
  },
};
