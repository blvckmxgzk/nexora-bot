import type {
  FastifyPluginAsync,
} from "fastify";

import {
  paymentService,
} from "../../services/paymentService.js";

interface PaymentParams {
  paymentId: string;
}

export const paymentRoutes:
  FastifyPluginAsync =
  async (app) => {
    app.get<{
      Params: PaymentParams;
    }>(
      "/payments/:paymentId",
      async (
        request,
        reply,
      ) => {
        const payment =
          await paymentService
            .getByPaymentId(
              request.params
                .paymentId,
            );

        if (!payment) {
          return reply
            .code(404)
            .send({
              success: false,
              error:
                "Payment not found",
            });
        }

        return {
          success: true,
          data: payment,
        };
      },
    );

    app.post<{
      Params: PaymentParams;
    }>(
      "/payments/:paymentId/verify",
      async (
        request,
        reply,
      ) => {
        try {
          const payment =
            await paymentService
              .verifyPayment(
                request.params
                  .paymentId,
              );

          return {
            success: true,
            data: payment,
          };
        } catch (error) {
          return reply
            .code(400)
            .send({
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Payment verification failed",
            });
        }
      },
    );
  };
