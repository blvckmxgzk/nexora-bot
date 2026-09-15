import type { Client } from "discord.js";

import { guildService } from "../services/guildService.js";

import {
  recoveryService,
} from "../services/community/recoveryService.js";

export const name = "clientReady";
export const once = true;

export async function execute(
  client: Client,
): Promise<void> {
  if (!client.user) {
    return;
  }

  console.log(
    `🤖 ${client.user.tag} is online`,
  );

  console.log(
    `🌐 Connected to ${client.guilds.cache.size} guild(s)`,
  );

  recoveryService.startAutoSnapshots(
    client,
  );

  console.log(
    "💾 NEXORA Disaster Recovery scheduler started",
  );

  for (const guild of client.guilds.cache.values()) {
    try {
      await guildService.createOrUpdate({
        discordId: guild.id,
        name: guild.name,
      });

      console.log(
        `  ✓ Synced guild: ${guild.name}`,
      );
    } catch (error) {
      console.error(
        `❌ Failed to sync guild ${guild.id}:`,
        error,
      );
    }
  }
}
