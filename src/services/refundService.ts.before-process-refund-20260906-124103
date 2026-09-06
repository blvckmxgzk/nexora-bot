import crypto from "node:crypto";

import {
  Refund,
} from "../models/Refund.js";

import {
  Order,
} from "../models/Order.js";

import {
  Payment,
} from "../models/Payment.js";

import {
  omiseRefundProvider,
} from "./payment/providers/omiseRefundProvider.js";

function generateRefundId(): string {
  return `NXR-${crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

export const refundService = {
  async requestRefund(
    orderId: string,
    buyerId: string,
    reason: string,
  ) {
    const order =
      await Order.findOne({
        orderId,
      });

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
      });

    if (existing) {
      throw new Error(
        "คำสั่งซื้อนี้มีคำขอคืนเงินที่กำลังดำเนินการอยู่แล้ว",
      );
    }

    const payment =
      await Payment.findOne({
        paymentId:
          order.paymentId,
      });

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

    const refund =
      await Refund.create({
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

        reason,

        status:
          "requested",

        requestedBy:
          buyerId,
      });

    console.log(
      `💸 Refund requested: ${refund.refundId} → Order ${orderId}`,
    );

    return refund;
  },

  async approveRefund(
    refundId: string,
    approvedBy: string,
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

    if (
      refund.status !==
      "requested"
    ) {
      throw new Error(
        "คำขอคืนเงินนี้ไม่อยู่ในสถานะที่อนุมัติได้",
      );
    }

    refund.status =
      "approved";

    refund.approvedBy =
      approvedBy;

    refund.approvedAt =
      new Date();

    await refund.save();

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
    const refund =
      await Refund.findOne({
        refundId,
      });

    if (!refund) {
      throw new Error(
        "ไม่พบคำขอคืนเงิน",
      );
    }

    if (
      refund.status !==
      "requested"
    ) {
      throw new Error(
        "คำขอคืนเงินนี้ไม่สามารถปฏิเสธได้",
      );
    }

    refund.status =
      "rejected";

    refund.rejectedBy =
      rejectedBy;

    refund.rejectionReason =
      rejectionReason;

    await refund.save();

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

    if (
      refund.status !==
      "approved"
    ) {
      throw new Error(
        "Refund นี้ยังไม่ได้รับการอนุมัติ",
      );
    }

    refund.status =
      "processing";

    await refund.save();

    try {
      const result =
        await omiseRefundProvider
          .createRefund({
            providerPaymentId:
              refund.providerPaymentId,

            amount:
              refund.amount,

            orderId:
              refund.orderId,

            refundId:
              refund.refundId,
          });

      refund.providerRefundId =
        result.providerRefundId;

      refund.status =
        "completed";

      refund.completedAt =
        new Date();

      refund.error =
        null;

      await refund.save();

      const order =
        await Order.findOneAndUpdate(
          {
            orderId:
              refund.orderId,

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
            },
          },
          {
            returnDocument:
              "after",
          },
        );

      if (!order) {
        throw new Error(
          "คืนเงินสำเร็จ แต่ไม่สามารถเปลี่ยนสถานะ Order เป็น refunded ได้",
        );
      }

      await Payment.findOneAndUpdate(
        {
          paymentId:
            refund.paymentId,
        },
        {
          $set: {
            status:
              "refunded",
          },
        },
      );

      console.log(
        `💰 Refund completed: ${refund.refundId} → Order ${refund.orderId}`,
      );

      return refund;
    } catch (error) {
      refund.status =
        "failed";

      refund.failedAt =
        new Date();

      refund.error =
        error instanceof Error
          ? error.message
          : "Refund failed";

      await refund.save();

      throw error;
    }
  },
};
