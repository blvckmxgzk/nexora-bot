import crypto from "node:crypto";
import mongoose from "mongoose";

import { Refund } from "../models/Refund.js";
import { Order } from "../models/Order.js";
import { Payment } from "../models/Payment.js";
import { omiseRefundProvider } from "./payment/providers/omiseRefundProvider.js";

function generateRefundId(): string {
  return `NXR-${crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

function validateRefundReason(reason: string): string {
  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    throw new Error(
      "กรุณาระบุเหตุผลในการคืนเงิน",
    );
  }

  if (trimmedReason.length > 1000) {
    throw new Error(
      "เหตุผลในการคืนเงินต้องไม่เกิน 1000 ตัวอักษร",
    );
  }

  return trimmedReason;
}

export const refundService = {
  async requestRefund(
    orderId: string,
    buyerId: string,
    reason: string,
  ) {
    const trimmedReason =
      validateRefundReason(reason);

    const session =
      await mongoose.startSession();

    let createdRefund: any = null;

    try {
      await session.withTransaction(
        async () => {
          const order =
            await Order.findOne({
              orderId,
            }).session(session);

          if (!order) {
            throw new Error(
              "ไม่พบคำสั่งซื้อ",
            );
          }

          if (
            order.buyerId !==
            buyerId
          ) {
            throw new Error(
              "คุณไม่มีสิทธิ์ขอคืนเงินสำหรับคำสั่งซื้อนี้",
            );
          }

          if (
            order.status !==
              "paid" &&
            order.status !==
              "processing" &&
            order.status !==
              "completed"
          ) {
            throw new Error(
              "คำสั่งซื้อนี้ไม่สามารถขอคืนเงินได้",
            );
          }

          /*
           * ป้องกันคำขอคืนเงินซ้ำ
           */
          const existing =
            await Refund.findOne({
              orderId,
              status: {
                $in: [
                  "requested",
                  "approved",
                  "processing",
                ],
              },
            }).session(session);

          if (existing) {
            throw new Error(
              "คำสั่งซื้อนี้มีคำขอคืนเงินที่กำลังดำเนินการอยู่แล้ว",
            );
          }

          if (!order.paymentId) {
            throw new Error(
              "คำสั่งซื้อนี้ยังไม่มี Payment",
            );
          }

          const payment =
            await Payment.findOne({
              paymentId:
                order.paymentId,
            }).session(session);

          if (!payment) {
            throw new Error(
              "ไม่พบข้อมูลการชำระเงิน",
            );
          }

          if (
            payment.status !==
            "paid"
          ) {
            throw new Error(
              "Payment ยังไม่ได้ชำระสำเร็จ",
            );
          }

          if (
            !payment.providerPaymentId
          ) {
            throw new Error(
              "Payment ไม่มี Provider Payment ID",
            );
          }

          if (
            !Number.isFinite(
              order.totalAmount,
            ) ||
            order.totalAmount < 0
          ) {
            throw new Error(
              "จำนวนเงินของ Order ไม่ถูกต้อง",
            );
          }

          const refund =
            new Refund({
              refundId:
                generateRefundId(),

              orderId:
                order.orderId,

              paymentId:
                payment.paymentId,

              shopId:
                order.shopId,

              buyerId,

              sellerId:
                order.sellerId,

              provider:
                "omise",

              providerPaymentId:
                payment.providerPaymentId,

              amount:
                order.totalAmount,

              currency:
                "THB",

              reason:
                trimmedReason,

              status:
                "requested",

              requestedBy:
                buyerId,
            });

          await refund.save({
            session,
          });

          createdRefund =
            refund;

          console.log(
            `💸 Refund requested: ${refund.refundId} → Order ${orderId}`,
          );
        },
      );

      if (!createdRefund) {
        throw new Error(
          "ไม่สามารถสร้างคำขอคืนเงินได้",
        );
      }

      return createdRefund;
    } finally {
      await session.endSession();
    }
  },

  async approveRefund(
    refundId: string,
    approvedBy: string,
  ) {
    if (!approvedBy.trim()) {
      throw new Error(
        "ไม่พบผู้อนุมัติ Refund",
      );
    }

    const refund =
      await Refund.findOneAndUpdate(
        {
          refundId,
          status:
            "requested",
        },
        {
          $set: {
            status:
              "approved",
            approvedBy:
              approvedBy.trim(),
            approvedAt:
              new Date(),
          },
        },
        {
          new: true,
        },
      );

    if (!refund) {
      const existing =
        await Refund.findOne({
          refundId,
        });

      if (!existing) {
        throw new Error(
          "ไม่พบคำขอคืนเงิน",
        );
      }

      throw new Error(
        "คำขอคืนเงินนี้ไม่อยู่ในสถานะที่อนุมัติได้",
      );
    }

    console.log(
      `✅ Refund approved: ${refund.refundId}`,
    );

    return refund;
  },

  async rejectRefund(
    refundId: string,
    rejectedBy: string,
    rejectionReason: string,
  ) {
    if (!rejectedBy.trim()) {
      throw new Error(
        "ไม่พบผู้ปฏิเสธ Refund",
      );
    }

    const trimmedReason =
      validateRefundReason(
        rejectionReason,
      );

    const refund =
      await Refund.findOneAndUpdate(
        {
          refundId,
          status:
            "requested",
        },
        {
          $set: {
            status:
              "rejected",
            rejectedBy:
              rejectedBy.trim(),
            rejectionReason:
              trimmedReason,
          },
        },
        {
          new: true,
        },
      );

    if (!refund) {
      const existing =
        await Refund.findOne({
          refundId,
        });

      if (!existing) {
        throw new Error(
          "ไม่พบคำขอคืนเงิน",
        );
      }

      throw new Error(
        "คำขอคืนเงินนี้ไม่สามารถปฏิเสธได้",
      );
    }

    console.log(
      `❌ Refund rejected: ${refund.refundId}`,
    );

    return refund;
  },

  async processRefund(
    refundId: string,
  ) {
    const refund =
      await Refund.findOne({
        refundId,
      });

    if (!refund) {
      throw new Error(
        "ไม่พบคำขอคืนเงิน",
      );
    }

    /*
     * Completed = idempotent success
     */
    if (
      refund.status ===
      "completed"
    ) {
      return refund;
    }

    /*
     * ป้องกัน concurrent process
     */
    if (
      refund.status ===
      "processing"
    ) {
      throw new Error(
        "Refund นี้กำลังถูกประมวลผลอยู่",
      );
    }

    if (
      refund.status !==
        "approved" &&
      refund.status !==
        "failed"
    ) {
      throw new Error(
        "Refund นี้ยังไม่พร้อมสำหรับการประมวลผล",
      );
    }

    if (
      !refund.providerPaymentId
    ) {
      throw new Error(
        "Refund ไม่มี Provider Payment ID",
      );
    }

    if (
      !Number.isFinite(
        refund.amount,
      ) ||
      refund.amount < 0
    ) {
      throw new Error(
        "จำนวนเงิน Refund ไม่ถูกต้อง",
      );
    }

    /*
     * ก่อนสร้าง Refund ใหม่:
     *
     * ตรวจสอบกับ Omise ก่อนว่า Refund
     * ของ NEXORA รายการนี้ถูกสร้างไปแล้วหรือไม่
     *
     * ป้องกัน:
     * - Omise สำเร็จ
     * - network response หาย
     * - NEXORA บันทึก failed
     * - worker retry
     * - เกิด Refund ซ้ำ
     */
    const existingProviderRefund =
      await omiseRefundProvider.findExistingRefund({
        providerPaymentId:
          refund.providerPaymentId,

        amount:
          refund.amount,

        orderId:
          refund.orderId,

        refundId:
          refund.refundId,
      });

    if (existingProviderRefund) {
      if (
        existingProviderRefund.currency
          .toUpperCase() !==
        refund.currency.toUpperCase()
      ) {
        throw new Error(
          "Currency ของ Refund จาก Provider ไม่ตรงกับ NEXORA",
        );
      }

      if (
        Math.abs(
          existingProviderRefund.amount -
            refund.amount,
        ) > 0.001
      ) {
        throw new Error(
          "จำนวนเงิน Refund จาก Provider ไม่ตรงกับ Order",
        );
      }

      if (
        existingProviderRefund.voided
      ) {
        throw new Error(
          "Refund ที่พบจาก Provider ถูกยกเลิก",
        );
      }

      refund.providerRefundId =
        existingProviderRefund.providerRefundId;

      refund.status =
        "completed";

      refund.completedAt =
        new Date();

      refund.failedAt =
        null;

      refund.error =
        null;

      await refund.save();

      /*
       * Provider Refund มีอยู่แล้ว
       * จึงต้อง reconcile Order + Payment
       * เช่นเดียวกับกรณีสร้างใหม่สำเร็จ
       */
      await reconcileRefundState(
        refund,
      );

      console.log(
        `🔄 Existing Omise refund reconciled: ${refund.refundId} → ${existingProviderRefund.providerRefundId}`,
      );

      return refund;
    }

    /*
     * Claim Refund atomically
     *
     * ทั้ง approved และ failed สามารถ retry ได้
     */
    const processingRefund =
      await Refund.findOneAndUpdate(
        {
          refundId,
          status: {
            $in: [
              "approved",
              "failed",
            ],
          },
        },
        {
          $set: {
            status:
              "processing",
            error: null,
          },
          $unset: {
            failedAt: 1,
          },
        },
        {
          new: true,
        },
      );

    if (!processingRefund) {
      const current =
        await Refund.findOne({
          refundId,
        });

      if (
        current?.status ===
        "completed"
      ) {
        return current;
      }

      if (
        current?.status ===
        "processing"
      ) {
        throw new Error(
          "Refund นี้กำลังถูกประมวลผลอยู่",
        );
      }

      throw new Error(
        "ไม่สามารถ claim Refund เพื่อประมวลผลได้",
      );
    }

    try {
      /*
       * IMPORTANT:
       *
       * Omise request อยู่นอก MongoDB transaction
       * เพราะเป็น external network operation
       */
      const result =
        await omiseRefundProvider
          .createRefund({
            providerPaymentId:
              processingRefund.providerPaymentId,

            amount:
              processingRefund.amount,

            orderId:
              processingRefund.orderId,

            refundId:
              processingRefund.refundId,
          });

      /*
       * Validate Provider response
       * ก่อนยืนยันว่า Refund สำเร็จ
       */
      if (
        !result.providerRefundId
      ) {
        throw new Error(
          "Omise ไม่ได้ส่ง Provider Refund ID กลับมา",
        );
      }

      if (
        result.currency.toUpperCase() !==
        processingRefund.currency.toUpperCase()
      ) {
        throw new Error(
          "Currency ของ Refund จาก Omise ไม่ตรงกับ NEXORA",
        );
      }

      if (
        Math.abs(
          result.amount -
            processingRefund.amount,
        ) > 0.001
      ) {
        throw new Error(
          "จำนวนเงิน Refund จาก Omise ไม่ตรงกับ Order",
        );
      }

      if (
        result.voided
      ) {
        throw new Error(
          "Refund จาก Omise ถูกยกเลิก",
        );
      }

      const providerStatus =
        result.status.toLowerCase();

      /*
       * Omise Refund ที่เพิ่งสร้างต้องไม่เป็น
       * สถานะที่ชัดเจนว่า failed/voided
       */
      if (
        providerStatus ===
          "failed" ||
        providerStatus ===
          "voided" ||
        providerStatus ===
          "cancelled"
      ) {
        throw new Error(
          `Omise Refund มีสถานะไม่สำเร็จ: ${result.status}`,
        );
      }

      /*
       * Provider สำเร็จแล้ว
       *
       * บันทึก providerRefundId ก่อน
       * เพื่อให้สามารถ reconcile ได้
       * หากขั้นตอนถัดไปเกิด partial failure
       */
      const completedRefund =
        await Refund.findOneAndUpdate(
          {
            refundId,
            status:
              "processing",
          },
          {
            $set: {
              providerRefundId:
                result.providerRefundId,

              status:
                "completed",

              completedAt:
                new Date(),

              failedAt:
                null,

              error:
                null,
            },
          },
          {
            new: true,
          },
        );

      if (!completedRefund) {
        throw new Error(
          "Omise refund สำเร็จ แต่ไม่สามารถบันทึก Refund ได้",
        );
      }

      /*
       * Reconcile Order + Payment
       *
       * ใช้ transaction เพื่อให้สถานะภายใน
       * ของ NEXORA เปลี่ยนไปพร้อมกัน
       */
      await reconcileRefundState(
        completedRefund,
      );

      console.log(
        `💰 Refund completed: ${completedRefund.refundId} → Order ${completedRefund.orderId}`,
      );

      return completedRefund;
    } catch (error) {
      /*
       * ถ้า provider request สำเร็จแล้วแต่
       * ขั้นตอน DB ภายหลังล้มเหลว:
       *
       * เราเก็บ failed เพื่อให้ retry
       * ผ่าน findExistingRefund() ก่อนยิง Omise
       * อีกครั้ง
       */
      const message =
        error instanceof Error
          ? error.message
          : "Refund failed";

      await Refund.updateOne(
        {
          refundId,
          status:
            "processing",
        },
        {
          $set: {
            status:
              "failed",
            failedAt:
              new Date(),
            error:
              message.slice(
                0,
                2000,
              ),
          },
        },
      );

      throw error;
    }
  },
};

async function reconcileRefundState(
  refund: any,
): Promise<void> {
  const session =
    await mongoose.startSession();

  try {
    await session.withTransaction(
      async () => {
        const currentRefund =
          await Refund.findOne({
            refundId:
              refund.refundId,
          }).session(session);

        if (!currentRefund) {
          throw new Error(
            "ไม่พบ Refund สำหรับ reconcile",
          );
        }

        if (
          currentRefund.status !==
          "completed"
        ) {
          throw new Error(
            "Refund ยังไม่อยู่ในสถานะ completed",
          );
        }

        const order =
          await Order.findOne({
            orderId:
              currentRefund.orderId,
          }).session(session);

        if (!order) {
          throw new Error(
            "ไม่พบ Order สำหรับ Refund",
          );
        }

        if (
          order.status !==
          "refunded"
        ) {
          if (
            order.status !==
              "paid" &&
            order.status !==
              "processing" &&
            order.status !==
              "completed"
          ) {
            throw new Error(
              `ไม่สามารถเปลี่ยน Order สถานะ ${order.status} เป็น refunded ได้`,
            );
          }

          const updatedOrder =
            await Order.findOneAndUpdate(
              {
                orderId:
                  currentRefund.orderId,
                status: {
                  $in: [
                    "paid",
                    "processing",
                    "completed",
                  ],
                },
              },
              {
                $set: {
                  status:
                    "refunded",
                  refundedAt:
                    new Date(),
                  refundReason:
                    currentRefund.reason,
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!updatedOrder) {
            const latestOrder =
              await Order.findOne({
                orderId:
                  currentRefund.orderId,
              }).session(session);

            if (
              latestOrder?.status !==
              "refunded"
            ) {
              throw new Error(
                "ไม่สามารถเปลี่ยน Order เป็น refunded ได้",
              );
            }
          }
        }

        const payment =
          await Payment.findOne({
            paymentId:
              currentRefund.paymentId,
          }).session(session);

        if (!payment) {
          throw new Error(
            "ไม่พบ Payment สำหรับ Refund",
          );
        }

        if (
          payment.status !==
            "paid" &&
          payment.status !==
            "refunded"
        ) {
          throw new Error(
            `ไม่สามารถเปลี่ยน Payment สถานะ ${payment.status} เป็น refunded ได้`,
          );
        }

        if (
          payment.status !==
          "refunded"
        ) {
          const updatedPayment =
            await Payment.findOneAndUpdate(
              {
                paymentId:
                  currentRefund.paymentId,
                status:
                  "paid",
              },
              {
                $set: {
                  status:
                    "refunded",
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!updatedPayment) {
            const latestPayment =
              await Payment.findOne({
                paymentId:
                  currentRefund.paymentId,
              }).session(session);

            if (
              latestPayment?.status !==
              "refunded"
            ) {
              throw new Error(
                "ไม่สามารถเปลี่ยน Payment เป็น refunded ได้",
              );
            }
          }
        }
      },
    );
  } finally {
    await session.endSession();
  }
}
