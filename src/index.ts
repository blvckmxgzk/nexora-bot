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
  payoutReconciliationWorker,
} from "./services/payoutReconciliationWorker.js";

import {
  disputeReconciliationWorker,
} from "./services/disputeReconciliationWorker.js";

import {
  marketplaceOpsMonitorWorker,
} from "./services/marketplace/marketplaceOpsMonitorWorker.js";

import {
  notificationDeliveryWorker,
} from "./services/marketplace/notificationDeliveryWorker.js";

import {
  assertMarketplaceFinancialRuntimeSafety,
} from "./services/marketplace/financialRuntimeSafety.js";

import {
  backfillSellerFinancialStates,
} from "./services/marketplace/sellerFinancialStateBackfillService.js";

import {
  createApiServer,
} from "./api/server.js";

import {
  setMarketplaceDiscordClient,
} from "./services/marketplace/marketplaceNotificationService.js";


import {
  setMinerDiscordClient,
} from "./services/nexo/minerRareDropNotificationService.js";

import {
  minerSettlementWorker,
} from "./services/nexo/minerSettlementWorker.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    ...(process.env.NEXORA_GUILD_MEMBERS_INTENT === "true"
      ? [GatewayIntentBits.GuildMembers]
      : []),
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
    GatewayIntentBits.GuildModeration,
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

  /*
   * Fail closed ก่อนเชื่อม DB/Discord
   * หาก production financial config
   * ไม่ปลอดภัย
   */
  assertMarketplaceFinancialRuntimeSafety();

  await connectDatabase();

  const financialBackfill =
    await backfillSellerFinancialStates();

  console.log(
    `🧾 SellerFinancialState backfill: scanned=${financialBackfill.scanned} created=${financialBackfill.created} existing=${financialBackfill.existing}`,
  );

  await commandHandler.loadCommands();

  await eventHandler.loadEvents(
    client,
  );

  setMarketplaceDiscordClient(
    client,
  );


  setMinerDiscordClient(
    client,
  );

  await interactionHandler.loadInteractions(
    client,
  );

  minerSettlementWorker.start();
  paymentExpirationWorker.start();
  payoutReconciliationWorker.start();
  disputeReconciliationWorker.start();
  notificationDeliveryWorker.start();
  marketplaceOpsMonitorWorker.start();

  const apiServer =
    await createApiServer();

  const API_HOST =
    env.API_HOST;

  const API_PORT =
    env.API_PORT;

  await apiServer.listen({
    host: API_HOST,
    port: API_PORT,
  });

  console.log(
    `🌐 NEXORA API listening on ${API_HOST}:${API_PORT}`,
  );

  if (
    env.NEXORA_PUBLIC_API_URL
  ) {
    const publicApi =
      env.NEXORA_PUBLIC_API_URL
        .replace(
          /\/$/,
          "",
        );

    console.log(
      `🔔 Omise webhook target: ${publicApi}/api/v1/webhooks/omise`,
    );
  }

  await client.login(
    env.DISCORD_TOKEN,
  );

  let shuttingDown =
    false;

  const shutdown =
    async (signal: string) => {
      if (shuttingDown) {
        return;
      }

      shuttingDown =
        true;

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

      minerSettlementWorker.stop();
      notificationDeliveryWorker.stop();
      marketplaceOpsMonitorWorker.stop();
      paymentExpirationWorker.stop();
      payoutReconciliationWorker.stop();
    disputeReconciliationWorker.stop();

      client.destroy();

      await disconnectDatabase();

      process.exit(0);
    };

  process.once(
    "SIGINT",
    () => {
      void shutdown("SIGINT");
    },
  );

  process.once(
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
