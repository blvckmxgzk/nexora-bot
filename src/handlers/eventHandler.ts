import type { Client } from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import {
  runtimeModuleRoot,
  runtimeModuleExtension,
} from "../utils/runtimeModuleLoader.js";


export interface NEXORAEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => void | Promise<void>;
}

export class EventHandler {
  public readonly events = new Map<string, NEXORAEvent>();

  public async loadEvents(client: Client): Promise<void> {
    const eventsPath = join(
      process.cwd(),
      runtimeModuleRoot,
      "events",
    );

    await this.loadDirectory(eventsPath, client);
  }

  private async loadDirectory(
    directory: string,
    client: Client,
  ): Promise<void> {
    const entries = await readdir(directory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await this.loadDirectory(fullPath, client);
        continue;
      }

      if (
        !entry.name.endsWith(
          runtimeModuleExtension,
        )
      ) {
        continue;
      }

      const eventModule = await import(fullPath);

      const event =
        eventModule.default ?? eventModule;

      if (
        !event?.name ||
        typeof event.execute !== "function"
      ) {
        console.warn(
          `⚠️ Skipping invalid event: ${fullPath}`,
        );

        continue;
      }

      if (this.events.has(event.name)) {
        throw new Error(
          `Duplicate event detected: ${event.name}`,
        );
      }

      this.events.set(event.name, event);

      const listener = (...args: any[]) => {
        void event.execute(...args);
      };

      if (event.once) {
        client.once(event.name, listener);
      } else {
        client.on(event.name, listener);
      }

      console.log(`  ✓ Loaded event: ${event.name}`);
    }
  }
}