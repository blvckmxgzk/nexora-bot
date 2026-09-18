import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  dungeonUiService,
} from "../services/dungeons/dungeonUiService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "dungeon",
    )
    .setDescription(
      "⚔️ เปิด NEXORA Dungeons Dashboard",
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  try {
    const payload =
      await dungeonUiService
        .home(
          interaction.user.id,
          interaction.user.displayName,
        );

    await interaction.editReply(
      payload,
    );
  } catch (error) {
    await interaction.editReply({
      content:
        `❌ ${
          error instanceof
            Error
            ? error.message
            : String(
                error,
              )
        }`,

      embeds:
        [],

      components:
        [],
    });
  }
}
