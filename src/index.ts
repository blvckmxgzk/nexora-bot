import {
  Client,
  GatewayIntentBits,
  Partials
} from "discord.js";

import { env } from "./config/env.js";
import {
  connectDatabase,
  disconnectDatabase
} from "./database/connection.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User
  ]
});

client.once("clientReady", async (readyClient) => {
  console.log(
    `🤖 ${readyClient.user.tag} is online`
  );

  console.log(
    `🏠 Connected to ${readyClient.guilds.cache.size} guild(s)`
  );
});

async function bootstrap(): Promise<void> {
  console.log("🚀 Starting NEXORA...");

  await connectDatabase();

  await client.login(env.DISCORD_TOKEN);
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}`);

  client.destroy();

  await disconnectDatabase();

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

bootstrap().catch((error) => {
  console.error("❌ Failed to start NEXORA:", error);
  process.exit(1);
});