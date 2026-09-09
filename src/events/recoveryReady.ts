import {
  Events,
  type Client,
} from "discord.js";

import {
  recoveryService,
} from "../services/community/recoveryService.js";

export const name =
  Events.ClientReady;

export const once =
  true;

export async function execute(
  client:
    Client<true>,
): Promise<void> {
  recoveryService
    .startAutoSnapshots(
      client,
    );

  console.log(
    "💾 NEXORA Disaster Recovery scheduler started",
  );
}
