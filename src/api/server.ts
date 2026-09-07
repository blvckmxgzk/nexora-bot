import Fastify from "fastify";
import fastifyRawBody from "fastify-raw-body";

import { healthRoute } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";

export async function createApiServer() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(
    fastifyRawBody,
    {
      field: "rawBody",
      global: false,
      encoding: "utf8",
      runFirst: true,
      routes: [
        "/api/v1/webhooks/omise",
      ],
    },
  );

  app.get("/", async () => {
    return {
      name: "NEXORA API",
      version: "1.0.0",
      status: "online",
    };
  });

  await app.register(
    healthRoute,
    {
      prefix: "/api/v1",
    },
  );

  await app.register(
    webhookRoutes,
    {
      prefix: "/api/v1",
    },
  );

  app.setErrorHandler(
    async (error, request, reply) => {
      request.log.error(error);

      if (reply.sent) {
        return;
      }

      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof error.statusCode ===
          "number" &&
        error.statusCode >= 400
          ? error.statusCode
          : 500;

      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message ===
          "string"
          ? error.message
          : "Internal server error";

      await reply
        .code(statusCode)
        .send({
          success: false,
          error:
            statusCode === 500
              ? "Internal server error"
              : message,
        });
    },
  );

  return app;
}
