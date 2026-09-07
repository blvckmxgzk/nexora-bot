import type {
  Client,
  Interaction,
} from "discord.js";

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { CommandHandler } from "./commandHandler.js";

import {
  marketplaceMaintenanceService,
} from "../services/community/marketplaceMaintenanceService.js";

export interface NEXORAInteraction {
  customId: string;

  execute: (
    interaction: Interaction,
  ) => void | Promise<void>;
}

export class InteractionHandler {
  private readonly buttons =
    new Map<string, NEXORAInteraction>();

  private readonly selectMenus =
    new Map<string, NEXORAInteraction>();

  private readonly modals =
    new Map<string, NEXORAInteraction>();

  public constructor(
    private readonly commandHandler: CommandHandler,
  ) {}

  public async loadInteractions(
    client: Client,
  ): Promise<void> {
    const interactionsPath = join(
      process.cwd(),
      "dist",
      "interactions",
    );

    await this.loadDirectory(
      join(interactionsPath, "buttons"),
      this.buttons,
      "button",
    );

    await this.loadDirectory(
      join(interactionsPath, "selectMenus"),
      this.selectMenus,
      "select menu",
    );

    await this.loadDirectory(
      join(interactionsPath, "modals"),
      this.modals,
      "modal",
    );

    console.log(
      `🔘 Loaded buttons: ${this.buttons.size}`,
    );

    console.log(
      `🔽 Loaded select menus: ${this.selectMenus.size}`,
    );

    console.log(
      `📝 Loaded modals: ${this.modals.size}`,
    );

    client.on(
      "interactionCreate",
      async (interaction) => {
        await this.handleInteraction(
          interaction,
        );
      },
    );
  }

  private async loadDirectory(
    directory: string,
    collection: Map<
      string,
      NEXORAInteraction
    >,
    type: string,
  ): Promise<void> {
    let entries;

    try {
      entries = await readdir(
        directory,
        {
          withFileTypes: true,
        },
      );
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(
        directory,
        entry.name,
      );

      if (entry.isDirectory()) {
        await this.loadDirectory(
          fullPath,
          collection,
          type,
        );

        continue;
      }

      if (!entry.name.endsWith(".js")) {
        continue;
      }

      try {
        const interactionModule =
          await import(fullPath);

        const interaction =
          interactionModule.default ??
          interactionModule;

        if (
          !interaction?.customId ||
          typeof interaction.execute !==
            "function"
        ) {
          console.warn(
            `⚠️ Skipping invalid ${type}: ${fullPath}`,
          );

          continue;
        }

        if (
          collection.has(
            interaction.customId,
          )
        ) {
          throw new Error(
            `Duplicate ${type} customId detected: ${interaction.customId}`,
          );
        }

        collection.set(
          interaction.customId,
          interaction,
        );

        console.log(
          `  ✓ Loaded ${type}: ${interaction.customId}`,
        );
      } catch (error) {
        console.error(
          `❌ Failed to load ${type}: ${fullPath}`,
          error,
        );
      }
    }
  }

  private findHandler(
    collection: Map<
      string,
      NEXORAInteraction
    >,
    customId: string,
  ):
    | NEXORAInteraction
    | undefined {
    const exact =
      collection.get(customId);

    if (exact) {
      return exact;
    }

    for (const [
      registeredId,
      handler,
    ] of collection) {
      if (
        registeredId.endsWith(":") &&
        customId.startsWith(
          registeredId,
        )
      ) {
        return handler;
      }
    }

    return undefined;
  }

  private async handleInteraction(
    interaction: Interaction,
  ): Promise<void> {
    try {
      if (
        (
          interaction.isButton() ||
          interaction.isAnySelectMenu() ||
          interaction.isModalSubmit()
        ) &&
        await marketplaceMaintenanceService
          .shouldBlockCustomId(
            interaction.customId,
          )
      ) {
        if (
          interaction.isRepliable()
        ) {
          const state =
            await marketplaceMaintenanceService
              .getState();

          await interaction.reply({
            content:
              marketplaceMaintenanceService
                .getMaintenanceMessage(
                  state.reason,
                ),

            ephemeral:
              true,
          });
        }

        return;
      }

      if (
        interaction.isChatInputCommand()
      ) {
        await this.commandHandler.execute(
          interaction,
        );

        return;
      }

      if (interaction.isButton()) {
        console.log(
          `🔘 Button clicked: ${interaction.customId}`,
        );

        const handler =
          this.findHandler(
            this.buttons,
            interaction.customId,
          );

        if (!handler) {
          console.warn(
            `⚠️ No button handler found for: ${interaction.customId}`,
          );

          if (
            !interaction.replied &&
            !interaction.deferred
          ) {
            await interaction.reply({
              content:
                "❌ ไม่พบระบบสำหรับปุ่มนี้",
              ephemeral: true,
            });
          }

          return;
        }

        console.log(
          `  ↳ Handler: ${handler.customId}`,
        );

        await handler.execute(
          interaction,
        );

        return;
      }

      if (
        interaction.isAnySelectMenu()
      ) {
        const handler =
          this.findHandler(
            this.selectMenus,
            interaction.customId,
          );

        if (!handler) {
          console.warn(
            `⚠️ No select menu handler found for: ${interaction.customId}`,
          );

          return;
        }

        await handler.execute(
          interaction,
        );

        return;
      }

      if (
        interaction.isModalSubmit()
      ) {
        const handler =
          this.findHandler(
            this.modals,
            interaction.customId,
          );

        if (!handler) {
          console.warn(
            `⚠️ No modal handler found for: ${interaction.customId}`,
          );

          return;
        }

        await handler.execute(
          interaction,
        );
      }
    } catch (error) {
      console.error(
        `❌ Interaction failed: ${interaction.id}`,
        error,
      );

      if (!interaction.isRepliable()) {
        return;
      }

      const response = {
        content:
          "❌ เกิดข้อผิดพลาดขณะประมวลผล",
        ephemeral: true,
      };

      try {
        if (
          interaction.replied ||
          interaction.deferred
        ) {
          await interaction.followUp(
            response,
          );
        } else {
          await interaction.reply(
            response,
          );
        }
      } catch (replyError) {
        console.error(
          "❌ Failed to send interaction error response:",
          replyError,
        );
      }
    }
  }
}
