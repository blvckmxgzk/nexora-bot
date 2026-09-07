import {
  Payment,
} from "../models/Payment.js";

import {
  paymentService,
} from "./paymentService.js";

export const paymentExpirationService = {
  async expirePayments(): Promise<number> {
    const payments =
      await Payment.find({
        status: "pending",

        expiresAt: {
          $lte: new Date(),
        },
      })
        .sort({
          expiresAt: 1,
        })
        .limit(100);

    let closedCount =
      0;

    for (
      const payment
      of payments
    ) {
      try {
        /*
         * ห้ามเปลี่ยน Payment เป็น expired
         * จาก local clock โดยตรง
         *
         * paymentService.verifyPayment()
         * ต้องตรวจ Provider ก่อน
         */
        const result =
          await paymentService.verifyPayment(
            payment.paymentId,
          );

        if (
          result.status ===
            "expired" ||
          result.status ===
            "failed"
        ) {
          closedCount++;
        }
      } catch (error) {
        console.error(
          `❌ Failed to verify expiring Payment ${payment.paymentId}:`,
          error,
        );
      }
    }

    return closedCount;
  },
};
