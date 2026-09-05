import { Payment } from "../models/Payment.js";

import {
  paymentService,
} from "./paymentService.js";

export const paymentVerificationService = {
  async verify(
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
      return paymentService.expirePayment(
        paymentId,
      );
    }

    return paymentService.verifyPayment(
      paymentId,
    );
  },
};
