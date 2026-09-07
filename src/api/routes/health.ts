import type {
  FastifyPluginAsync,
} from "fastify";

import {
  marketplaceOpsHealthService,
} from "../../services/marketplace/marketplaceOpsHealthService.js";

export const healthRoute:
  FastifyPluginAsync =
  async (
    app,
  ) => {
    app.get(
      "/health",
      async () => {
        return {
          success:
            true,

          service:
            "nexora-api",

          status:
            "healthy",

          uptimeSeconds:
            Math.floor(
              process.uptime(),
            ),

          timestamp:
            new Date()
              .toISOString(),
        };
      },
    );

    app.get(
      "/ready",
      async (
        _request,
        reply,
      ) => {
        const readiness =
          await marketplaceOpsHealthService
            .getReadiness();

        /*
         * Public readiness ต้องไม่เผย:
         * - worker names
         * - failure counters
         * - last errors
         * - internal timestamps
         *
         * รายละเอียดเหล่านั้นดูผ่าน
         * Administrator /ops-status เท่านั้น
         */
        const workersHealthy =
          readiness.workers
            ?.healthy ===
          true;

        return reply
          .code(
            readiness.ready
              ? 200
              : 503,
          )
          .send({
            success:
              readiness.ready,

            service:
              "nexora-api",

            status:
              readiness.status,

            database:
              readiness.database,

            workersHealthy,

            timestamp:
              new Date()
                .toISOString(),
          });
      },
    );
  };
