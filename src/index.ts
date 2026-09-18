import {
  Client,
  GatewayIntentBits,
  Partials,
} from "discord.js";

import {
  env,
} from "./config/env.js";

import {
  connectDatabase,
  disconnectDatabase,
} from "./database/connection.js";

import {
  CommandHandler,
} from "./handlers/commandHandler.js";

import {
  EventHandler,
} from "./handlers/eventHandler.js";

import {
  InteractionHandler,
} from "./handlers/interactionHandler.js";

import {
  createApiServer,
} from "./api/server.js";

import {
  memberLifecycleRuntime,
} from "./services/community/memberLifecycleRuntime.js";

import {
  nexoraChatbotRuntime,
} from "./services/chatbot/nexoraChatbotRuntime.js";

import {
  communityLoggingRuntime,
} from "./services/logging/communityLoggingRuntime.js";

import {
  temporaryVoiceRuntime,
} from "./services/voice/temporaryVoiceRuntime.js";

import {
  temporaryVoicePanelRuntime,
} from "./services/voice/temporaryVoicePanelRuntime.js";

import {
  marketplaceV2Runtime,
} from "./services/marketplace/marketplaceV2Runtime.js";

import {
  giveawayRuntime,
} from "./services/giveawayRuntime.js";

import {
  analyticsRuntime,
} from "./services/analyticsRuntime.js";

import {
  botPresenceRuntime,
} from "./services/botPresenceRuntime.js";

const client =
  new Client({
    intents: [
      GatewayIntentBits.Guilds,

      ...(
        process.env
          .NEXORA_GUILD_MEMBERS_INTENT ===
        "true"
          ? [
              GatewayIntentBits
                .GuildMembers,
            ]
          : []
      ),

      GatewayIntentBits
        .GuildVoiceStates,

      GatewayIntentBits
        .GuildMessages,

      ...(
        env
          .NEXORA_MESSAGE_CONTENT_INTENT
          ? [
              GatewayIntentBits
                .MessageContent,
            ]
          : []
      ),

      GatewayIntentBits
        .AutoModerationConfiguration,

      GatewayIntentBits
        .AutoModerationExecution,

      GatewayIntentBits
        .GuildModeration,
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

async function bootstrap():
  Promise<void> {
  console.log(
    "🚀 Starting NEXORA...",
  );

  /*
   * Marketplace v2 no longer runs:
   *
   * - payment financial safety gate
   * - seller financial state backfill
   * - payment expiration worker
   * - payout reconciliation
   * - dispute reconciliation
   * - financial notification worker
   * - marketplace financial ops monitor
   *
   * Marketplace v2 is:
   *
   * Shop → Product → Trade Request
   * → DM Handoff → Completion → Review
   */

  await connectDatabase();

  await commandHandler
    .loadCommands();

  await eventHandler
    .loadEvents(
      client,
    );

  await interactionHandler
    .loadInteractions(
      client,
    );

  /*
   * Register runtimes BEFORE login so their
   * ClientReady listeners cannot miss ready.
   */
  memberLifecycleRuntime
    .start(
      client,
    );

  nexoraChatbotRuntime
    .start(
      client,
    );

  communityLoggingRuntime
    .start(
      client,
    );

  temporaryVoiceRuntime
    .start(
      client,
    );

  temporaryVoicePanelRuntime
    .start(
      client,
    );

  marketplaceV2Runtime
    .start(
      client,
    );

  giveawayRuntime
    .start(
      client,
    );

  analyticsRuntime
    .start(
      client,
    );

  botPresenceRuntime
    .start(
      client,
    );

  const apiServer =
    await createApiServer();

  const API_HOST =
    env.API_HOST;

  const API_PORT =
    env.API_PORT;

  await apiServer.listen({
    host:
      API_HOST,

    port:
      API_PORT,
  });

  console.log(
    `🌐 NEXORA API listening on ${API_HOST}:${API_PORT}`,
  );

  console.log(
    "🛒 Marketplace v2 • Trade Handoff Mode",
  );

  await client.login(
    env.DISCORD_TOKEN,
  );

  let shuttingDown =
    false;

  const shutdown =
    async (
      signal:
        string,
    ): Promise<void> => {
      if (
        shuttingDown
      ) {
        return;
      }

      shuttingDown =
        true;

      console.log(
        `\n🛑 Received ${signal}`,
      );

      /*
       * Stop event-producing runtimes first.
       */
      botPresenceRuntime
        .stop();

      analyticsRuntime
        .stop();

      giveawayRuntime
        .stop();

      marketplaceV2Runtime
        .stop();

      temporaryVoicePanelRuntime
        .stop();

      temporaryVoiceRuntime
        .stop();

      communityLoggingRuntime
        .stop();

      nexoraChatbotRuntime
        .stop();

      memberLifecycleRuntime
        .stop();

      try {
        await apiServer
          .close();
      } catch (
        error
      ) {
        console.error(
          "❌ Failed to close API server:",
          error,
        );
      }

      client.destroy();

      await disconnectDatabase();

      process.exit(
        0,
      );
    };

  process.once(
    "SIGINT",
    () => {
      void shutdown(
        "SIGINT",
      );
    },
  );

  process.once(
    "SIGTERM",
    () => {
      void shutdown(
        "SIGTERM",
      );
    },
  );
}

bootstrap()
  .catch(
    (
      error,
    ) => {
      console.error(
        "❌ Failed to start NEXORA:",
        error,
      );

      process.exit(
        1,
      );
    },
  );
