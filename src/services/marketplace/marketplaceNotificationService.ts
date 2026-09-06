import type {
  Client,
} from "discord.js";

let discordClient:
  Client | null = null;

export function setMarketplaceDiscordClient(
  client: Client,
): void {
  discordClient =
    client;
}

export function getMarketplaceDiscordClient():
  Client {
  if (!discordClient) {
    throw new Error(
      "Marketplace Discord client has not been initialized",
    );
  }

  return discordClient;
}
