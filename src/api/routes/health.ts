import type { FastifyPluginAsync } from "fastify";

export const healthRoute:
  FastifyPluginAsync =
  async (app) => {
    app.get(
      "/health",
      async () => {
        return {
          success: true,
          service: "nexora-api",
          status: "healthy",
          timestamp:
            new Date().toISOString(),
        };
      },
    );
  };
