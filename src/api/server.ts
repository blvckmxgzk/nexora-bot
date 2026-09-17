import Fastify from "fastify";

import {
  healthRoute,
} from "./routes/health.js";

const MAX_BODY_BYTES =
  256 *
  1024;

export async function createApiServer() {
  const app =
    Fastify({
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

      return payload;
    },
  );

  app.get(
    "/",
    async () => ({
      name:
        "NEXORA API",

      version:
        "2.0.0",

      status:
        "online",

      marketplace:
        "trade-handoff",
    }),
  );

  await app.register(
    healthRoute,
    {
      prefix:
        "/api/v1",
    },
  );

  /*
   * Marketplace v2 intentionally exposes
   * no payment / payout / refund webhook.
   *
   * Buyer and Seller transact directly.
   */
  app.setNotFoundHandler(
    async (
      _request,
      reply,
    ) =>
      reply
        .code(
          404,
        )
        .send({
          success:
            false,

          error:
            "Not found",
        }),
  );

  return app;
}
