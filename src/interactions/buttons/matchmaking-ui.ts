import {
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  matchmakingService,
  type MatchmakingAgeGroup,
} from "../../services/matchmakingService.js";

export const customId =
  "nexora_matchmaking:";

export async function execute(
  interaction:
    ButtonInteraction,
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

  const raw =
    interaction.customId
      .slice(
        customId.length,
      );

  const [
    action,
    value,
  ] =
    raw.split(
      ":",
    );

  try {
    let payload:
      any;

    switch (
      action
    ) {
      case "home":
        payload =
          await matchmakingService
            .home(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "age": {
        if (
          value !==
            "13-17" &&
          value !==
            "18+"
        ) {
          throw new Error(
            "กลุ่มอายุไม่ถูกต้อง",
          );
        }

        await matchmakingService
          .setAgeGroup(
            interaction.guildId,
            interaction.user.id,
            value as
              MatchmakingAgeGroup,
          );

        payload =
          await matchmakingService
            .home(
              interaction.guildId,
              interaction.user.id,
              `✅ ตั้งกลุ่มอายุเป็น **${value}** แล้ว`,
            );

        break;
      }

      case "leave":
        await matchmakingService
          .leaveQueue(
            interaction.guildId,
            interaction.user.id,
          );

        payload =
          await matchmakingService
            .home(
              interaction.guildId,
              interaction.user.id,
              "🚪 ออกจากคิวแล้ว",
            );

        break;

      case "end":
        await matchmakingService
          .endSession(
            interaction.guildId,
            interaction.user.id,
          );

        payload =
          await matchmakingService
            .home(
              interaction.guildId,
              interaction.user.id,
              "🛑 จบ Matchmaking Session แล้ว",
            );

        break;

      case "history":
        payload =
          await matchmakingService
            .history(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      default:
        throw new Error(
          "ไม่รู้จัก Matchmaking action นี้",
        );
    }

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
