import mongoose from "mongoose";

import type {
  FastifyPluginAsync,
} from "fastify";

export const healthRoute:
  FastifyPluginAsync =
  async (
    app,
  ) => {
    /*
     * Liveness:
     * process/API is running.
     */
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

    /*
     * Readiness:
     *
     * Marketplace v1 used to check:
     * Payment / Refund / Payout / Dispute /
     * Webhook and financial workers here.
     *
     * Marketplace v2 does not process real money,
     * so readiness now reflects infrastructure
     * required by the active application.
     */
    app.get(
      "/ready",
      async (
        _request,
        reply,
      ) => {
        const databaseReady =
          mongoose.connection
            .readyState ===
          1;

        const ready =
          databaseReady;

        return reply
          .code(
            ready
              ? 200
              : 503,
          )
          .send({
            success:
              ready,

            service:
              "nexora-api",

            status:
              ready
                ? "ready"
                : "not_ready",

            database:
              databaseReady
                ? "connected"
                : "disconnected",

            marketplace:
              "trade-handoff",

            timestamp:
              new Date()
                .toISOString(),
          });
      },
    );
  };
