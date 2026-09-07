import mongoose from "mongoose";

import {
  Payment,
} from "../../models/Payment.js";

import {
  SellerLedgerEntry,
} from "../../models/SellerLedgerEntry.js";

import {
  sellerLedgerService,
} from "../sellerLedgerService.js";

import {
  omiseProvider,
} from "../payment/providers/omiseProvider.js";

import type {
  PaymentVerificationResult,
} from "../payment/paymentProvider.js";

interface MigrationAccounting {
  grossAmountSatang:
    number;

  fundingAmountSatang:
    number;

  providerFeeSatang:
    number;

  providerFeeVatSatang:
    number;

  providerDeductionsSatang:
    number;

  providerNetSatang:
    number;

  sellerNetSatang:
    number;

  providerTransactionId:
    string |
    null;
}

interface MigrationFailure {
  paymentId:
    string;

  orderId:
    string;

  reason:
    string;
}

export interface Phase60MigrationResult {
  apply:
    boolean;

  scanned:
    number;

  alreadyModern:
    number;

  providerVerified:
    number;

  wouldUpdatePayments:
    number;

  wouldCreateSaleAdjustments:
    number;

  wouldCreateRefundAdjustments:
    number;

  updatedPayments:
    number;

  saleAdjustmentsCreated:
    number;

  refundAdjustmentsCreated:
    number;

  unresolved:
    number;

  failures:
    MigrationFailure[];
}

type VerifyPayment =
  (
    payment:
      any,
  ) =>
    Promise<
      PaymentVerificationResult
    >;

function toSatang(
  amount:
    number,
): number {
  const scaled =
    amount *
    100;

  const satang =
    Math.round(
      scaled,
    );

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <
      0 ||
    !Number.isSafeInteger(
      satang,
    ) ||
    Math.abs(
      scaled -
      satang,
    ) >
      1e-8
  ) {
    throw new Error(
      "Payment amount ไม่ถูกต้อง",
    );
  }

  return satang;
}

function validateExistingAccounting(
  payment:
    any,
):
  MigrationAccounting |
  null {
  if (
    payment.accountingPolicy !==
      "seller_pays_provider_fee"
  ) {
    return null;
  }

  const gross =
    payment.grossAmountSatang;

  const funding =
    payment.fundingAmountSatang;

  const fee =
    payment.providerFeeSatang;

  const feeVat =
    payment.providerFeeVatSatang;

  const deductions =
    payment.providerDeductionsSatang;

  const providerNet =
    payment.providerNetSatang;

  const sellerNet =
    payment.sellerNetSatang;

  const values = [
    gross,
    funding,
    fee,
    feeVat,
    deductions,
    providerNet,
    sellerNet,
  ];

  if (
    values.some(
      (value) =>
        typeof value !==
          "number" ||
        !Number.isSafeInteger(
          value,
        ) ||
        value <
          0,
    )
  ) {
    return null;
  }

  const expectedGross =
    toSatang(
      payment.amount,
    );

  if (
    gross !==
      expectedGross ||
    funding !==
      expectedGross ||
    providerNet !==
      sellerNet ||
    deductions !==
      funding -
        providerNet ||
    fee +
      feeVat >
      deductions
  ) {
    return null;
  }

  return {
    grossAmountSatang:
      gross,

    fundingAmountSatang:
      funding,

    providerFeeSatang:
      fee,

    providerFeeVatSatang:
      feeVat,

    providerDeductionsSatang:
      deductions,

    providerNetSatang:
      providerNet,

    sellerNetSatang:
      sellerNet,

    providerTransactionId:
      typeof payment
        .providerTransactionId ===
        "string"
        ? payment
            .providerTransactionId
        : null,
  };
}

function accountingFromProvider(
  payment:
    any,

  result:
    PaymentVerificationResult,
):
  MigrationAccounting {
  if (
    !result.paid
  ) {
    throw new Error(
      `Provider Charge ยังไม่ successful: ${result.status ?? "unknown"}`,
    );
  }

  if (
    result.providerPaymentId !==
    payment.providerPaymentId
  ) {
    throw new Error(
      "Provider Payment ID ไม่ตรงกับ Payment",
    );
  }

  if (
    result.amount ==
      null ||
    !Number.isFinite(
      result.amount,
    )
  ) {
    throw new Error(
      "Provider ไม่ส่ง gross amount ที่ถูกต้อง",
    );
  }

  if (
    toSatang(
      result.amount,
    ) !==
    toSatang(
      payment.amount,
    )
  ) {
    throw new Error(
      "Provider gross amount ไม่ตรงกับ Payment",
    );
  }

  if (
    typeof result.currency !==
      "string" ||
    result.currency
      .toUpperCase() !==
      "THB"
  ) {
    throw new Error(
      "Provider currency ไม่ใช่ THB",
    );
  }

  const accounting =
    result.accounting;

  if (!accounting) {
    throw new Error(
      "Provider Charge ไม่มี fee/net accounting",
    );
  }

  const gross =
    toSatang(
      payment.amount,
    );

  if (
    accounting
      .grossAmountSatang !==
      gross ||
    accounting
      .fundingAmountSatang !==
      gross ||
    accounting.currency
      .toUpperCase() !==
      "THB" ||
    accounting
      .fundingCurrency
      .toUpperCase() !==
      "THB"
  ) {
    throw new Error(
      "Provider accounting gross/funding/currency ไม่ตรงกับ Payment",
    );
  }

  if (
    accounting
      .providerNetSatang >
      gross ||
    accounting
      .providerDeductionsSatang !==
      gross -
        accounting
          .providerNetSatang ||
    accounting
        .providerFeeSatang +
      accounting
        .providerFeeVatSatang >
      accounting
        .providerDeductionsSatang
  ) {
    throw new Error(
      "Provider fee/net accounting ไม่สอดคล้องกัน",
    );
  }

  return {
    grossAmountSatang:
      accounting
        .grossAmountSatang,

    fundingAmountSatang:
      accounting
        .fundingAmountSatang,

    providerFeeSatang:
      accounting
        .providerFeeSatang,

    providerFeeVatSatang:
      accounting
        .providerFeeVatSatang,

    providerDeductionsSatang:
      accounting
        .providerDeductionsSatang,

    providerNetSatang:
      accounting
        .providerNetSatang,

    sellerNetSatang:
      accounting
        .providerNetSatang,

    providerTransactionId:
      accounting
        .providerTransactionId,
  };
}

function validateLedgerIdentity(
  entry:
    any,

  payment:
    any,
): void {
  if (
    entry.sellerId !==
      payment.sellerId ||
    entry.shopId !==
      payment.shopId ||
    entry.orderId !==
      payment.orderId
  ) {
    throw new Error(
      "Ledger identity ไม่ตรงกับ Payment",
    );
  }
}

export async function backfillLegacyPaymentAccounting(
  options: {
    apply?:
      boolean;

    limit?:
      number;

    verifyPayment?:
      VerifyPayment;
  } = {},
): Promise<Phase60MigrationResult> {
  const apply =
    options.apply ===
    true;

  const limit =
    Math.max(
      1,
      Math.min(
        500,
        Math.trunc(
          options.limit ??
          100,
        ),
      ),
    );

  const verifyPayment:
    VerifyPayment =
      options.verifyPayment ??
      (
        async (
          payment,
        ) => {
          if (
            !payment
              .providerPaymentId
          ) {
            throw new Error(
              "Payment ไม่มี Provider Payment ID",
            );
          }

          return omiseProvider
            .verifyPayment(
              payment
                .providerPaymentId,
            );
        }
      );

  const payments =
    await Payment.find({
      status: {
        $in: [
          "paid",
          "refunded",
        ],
      },
    })
      .sort({
        _id:
          1,
      })
      .limit(
        limit,
      );

  const report:
    Phase60MigrationResult =
      {
        apply,

        scanned:
          payments.length,

        alreadyModern:
          0,

        providerVerified:
          0,

        wouldUpdatePayments:
          0,

        wouldCreateSaleAdjustments:
          0,

        wouldCreateRefundAdjustments:
          0,

        updatedPayments:
          0,

        saleAdjustmentsCreated:
          0,

        refundAdjustmentsCreated:
          0,

        unresolved:
          0,

        failures: [],
      };

  for (
    const payment
    of payments
  ) {
    try {
      let accounting =
        validateExistingAccounting(
          payment,
        );

      let needsPaymentUpdate =
        false;

      if (accounting) {
        report
          .alreadyModern++;
      } else {
        if (
          !payment
            .providerPaymentId
        ) {
          throw new Error(
            "Payment ไม่มี Provider Payment ID",
          );
        }

        const providerResult =
          await verifyPayment(
            payment,
          );

        report
          .providerVerified++;

        accounting =
          accountingFromProvider(
            payment,
            providerResult,
          );

        needsPaymentUpdate =
          true;

        report
          .wouldUpdatePayments++;
      }

      const saleEntry =
        await SellerLedgerEntry
          .findOne({
            sourceKey:
              `sale:${payment.orderId}`,
          });

      if (saleEntry) {
        validateLedgerIdentity(
          saleEntry,
          payment,
        );
      }

      const saleAdjustmentSatang =
        saleEntry
          ? accounting
              .sellerNetSatang -
            saleEntry
              .amountSatang
          : 0;

      if (
        saleAdjustmentSatang !==
        0
      ) {
        report
          .wouldCreateSaleAdjustments++;
      }

      const refundEntry =
        await SellerLedgerEntry
          .findOne({
            orderId:
              payment.orderId,

            type:
              "refund_debit",
          });

      if (refundEntry) {
        validateLedgerIdentity(
          refundEntry,
          payment,
        );
      }

      const refundAdjustmentSatang =
        refundEntry
          ? (
              -accounting
                .sellerNetSatang
            ) -
            refundEntry
              .amountSatang
          : 0;

      if (
        refundAdjustmentSatang !==
        0
      ) {
        report
          .wouldCreateRefundAdjustments++;
      }

      if (!apply) {
        continue;
      }

      const session =
        await mongoose
          .startSession();

      let updatedPayment =
        false;

      let saleAdjustmentCreated =
        false;

      let refundAdjustmentCreated =
        false;

      try {
        await session
          .withTransaction(
            async () => {
              const currentPayment =
                await Payment
                  .findOne({
                    paymentId:
                      payment.paymentId,
                  })
                  .session(
                    session,
                  );

              if (
                !currentPayment
              ) {
                throw new Error(
                  "Payment หายไประหว่าง migration",
                );
              }

              if (
                needsPaymentUpdate
              ) {
                const now =
                  new Date();

                currentPayment
                  .grossAmountSatang =
                  accounting!
                    .grossAmountSatang;

                currentPayment
                  .fundingAmountSatang =
                  accounting!
                    .fundingAmountSatang;

                currentPayment
                  .providerFeeSatang =
                  accounting!
                    .providerFeeSatang;

                currentPayment
                  .providerFeeVatSatang =
                  accounting!
                    .providerFeeVatSatang;

                currentPayment
                  .providerDeductionsSatang =
                  accounting!
                    .providerDeductionsSatang;

                currentPayment
                  .providerNetSatang =
                  accounting!
                    .providerNetSatang;

                currentPayment
                  .sellerNetSatang =
                  accounting!
                    .sellerNetSatang;

                currentPayment
                  .providerTransactionId =
                  accounting!
                    .providerTransactionId;

                currentPayment
                  .accountingPolicy =
                  "seller_pays_provider_fee";

                currentPayment
                  .accountingVerifiedAt =
                  now;

                currentPayment
                  .set(
                    "metadata.phase60AccountingBackfilledAt",
                    now,
                  );

                await currentPayment
                  .save({
                    session,
                  });

                updatedPayment =
                  true;
              }

              const currentSale =
                await SellerLedgerEntry
                  .findOne({
                    sourceKey:
                      `sale:${payment.orderId}`,
                  })
                  .session(
                    session,
                  );

              if (currentSale) {
                validateLedgerIdentity(
                  currentSale,
                  currentPayment,
                );

                const delta =
                  accounting!
                    .sellerNetSatang -
                  currentSale
                    .amountSatang;

                if (
                  delta !==
                  0
                ) {
                  const before =
                    await SellerLedgerEntry
                      .findOne({
                        sourceKey:
                          `accounting-adjustment:sale:${payment.orderId}`,
                      })
                      .session(
                        session,
                      );

                  await sellerLedgerService
                    .appendAccountingAdjustment(
                      {
                        sourceKey:
                          `accounting-adjustment:sale:${payment.orderId}`,

                        sellerId:
                          payment.sellerId,

                        shopId:
                          payment.shopId,

                        orderId:
                          payment.orderId,

                        amountSatang:
                          delta,

                        metadata: {
                          paymentId:
                            payment.paymentId,

                          adjustmentFor:
                            "sale_credit",

                          originalAmountSatang:
                            currentSale
                              .amountSatang,

                          targetAmountSatang:
                            accounting!
                              .sellerNetSatang,

                          providerTransactionId:
                            accounting!
                              .providerTransactionId,
                        },
                      },

                      session,
                    );

                  if (!before) {
                    saleAdjustmentCreated =
                      true;
                  }
                }
              }

              const currentRefund =
                await SellerLedgerEntry
                  .findOne({
                    orderId:
                      payment.orderId,

                    type:
                      "refund_debit",
                  })
                  .session(
                    session,
                  );

              if (currentRefund) {
                validateLedgerIdentity(
                  currentRefund,
                  currentPayment,
                );

                const target =
                  -accounting!
                    .sellerNetSatang;

                const delta =
                  target -
                  currentRefund
                    .amountSatang;

                if (
                  delta !==
                  0
                ) {
                  const sourceKey =
                    `accounting-adjustment:refund:${currentRefund.refundId ?? payment.orderId}`;

                  const before =
                    await SellerLedgerEntry
                      .findOne({
                        sourceKey,
                      })
                      .session(
                        session,
                      );

                  await sellerLedgerService
                    .appendAccountingAdjustment(
                      {
                        sourceKey,

                        sellerId:
                          payment.sellerId,

                        shopId:
                          payment.shopId,

                        orderId:
                          payment.orderId,

                        amountSatang:
                          delta,

                        metadata: {
                          paymentId:
                            payment.paymentId,

                          refundId:
                            currentRefund
                              .refundId ??
                            null,

                          adjustmentFor:
                            "refund_debit",

                          originalAmountSatang:
                            currentRefund
                              .amountSatang,

                          targetAmountSatang:
                            target,

                          providerTransactionId:
                            accounting!
                              .providerTransactionId,
                        },
                      },

                      session,
                    );

                  if (!before) {
                    refundAdjustmentCreated =
                      true;
                  }
                }
              }
            },
          );
      } finally {
        await session
          .endSession();
      }

      if (
        updatedPayment
      ) {
        report
          .updatedPayments++;
      }

      if (
        saleAdjustmentCreated
      ) {
        report
          .saleAdjustmentsCreated++;
      }

      if (
        refundAdjustmentCreated
      ) {
        report
          .refundAdjustmentsCreated++;
      }
    } catch (error) {
      report.unresolved++;

      report.failures.push({
        paymentId:
          payment.paymentId,

        orderId:
          payment.orderId,

        reason:
          (
            error instanceof
              Error
              ? error.message
              : "Unknown migration error"
          ).slice(
            0,
            1000,
          ),
      });
    }
  }

  return report;
}
