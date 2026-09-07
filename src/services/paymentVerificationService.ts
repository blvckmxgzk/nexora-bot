import {
  paymentService,
} from "./paymentService.js";

export const paymentVerificationService = {
  async verify(
    paymentId: string,
  ) {
    return paymentService.verifyPayment(
      paymentId,
    );
  },
};
