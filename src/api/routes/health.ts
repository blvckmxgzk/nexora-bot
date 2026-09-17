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
     * Liveness confirms that the API process
     * is running and able to respond.
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
     * Readiness reflects infrastructure
     * required by the active NEXORA runtime.
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
