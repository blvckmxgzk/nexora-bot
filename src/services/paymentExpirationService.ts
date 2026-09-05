import { Payment } from "../models/Payment.js";
import { orderService } from "./orderService.js";

export const paymentExpirationService = {
  async expirePayments(): Promise<number> {
    const now = new Date();

    const payments =
      await Payment.find({
        status: "pending",
        expiresAt: {
          $lte: now,
        },
      }).limit(100);

    let expiredCount = 0;

    for (const payment of payments) {
      try {
        const locked =
          await Payment.findOneAndUpdate(
            {
              _id: payment._id,
              status: "pending",
              expiresAt: {
                $lte: now,
              },
            },
            {
              $set: {
                status: "expired",
              },
            },
            {
              new: true,
            },
          );

        if (!locked) {
          continue;
        }

        await orderService.expireOrder(
          payment.orderId,
        );

        expiredCount++;
      } catch (error) {
        console.error(
          `❌ Failed to expire payment ${payment.paymentId}:`,
          error,
        );
      }
    }

    return expiredCount;
  },
};
