import {
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { env } from "./config/env.js";

interface Command {
  data: {
    name: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
}

async function loadCommands(
  directory: string,
  commands: RESTPostAPIChatInputApplicationCommandsJSONBody[],
): Promise<void> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await loadCommands(fullPath, commands);
      continue;
    }

    if (!entry.name.endsWith(".js")) {
      continue;
    }

    const module = await import(pathToFileURL(fullPath).href);

    const command = (module.default ?? module) as Partial<Command>;

    if (
      !command.data ||
      typeof command.data.toJSON !== "function"
    ) {
      continue;
    }

    commands.push(command.data.toJSON());

    console.log(`  ✓ Found /${command.data.name}`);
  }
}

async function deployCommands(): Promise<void> {
  console.log("🚀 Deploying NEXORA slash commands...");

  const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
    [];

  const commandsPath = join(
    process.cwd(),
    "dist",
    "commands",
  );

  await loadCommands(commandsPath, commands);

  console.log(
    `📦 Preparing ${commands.length} command(s)...`,
  );

  const rest = new REST({ version: "10" }).setToken(
    env.DISCORD_TOKEN,
  );

  await rest.put(
    Routes.applicationGuildCommands(
      env.DISCORD_CLIENT_ID,
      env.DISCORD_GUILD_ID,
    ),
    {
      body: commands,
    },
  );

  console.log(
    `✅ Successfully deployed ${commands.length} command(s).`,
  );
}

deployCommands().catch((error) => {
  console.error("❌ Failed to deploy commands:", error);
  process.exit(1);
});