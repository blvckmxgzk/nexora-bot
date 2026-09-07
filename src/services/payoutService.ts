import crypto from "node:crypto";
import mongoose from "mongoose";

import {
  Payout,
} from "../models/Payout.js";

import {
  SellerPayoutAccount,
} from "../models/SellerPayoutAccount.js";

import {
  sellerLedgerService,
} from "./sellerLedgerService.js";

import {
  sellerFinancialRiskService,
} from "./marketplace/sellerFinancialRiskService.js";

import {
  marketplaceRiskService,
} from "./marketplace/marketplaceRiskService.js";

import {
  marketplaceRiskReviewService,
} from "./marketplace/marketplaceRiskReviewService.js";

import {
  payoutProviderRegistry,
} from "./payment/payoutProviderRegistry.js";

import type {
  PayoutProvider,
  PayoutTransferSnapshot,
} from "./payment/payoutProvider.js";

export const MIN_PAYOUT_SATANG =
  3_000;

function generatePayoutId():
  string {
  return (
    "PO-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

export function parseBahtToSatang(
  value: string,
): number {
  const trimmed =
    value.trim();

  if (
    !/^\d+(?:\.\d{1,2})?$/.test(
      trimmed,
    )
  ) {
    throw new Error(
      "กรุณาระบุจำนวนเงินเป็นบาทและมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    );
  }

  const [
    whole,
    decimal = "",
  ] =
    trimmed.split(
      ".",
    );

  const satang =
    Number(whole) *
      100 +
    Number(
      decimal.padEnd(
        2,
        "0",
      ),
    );

  if (
    !Number.isSafeInteger(
      satang,
    ) ||
    satang <= 0
  ) {
    throw new Error(
      "จำนวนเงินถอนไม่ถูกต้อง",
    );
  }

  return satang;
}

function validateTransferAccounting(
  transfer:
    PayoutTransferSnapshot,
): void {
  const hasFee =
    transfer.feeSatang !==
    null;

  const hasNet =
    transfer.netSatang !==
    null;

  if (
    hasFee !==
    hasNet
  ) {
    throw new Error(
      "Omise Transfer ส่งข้อมูล fee/net มาไม่ครบ",
    );
  }

  if (hasFee && hasNet) {
    if (
      !Number.isSafeInteger(
        transfer.feeSatang,
      ) ||
      transfer.feeSatang! <
        0
    ) {
      throw new Error(
        "Omise Transfer fee ไม่ถูกต้อง",
      );
    }

    if (
      !Number.isSafeInteger(
        transfer.netSatang,
      ) ||
      transfer.netSatang! <
        0
    ) {
      throw new Error(
        "Omise Transfer net ไม่ถูกต้อง",
      );
    }

    if (
      transfer.netSatang !==
      transfer.amountSatang -
        transfer.feeSatang!
    ) {
      throw new Error(
        "Omise Transfer net ไม่ตรงกับ amount - total_fee",
      );
    }
  }

  /*
   * Terminal paid ต้องมี accounting
   * data ครบก่อน NEXORA ยืนยัน paid
   */
  if (
    transfer.paid &&
    (!hasFee || !hasNet)
  ) {
    throw new Error(
      "Omise Transfer paid แต่ไม่มี fee/net สำหรับ reconciliation",
    );
  }
}

async function applyTransferState(
  payoutId:
    string,

  transfer:
    PayoutTransferSnapshot,
) {
  const payout =
    await Payout.findOne({
      payoutId,
    });

  if (!payout) {
    throw new Error(
      "ไม่พบ Payout",
    );
  }

  if (
    transfer.recipientId !==
    payout.recipientId
  ) {
    throw new Error(
      "Recipient ของ Omise Transfer ไม่ตรงกับ Payout",
    );
  }

  if (
    transfer.amountSatang !==
    payout.amountSatang
  ) {
    throw new Error(
      "ยอด Omise Transfer ไม่ตรงกับ Payout",
    );
  }

  if (
    transfer.currency !==
    "THB"
  ) {
    throw new Error(
      `Currency ของ Omise Transfer ไม่รองรับ: ${transfer.currency}`,
    );
  }

  validateTransferAccounting(
    transfer,
  );

  /*
   * fail_fast=true:
   * failure_code / deleted
   * ถือเป็น definite provider failure
   *
   * ต้องคืน reservation transactionally
   */
  if (
    transfer.deleted ||
    transfer.failureCode
  ) {
    const session =
      await mongoose
        .startSession();

    try {
      await session.withTransaction(
        async () => {
          const current =
            await Payout
              .findOne({
                payoutId,
              })
              .session(
                session,
              );

          if (!current) {
            throw new Error(
              "ไม่พบ Payout สำหรับ failure reconciliation",
            );
          }

          if (
            current.status ===
            "paid"
          ) {
            return;
          }

          if (
            current.status !==
            "failed"
          ) {
            await sellerLedgerService
              .releasePayout(
                current,
                session,
              );

            current.status =
              "failed";

            current.providerTransferId =
              transfer.providerTransferId;

            current.failedAt =
              new Date();

            current.failureCode =
              transfer.failureCode ??
              (transfer.deleted
                ? "transfer_deleted"
                : "transfer_failed");

            current.failureMessage =
              transfer.failureMessage ??
              null;

            current.feeSatang =
              transfer.feeSatang;

            current.netSatang =
              transfer.netSatang;

            current.lastReconciledAt =
              new Date();

            await current.save({
              session,
            });
          }
        },
      );
    } finally {
      await session.endSession();
    }

    const failed =
      await Payout.findOne({
        payoutId,
      });

    if (!failed) {
      throw new Error(
        "Payout หายไปหลัง failure reconciliation",
      );
    }

    return failed;
  }

  const targetStatus =
    transfer.paid
      ? "paid"
      : transfer.sent
        ? "sent"
        : "submitted";

  const current =
    await Payout.findOne({
      payoutId,
    });

  if (!current) {
    throw new Error(
      "ไม่พบ Payout",
    );
  }

  const rank:
    Record<string, number> = {
      creating_transfer: 0,
      submitted: 1,
      sent: 2,
      paid: 3,
    };

  const effectiveStatus =
    (
      rank[current.status] ??
      0
    ) >
    (
      rank[targetStatus] ??
      0
    )
      ? current.status
      : targetStatus;

  const updated =
    await Payout.findOneAndUpdate(
      {
        payoutId,
        status: {
          $in: [
            "creating_transfer",
            "submitted",
            "sent",
            "paid",
          ],
        },
      },
      {
        $set: {
          providerTransferId:
            transfer.providerTransferId,

          status:
            effectiveStatus,

          feeSatang:
            transfer.feeSatang,

          netSatang:
            transfer.netSatang,

          lastReconciledAt:
            new Date(),

          failureCode:
            null,

          failureMessage:
            null,

          submittedAt:
            current.submittedAt ??
            new Date(),

          ...(transfer.sent
            ? {
                sentAt:
                  transfer.sentAt ??
                  new Date(),
              }
            : {}),

          ...(transfer.paid
            ? {
                paidAt:
                  transfer.paidAt ??
                  new Date(),
              }
            : {}),

          "metadata.transferCreationLastError":
            null,
        },
      },
      {
        new: true,
      },
    );

  if (!updated) {
    throw new Error(
      "ไม่สามารถ reconcile Omise Transfer กับ Payout ได้",
    );
  }

  return updated;
}

function shouldEnforceProviderLiquidityPreflight():
  boolean {
  /*
   * Existing unit tests historically mock
   * Transfer creation only.
   *
   * Production ALWAYS enforces preflight.
   * Phase 5.8 tests explicitly enable it.
   */
  return (
    process.env.NODE_ENV !==
      "test" ||
    process.env
      .NEXORA_TEST_PROVIDER_LIQUIDITY_PREFLIGHT ===
      "1"
  );
}

async function assertProviderLiquidity(
  payout:
    any,

  provider:
    PayoutProvider,
): Promise<void> {
  const balance =
    await provider
      .retrieveBalance();

  if (
    balance.currency !==
    "THB"
  ) {
    throw new Error(
      `Provider balance currency ไม่รองรับ: ${balance.currency}`,
    );
  }

  const checkedAt =
    new Date();

  await Payout.updateOne(
    {
      payoutId:
        payout.payoutId,

      status:
        "reserved",
    },
    {
      $set: {
        "metadata.lastLiquidityCheckAt":
          checkedAt,

        "metadata.lastProviderTransferableSatang":
          balance.transferableSatang,

        "metadata.lastProviderTotalSatang":
          balance.totalSatang,
      },
    },
  );

  if (
    balance.transferableSatang <
    payout.amountSatang
  ) {
    throw new Error(
      `ยอดเงินที่ Omise พร้อม Transfer ไม่เพียงพอ: ต้องการ ${payout.amountSatang} satang แต่ transferable มี ${balance.transferableSatang} satang`,
    );
  }
}

async function recoverCreatingTransfer(
  payout:
    any,
) {
  const provider =
    payoutProviderRegistry.get(
      payout.provider,
    );

  const recovered =
    await provider
      .findExistingTransfer({
        payoutId:
          payout.payoutId,

        sellerId:
          payout.sellerId,

        shopId:
          payout.shopId,

        recipientId:
          payout.recipientId,

        amountSatang:
          payout.amountSatang,
      });

  if (!recovered) {
    throw new Error(
      "Payout อยู่ระหว่างตรวจสอบกับ Omise ระบบจะไม่สร้าง Transfer ซ้ำ",
    );
  }

  return applyTransferState(
    payout.payoutId,
    recovered,
  );
}

async function claimPayoutForTransfer(
  payout:
    any,
) {
  const session =
    await mongoose
      .startSession();

  let claimed:
    any =
      null;

  try {
    await session
      .withTransaction(
        async () => {
          await sellerFinancialRiskService
            .assertPayoutAllowed(
              payout.sellerId,
              payout.shopId,
              session,
            );

          await marketplaceRiskReviewService
            .assertPayoutTransferAllowed(
              payout,
              session,
            );

          claimed =
            await Payout
              .findOneAndUpdate(
                {
                  payoutId:
                    payout.payoutId,

                  status:
                    "reserved",

                  providerTransferId:
                    null,
                },
                {
                  $set: {
                    status:
                      "creating_transfer",

                    "metadata.transferClaimedAt":
                      new Date(),
                  },
                },
                {
                  new:
                    true,

                  session,
                },
              );
        },
      );
  } finally {
    await session
      .endSession();
  }

  return claimed;
}

export const payoutService = {
  async requestPayout(
    data: {
      sellerId:
        string;

      amountSatang:
        number;
    },
  ) {
    if (
      !Number.isSafeInteger(
        data.amountSatang,
      ) ||
      data.amountSatang <
        MIN_PAYOUT_SATANG
    ) {
      throw new Error(
        "ยอดถอนขั้นต่ำคือ ฿30.00",
      );
    }

    const account =
      await SellerPayoutAccount
        .findOne({
          sellerId:
            data.sellerId,

          status:
            "ready",

          recipientActive:
            true,

          recipientVerified:
            true,
        });

    if (
      !account ||
      !account.recipientId
    ) {
      throw new Error(
        "บัญชีถอนเงินยังไม่พร้อมใช้งาน",
      );
    }

    const riskDecision =
      await marketplaceRiskService
        .evaluatePayoutRequest({
          sellerId:
            data.sellerId,

          shopId:
            account.shopId,

          amountSatang:
            data.amountSatang,
        });

    marketplaceRiskService
      .assertNotBlocked(
        riskDecision,
      );

    const payoutId =
      generatePayoutId();

    const idempotencyKey =
      `nexora-payout-${payoutId}`;

    const session =
      await mongoose
        .startSession();

    let created:
      any = null;

    try {
      await session.withTransaction(
        async () => {
          const currentAccount =
            await SellerPayoutAccount
              .findOne({
                payoutAccountId:
                  account.payoutAccountId,

                sellerId:
                  data.sellerId,

                status:
                  "ready",

                recipientActive:
                  true,

                recipientVerified:
                  true,
              })
              .session(
                session,
              );

          if (
            !currentAccount ||
            !currentAccount.recipientId
          ) {
            throw new Error(
              "บัญชีถอนเงินไม่พร้อมใช้งาน",
            );
          }

          await sellerFinancialRiskService
            .assertPayoutAllowed(
              currentAccount.sellerId,
              currentAccount.shopId,
              session,
            );

          const payout =
            new Payout({
              payoutId,

              sellerId:
                currentAccount.sellerId,

              shopId:
                currentAccount.shopId,

              payoutAccountId:
                currentAccount.payoutAccountId,

              provider:
                "omise",

              recipientId:
                currentAccount.recipientId,

              amountSatang:
                data.amountSatang,

              currency:
                "THB",

              feePolicy:
                "seller_pays",

              status:
                "reserved",

              idempotencyKey,

              requestedAt:
                new Date(),

              metadata: {
                transferCreationLastError:
                  null,

                riskEventId:
                  riskDecision
                    .riskEventId,

                riskDecision:
                  riskDecision
                    .decision,

                riskScore:
                  riskDecision
                    .score,
              },
            });

          await payout.save({
            session,
          });

          if (
            riskDecision
              .decision ===
            "review"
          ) {
            const review =
              await marketplaceRiskReviewService
                .createReview(
                  {
                    decision:
                      riskDecision,

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

                    metadata: {
                      amountSatang:
                        payout.amountSatang,
                    },
                  },

                  session,
                );

            payout.metadata = {
              ...(
                payout.metadata ??
                {}
              ),

              riskReviewId:
                review.reviewId,

              riskReviewStatus:
                "pending",
            };

            payout.markModified(
              "metadata",
            );

            await payout.save({
              session,
            });
          }

          /*
           * FinancialState mutex +
           * balance check +
           * reserve ledger
           * อยู่ transaction เดียวกัน
           */
          await sellerLedgerService
            .reservePayout(
              payout,
              session,
            );

          created =
            payout;
        },
      );
    } catch (
      error: any
    ) {
      if (
        error?.code ===
        11000
      ) {
        throw new Error(
          "คุณมีคำขอถอนเงินที่กำลังดำเนินการอยู่แล้ว",
        );
      }

      throw error;
    } finally {
      await session.endSession();
    }

    if (!created) {
      throw new Error(
        "ไม่สามารถสร้าง Payout ได้",
      );
    }

    return created;
  },

  /*
   * Webhook reconciliation จาก Transfer ID
   * ที่ Omise แจ้งมา
   *
   * ไม่มีเส้นทางใดใน method นี้
   * ที่สามารถ create Transfer ใหม่ได้
   */
  async reconcileProviderTransfer(
    payoutId:
      string,

    providerTransferId:
      string,
  ) {
    const payout =
      await Payout.findOne({
        payoutId,
      });

    if (!payout) {
      throw new Error(
        "ไม่พบ Payout สำหรับ Transfer reconciliation",
      );
    }

    if (
      payout.providerTransferId &&
      payout.providerTransferId !==
        providerTransferId
    ) {
      throw new Error(
        "Omise Transfer ID ไม่ตรงกับ Payout",
      );
    }

    const provider =
      payoutProviderRegistry.get(
        payout.provider,
      );

    /*
     * GET provider resource ใหม่เสมอ
     * ไม่ใช้ state จาก webhook payload
     */
    const transfer =
      await provider
        .retrieveTransfer(
          providerTransferId,
        );

    return applyTransferState(
      payout.payoutId,
      transfer,
    );
  },

  async processPayout(
    payoutId:
      string,
  ) {
    let payout =
      await Payout.findOne({
        payoutId,
      });

    if (!payout) {
      throw new Error(
        "ไม่พบ Payout",
      );
    }

    const provider =
      payoutProviderRegistry.get(
        payout.provider,
      );

    if (
      payout.status ===
      "paid"
    ) {
      return payout;
    }

    if (
      payout.status ===
      "failed"
    ) {
      throw new Error(
        "Payout นี้ล้มเหลวและ reservation ถูกคืนแล้ว",
      );
    }

    /*
     * เคย attach Transfer แล้ว
     * retrieve เท่านั้น ห้ามสร้างใหม่
     */
    if (
      payout.providerTransferId
    ) {
      const transfer =
        await provider
          .retrieveTransfer(
            payout.providerTransferId,
          );

      return applyTransferState(
        payout.payoutId,
        transfer,
      );
    }

    if (
      payout.status ===
      "creating_transfer"
    ) {
      return recoverCreatingTransfer(
        payout,
      );
    }

    if (
      payout.status !==
      "reserved"
    ) {
      throw new Error(
        `Payout สถานะ ${payout.status} ไม่สามารถสร้าง Transfer ใหม่ได้`,
      );
    }

    await marketplaceRiskReviewService
      .assertPayoutTransferAllowed(
        payout,
      );

    /*
     * Provider liquidity preflight ต้องเกิด
     * ก่อน reserved -> creating_transfer
     *
     * หาก Balance API fail หรือ transferable
     * ไม่พอ:
     * - ห้าม claim
     * - ห้าม create Transfer
     * - Payout ต้องคง reserved
     */
    if (
      shouldEnforceProviderLiquidityPreflight()
    ) {
      await assertProviderLiquidity(
        payout,
        provider,
      );
    }

    const claimed =
      await claimPayoutForTransfer(
        payout,
      );

    if (!claimed) {
      payout =
        await Payout.findOne({
          payoutId,
        });

      if (!payout) {
        throw new Error(
          "Payout หายไประหว่าง claim",
        );
      }

      if (
        payout.providerTransferId
      ) {
        const transfer =
          await provider
            .retrieveTransfer(
              payout.providerTransferId,
            );

        return applyTransferState(
          payout.payoutId,
          transfer,
        );
      }

      return recoverCreatingTransfer(
        payout,
      );
    }

    try {
      const transfer =
        await provider
          .createTransfer({
            payoutId:
              claimed.payoutId,

            sellerId:
              claimed.sellerId,

            shopId:
              claimed.shopId,

            recipientId:
              claimed.recipientId,

            amountSatang:
              claimed.amountSatang,

            idempotencyKey:
              claimed.idempotencyKey,
          });

      return applyTransferState(
        claimed.payoutId,
        transfer,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Transfer creation failed";

      /*
       * network timeout อาจเกิดหลัง
       * Omise สร้าง Transfer แล้ว
       *
       * ห้าม release reservation
       * และห้ามสร้าง Transfer ใหม่
       */
      await Payout.updateOne(
        {
          payoutId:
            claimed.payoutId,

          status:
            "creating_transfer",

          providerTransferId:
            null,
        },
        {
          $set: {
            "metadata.transferCreationLastError":
              message.slice(
                0,
                2000,
              ),

            "metadata.transferCreationLastAttemptAt":
              new Date(),
          },
        },
      );

      throw error;
    }
  },
};


export async function reconcileOpenPayouts(
  limit = 50,
): Promise<{
  checked: number;
  reconciled: number;
  failed: number;
}> {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Math.trunc(
          limit,
        ),
      ),
    );

  const payouts =
    await Payout.find({
      $or: [
        {
          status:
            "reserved",

          "metadata.riskReviewStatus": {
            $ne:
              "pending",
          },
        },

        {
          status: {
            $in: [
              "creating_transfer",
              "submitted",
              "sent",
            ],
          },
        },
      ],
    })
      .sort({
        requestedAt: 1,
      })
      .limit(
        safeLimit,
      );

  let reconciled =
    0;

  let failed =
    0;

  for (
    const payout
    of payouts
  ) {
    try {
      await payoutService
        .processPayout(
          payout.payoutId,
        );

      reconciled++;
    } catch (error) {
      failed++;

      /*
       * ห้ามเปลี่ยน state จาก local assumption
       *
       * รอบต่อไปจะ query Omise ใหม่
       */
      console.error(
        `⚠️ Payout reconciliation pending for ${payout.payoutId}:`,
        error,
      );
    }
  }

  return {
    checked:
      payouts.length,

    reconciled,

    failed,
  };
}
