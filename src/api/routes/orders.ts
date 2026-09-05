import type {
  FastifyPluginAsync,
} from "fastify";

import { orderService } from "../../services/orderService.js";

interface OrderParams {
  orderId: string;
}

export const orderRoutes:
  FastifyPluginAsync =
  async (app) => {
    app.get<{
      Params: OrderParams;
    }>(
      "/orders/:orderId",
      async (request, reply) => {
        const order =
          await orderService.getByOrderId(
            request.params.orderId,
          );

        if (!order) {
          return reply
            .code(404)
            .send({
              success: false,
              error:
                "Order not found",
            });
        }

        return {
          success: true,
          data: order,
        };
      },
    );
  };
