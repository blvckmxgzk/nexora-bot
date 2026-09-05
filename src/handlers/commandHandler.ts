import {
  Collection,
  type ChatInputCommandInteraction,
  type SlashCommandBuilder,
} from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export interface Command {
  data: SlashCommandBuilder;

  execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void>;
}

export class CommandHandler {
  public readonly commands = new Collection<string, Command>();

  public async loadCommands(): Promise<void> {
    const commandsPath = join(
      process.cwd(),
      "dist",
      "commands",
    );

    await this.loadDirectory(commandsPath);
  }

  private async loadDirectory(directory: string): Promise<void> {
    const entries = await readdir(directory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await this.loadDirectory(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".js")) {
        continue;
      }

      const commandModule = await import(fullPath);

      const command =
        commandModule.default ?? commandModule;

      if (
        !command?.data ||
        typeof command.execute !== "function"
      ) {
        console.warn(
          `⚠️ Skipping invalid command: ${fullPath}`,
        );

        continue;
      }

      const name = command.data.name;

      if (this.commands.has(name)) {
        throw new Error(
          `Duplicate command detected: ${name}`,
        );
      }

      this.commands.set(name, command);

      console.log(`  ✓ Loaded /${name}`);
    }
  }

  public async execute(
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const command = this.commands.get(
      interaction.commandName,
    );

    if (!command) {
      await interaction.reply({
        content: "❌ Unknown command.",
        ephemeral: true,
      });

      return;
    }

    await command.execute(interaction);
  }
}