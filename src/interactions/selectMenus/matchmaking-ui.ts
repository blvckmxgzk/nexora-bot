import {
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";

import {
  matchmakingService,
  type MatchmakingMode,
} from "../../services/matchmakingService.js";

export const customId =
  "nexora_matchmaking:";

export async function execute(
  interaction:
    StringSelectMenuInteraction,
): Promise<void> {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ Matchmaking ใช้ได้เฉพาะในเซิร์ฟเวอร์",

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  try {
    const action =
      interaction.customId
        .slice(
          customId.length,
        );

    const selected =
      interaction.values[0];

    if (
      action !==
      "join"
    ) {
      throw new Error(
        "ไม่รู้จัก Matchmaking select menu",
      );
    }

    if (
      !selected ||
      !matchmakingService
        .isMode(
          selected,
        )
    ) {
      throw new Error(
        "โหมด Matchmaking ไม่ถูกต้อง",
      );
    }

    await matchmakingService
      .joinQueue(
        interaction.guildId,
        interaction.user.id,
        selected as
          MatchmakingMode,
      );

    const mode =
      matchmakingService
        .modeData(
          selected as
            MatchmakingMode,
        );

    const payload =
      await matchmakingService
        .home(
          interaction.guildId,
          interaction.user.id,
          `${mode.emoji} เข้าคิว **${mode.name}** แล้ว`,
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
