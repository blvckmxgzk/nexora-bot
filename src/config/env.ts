import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),

  MONGODB_URI: z.string().min(1),

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

  NODE_ENV: z
    .enum([
      "development",
      "production",
      "test",
    ])
    .default("development"),
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
