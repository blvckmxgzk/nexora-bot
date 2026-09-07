import Fastify from "fastify";
import fastifyRawBody from "fastify-raw-body";

import {
  healthRoute,
} from "./routes/health.js";

import {
  webhookRoutes,
} from "./routes/webhooks.js";

const MAX_BODY_BYTES =
  256 * 1024;

export async function createApiServer() {
  const app = Fastify({
    logger:
      true,

    trustProxy:
      true,

    bodyLimit:
      MAX_BODY_BYTES,

    connectionTimeout:
      10_000,

    requestTimeout:
      30_000,
  });

  await app.register(
    fastifyRawBody,
    {
      field:
        "rawBody",

      global:
        false,

      encoding:
        "utf8",

      runFirst:
        true,

      routes: [
        "/api/v1/webhooks/omise",
      ],
    },
  );

  app.addHook(
    "onSend",
    async (
      _request,
      reply,
      payload,
    ) => {
      reply.header(
        "X-Content-Type-Options",
        "nosniff",
      );

      reply.header(
        "X-Frame-Options",
        "DENY",
      );

      reply.header(
        "Referrer-Policy",
        "no-referrer",
      );

      reply.header(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );

      reply.header(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      );

      reply.header(
        "Cache-Control",
        "no-store",
      );

      if (
        process.env.NODE_ENV ===
        "production"
      ) {
        reply.header(
          "Strict-Transport-Security",
          "max-age=31536000; includeSubDomains",
        );
      }

      return payload;
    },
  );

  app.get(
    "/",
    async () => {
      return {
        name:
          "NEXORA API",

        version:
          "1.0.0",

        status:
          "online",
      };
    },
  );

  await app.register(
    healthRoute,
    {
      prefix:
        "/api/v1",
    },
  );

  /*
   * Public API เปิดเฉพาะ signed Provider webhook
   * และ health endpoints
   *
   * ห้าม register orderRoutes/paymentRoutes
   * โดยไม่มี authenticated ownership layer
   */
  await app.register(
    webhookRoutes,
    {
      prefix:
        "/api/v1",
    },
  );

  app.setNotFoundHandler(
    async (
      _request,
      reply,
    ) => {
      return reply
        .code(
          404,
        )
        .send({
          success:
            false,

          error:
            "Not found",
        });
    },
  );

  app.setErrorHandler(
    async (
      error,
      request,
      reply,
    ) => {
      request.log.error(
        error,
      );

      if (
        reply.sent
      ) {
        return;
      }

      const statusCode =
        typeof error ===
          "object" &&
        error !==
          null &&
        "statusCode" in
          error &&
        typeof error
          .statusCode ===
          "number" &&
        error.statusCode >=
          400
          ? error.statusCode
          : 500;

      const publicMessage =
        statusCode >=
        500
          ? "Internal server error"
          : (
              typeof error ===
                "object" &&
              error !==
                null &&
              "message" in
                error &&
              typeof error.message ===
                "string"
                ? error.message
                : "Request failed"
            );

      await reply
        .code(
          statusCode,
        )
        .send({
          success:
            false,

          error:
            publicMessage,
        });
    },
  );

  return app;
}
