import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN:
    z.string().min(1),

  DISCORD_CLIENT_ID:
    z.string().min(1),

  DISCORD_GUILD_ID:
    z.string().min(1),

  MONGODB_URI:
    z.string().min(1),

  MARKETPLACE_FORUM_CHANNEL_ID:
    z.string().min(1),

  MARKETPLACE_VERIFICATION_PANEL_CHANNEL_ID:
    z.string().min(1),

  MARKETPLACE_VERIFICATION_REVIEW_CHANNEL_ID:
    z.string().min(1),

  GENERAL_SELLER_ROLE_ID:
    z.string().min(1),

  VERIFIED_SELLER_ROLE_ID:
    z.string().min(1),

  /*
   * Optional ตอน unit/integration tests
   *
   * Production safety guard จะบังคับ
   * อีกชั้นใน bootstrap
   */
  OMISE_SECRET_KEY:
    z.string()
      .min(1)
      .optional(),

  OMISE_PUBLIC_KEY:
    z.string()
      .min(1)
      .optional(),

  OMISE_WEBHOOK_SECRET:
    z.string()
      .min(1)
      .optional(),

  NEXORA_PAYMENT_RETURN_URL:
    z.string()
      .url()
      .optional(),

  NEXORA_PUBLIC_API_URL:
    z.string()
      .url()
      .optional(),

  NEXORA_PAYMENT_METHODS:
    z.string()
      .min(1)
      .optional(),

  NEXORA_PAYMENT_APPROVED_CATEGORIES:
    z.string()
      .min(1)
      .optional(),

  API_HOST:
    z.string()
      .min(1)
      .default(
        "0.0.0.0",
      ),

  API_PORT:
    z.coerce
      .number()
      .int()
      .min(1)
      .max(65535)
      .default(3000),

  NODE_ENV:
    z.enum([
      "development",
      "production",
      "test",
    ])
      .default(
        "development",
      ),
});

const result =
  envSchema.safeParse(
    process.env,
  );

if (!result.success) {
  console.error(
    "❌ Invalid environment variables:",
  );

  console.error(
    result.error.format(),
  );

  process.exit(1);
}

export const env =
  result.data;
