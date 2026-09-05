import { Payment } from "../models/Payment.js";
import { Order } from "../models/Order.js";
import { Shop } from "../models/Shop.js";

import {
  paymentAccountService,
} from "./paymentAccountService.js";

import {
  paymentProviderRegistry,
} from "./payment/paymentProviderRegistry.js";

import type {
  PaymentProviderName,
} from "./payment/paymentProvider.js";

export const paymentService = {
  async getByPaymentId(
    paymentId: string,
  ) {
    return Payment.findOne({
      paymentId,
    });
  },

  async findByProviderPaymentId(
    providerPaymentId: string,
  ) {
    return Payment.findOne({
      providerPaymentId,
    });
  },

  async getByOrderId(
    orderId: string,
  ) {
    return Payment.findOne({
      orderId,
    });
  },

  async createPayment(data: {
    orderId: string;
    buyerId: string;
    provider:
      | "promptpay"
      | "truemoney";
  }) {
    const order =
      await Order.findOne({
        orderId: data.orderId,
      });

    if (!order) {
      throw new Error(
        "ไม่พบคำสั่งซื้อ",
      );
    }

    if (
      order.buyerId !==
      data.buyerId
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ชำระคำสั่งซื้อนี้",
      );
    }

    if (
      order.status !==
      "pending"
    ) {
      const existing =
        await Payment.findOne({
          orderId:
            data.orderId,
          status: "pending",
        });

      if (existing) {
        return existing;
      }

      throw new Error(
        "คำสั่งซื้อนี้ไม่พร้อมสำหรับการชำระเงิน",
      );
    }

    const shop =
      await Shop.findOne({
        shopId: order.shopId,
      });

    if (!shop) {
      throw new Error(
        "ไม่พบร้านค้า",
      );
    }

    if (
      shop.status !==
      "verified"
    ) {
      throw new Error(
        "ร้านค้านี้ยังไม่พร้อมรับคำสั่งซื้อ",
      );
    }

    const paymentTarget =
      await paymentAccountService
        .getPaymentTarget(
          shop.shopId,
          data.provider,
        );

    if (!paymentTarget) {
      throw new Error(
        "ร้านค้ายังไม่ได้ตั้งค่าบัญชีรับเงินสำหรับช่องทางนี้",
      );
    }

    const provider =
      paymentProviderRegistry.get(
        data.provider,
      );

    const paymentId =
      `PAY-${Date.now()}-` +
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    const expiresAt =
      new Date(
        Date.now() +
          15 * 60 * 1000,
      );

    const providerPayment =
      await provider.createPayment({
        paymentId,
        orderId:
          order.orderId,
        amount:
          order.totalAmount,
        account:
          paymentTarget.account,
        provider:
          data.provider,
        expiresAt,
      });

    try {
      const payment =
        new Payment({
          paymentId,
          orderId:
            order.orderId,
          buyerId:
            order.buyerId,
          sellerId:
            order.sellerId,
          shopId:
            order.shopId,
          provider:
            data.provider,
          amount:
            order.totalAmount,
          status: "pending",
          providerPaymentId:
            providerPayment.providerPaymentId,
          expiresAt,
          metadata: {
            paymentReference:
              providerPayment.paymentReference,
            paymentUrl:
              providerPayment.paymentUrl ??
              null,
            qrData:
              providerPayment.qrData ??
              null,
            instructions:
              providerPayment.instructions ??
              null,
            account:
              paymentTarget.account,
            displayName:
              paymentTarget.displayName ??
              null,
          },
        });

      await payment.save();

      const updatedOrder =
        await Order.findOneAndUpdate(
          {
            orderId:
              order.orderId,
            status: "pending",
          },
          {
            $set: {
              status:
                "awaiting_payment",
              paymentMethod:
                data.provider,
              paymentId:
                payment.paymentId,
              paymentExpiresAt:
                payment.expiresAt,
            },
          },
          {
            returnDocument:
              "after",
          },
        );

      if (!updatedOrder) {
        await Payment.deleteOne({
          paymentId:
            payment.paymentId,
        });

        throw new Error(
          "คำสั่งซื้อถูกเปลี่ยนสถานะก่อนสร้าง Payment เสร็จ",
        );
      }

      return payment;
    } catch (error: any) {
      if (
        error?.code === 11000
      ) {
        const existing =
          await Payment.findOne({
            orderId:
              order.orderId,
            status: "pending",
          });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  },

  async cancelPayment(
    paymentId: string,
  ) {
    const payment =
      await Payment.findOneAndUpdate(
        {
          paymentId,
          status: "pending",
        },
        {
          $set: {
            status: "cancelled",
          },
        },
        {
          returnDocument:
            "after",
        },
      );

    if (!payment) {
      const existing =
        await Payment.findOne({
          paymentId,
        });

      if (!existing) {
        throw new Error(
          "ไม่พบ Payment",
        );
      }

      return existing;
    }

    return payment;
  },

  async markPaid(
    paymentId: string,
    providerPaymentId: string,
  ) {
    const payment =
      await Payment.findOne({
        paymentId,
      });

    if (!payment) {
      throw new Error(
        "ไม่พบ Payment",
      );
    }

    if (
      payment.status ===
      "paid"
    ) {
      return payment;
    }

    if (
      payment.status !==
      "pending"
    ) {
      throw new Error(
        "Payment นี้ไม่สามารถเปลี่ยนเป็นชำระเงินแล้วได้",
      );
    }

    if (
      payment.expiresAt <=
      new Date()
    ) {
      await this.expirePayment(
        paymentId,
      );

      throw new Error(
        "Payment นี้หมดอายุแล้ว",
      );
    }

    const updated =
      await Payment.findOneAndUpdate(
        {
          paymentId,
          status: "pending",
          expiresAt: {
            $gt: new Date(),
          },
        },
        {
          $set: {
            status: "paid",
            providerPaymentId,
            paidAt: new Date(),
          },
        },
        {
          returnDocument:
            "after",
        },
      );

    if (!updated) {
      const current =
        await Payment.findOne({
          paymentId,
        });

      if (
        current?.status ===
        "paid"
      ) {
        return current;
      }

      throw new Error(
        "Payment ถูกเปลี่ยนสถานะก่อนยืนยันการชำระเงิน",
      );
    }

    await Order.findOneAndUpdate(
      {
        orderId:
          updated.orderId,
        status:
          "awaiting_payment",
        paymentId:
          updated.paymentId,
      },
      {
        $set: {
          status: "paid",
          paidAt:
            updated.paidAt ??
            new Date(),
        },
      },
      {
        returnDocument:
          "after",
      },
    );

    return updated;
  },

  async expirePayment(
    paymentId: string,
  ) {
    const payment =
      await Payment.findOneAndUpdate(
        {
          paymentId,
          status: "pending",
          expiresAt: {
            $lte: new Date(),
          },
        },
        {
          $set: {
            status: "expired",
          },
        },
        {
          returnDocument:
            "after",
        },
      );

    if (!payment) {
      return Payment.findOne({
        paymentId,
      });
    }

    const { orderService } =
      await import(
        "./orderService.js"
      );

    await orderService.expireOrder(
      payment.orderId,
    );

    return payment;
  },

  async verifyPayment(
    paymentId: string,
  ) {
    const payment =
      await Payment.findOne({
        paymentId,
      });

    if (!payment) {
      throw new Error(
        "ไม่พบ Payment",
      );
    }

    if (
      payment.status !==
      "pending"
    ) {
      return payment;
    }

    if (
      payment.expiresAt <=
      new Date()
    ) {
      return this.expirePayment(
        paymentId,
      );
    }

    if (
      !payment.providerPaymentId
    ) {
      throw new Error(
        "Payment ยังไม่มี Provider Payment ID",
      );
    }

    const provider =
      paymentProviderRegistry.get(
        payment.provider,
      );

    const result =
      await provider.verifyPayment(
        payment.providerPaymentId,
      );

    if (!result.paid) {
      return payment;
    }

    if (
      result.amount == null ||
      Math.abs(
        result.amount -
          payment.amount,
      ) > 0.001
    ) {
      throw new Error(
        "ยอดเงินจาก Payment Provider ไม่ตรงกับยอดคำสั่งซื้อ",
      );
    }

    if (
      result.currency !==
      "THB"
    ) {
      throw new Error(
        "สกุลเงินของ Payment Provider ไม่ถูกต้อง",
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

    return this.markPaid(
      payment.paymentId,
      result.providerPaymentId,
    );
  },
};
