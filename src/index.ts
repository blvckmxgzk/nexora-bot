import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import { env } from "./config/env.js";

import {
  connectDatabase,
  disconnectDatabase,
} from "./database/connection.js";

import { CommandHandler } from "./handlers/commandHandler.js";
import { EventHandler } from "./handlers/eventHandler.js";
import { InteractionHandler } from "./handlers/interactionHandler.js";

import {
  paymentExpirationWorker,
} from "./services/paymentExpirationWorker.js";

import {
  createApiServer,
} from "./api/server.js";

import {
  setMarketplaceDiscordClient,
} from "./services/marketplace/marketplaceNotificationService.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.User,
  ],
});

const commandHandler =
  new CommandHandler();

const eventHandler =
  new EventHandler();

const interactionHandler =
  new InteractionHandler(
    commandHandler,
  );

async function bootstrap(): Promise<void> {
  console.log(
    "🚀 Starting NEXORA...",
  );

  await connectDatabase();

  await commandHandler.loadCommands();

  await eventHandler.loadEvents(
    client,
  );

  setMarketplaceDiscordClient(
    client,
  );

  await interactionHandler.loadInteractions(
    client,
  );

  paymentExpirationWorker.start();

  const apiServer =
    await createApiServer();

  const API_HOST =
    process.env.API_HOST ??
    "0.0.0.0";

  const API_PORT =
    Number(
      process.env.API_PORT ??
        3000,
    );

  await apiServer.listen({
    host: API_HOST,
    port: API_PORT,
  });

  console.log(
    `🌐 NEXORA API listening on ${API_HOST}:${API_PORT}`,
  );

  await client.login(
    env.DISCORD_TOKEN,
  );

  const shutdown =
    async (signal: string) => {
      console.log(
        `\n🛑 Received ${signal}`,
      );

      try {
        await apiServer.close();
      } catch (error) {
        console.error(
          "❌ Failed to close API server:",
          error,
        );
      }

      client.destroy();

      await disconnectDatabase();

      process.exit(0);
    };

  process.on(
    "SIGINT",
    () => {
      void shutdown("SIGINT");
    },
  );

  process.on(
    "SIGTERM",
    () => {
      void shutdown("SIGTERM");
    },
  );
}

bootstrap().catch(
  (error) => {
    console.error(
      "❌ Failed to start NEXORA:",
      error,
    );

    process.exit(1);
  },
);
