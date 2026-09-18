import {
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  miniGameService,
} from "../../services/miniGameService.js";

export const customId =
  "nexora_minigame:";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ Mini Games ใช้ได้เฉพาะในเซิร์ฟเวอร์",

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
          await miniGameService
            .home(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "start":
        if (
          !value ||
          !miniGameService
            .isGame(
              value,
            )
        ) {
          throw new Error(
            "Mini Game ไม่ถูกต้อง",
          );
        }

        payload =
          await miniGameService
            .start(
              interaction.guildId,
              interaction.user.id,
              value,
            );

        break;

      case "resume":
        payload =
          await miniGameService
            .resume(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "rps":
        if (
          !value ||
          !miniGameService
            .isRpsChoice(
              value,
            )
        ) {
          throw new Error(
            "ตัวเลือกเป่ายิ้งฉุบไม่ถูกต้อง",
          );
        }

        payload =
          await miniGameService
            .rps(
              interaction.guildId,
              interaction.user.id,
              value,
            );

        break;

      case "ttt": {
        const index =
          Number(
            value,
          );

        if (
          !Number.isInteger(
            index,
          )
        ) {
          throw new Error(
            "ตำแหน่ง Tic-Tac-Toe ไม่ถูกต้อง",
          );
        }

        payload =
          await miniGameService
            .ticTacToeMove(
              interaction.guildId,
              interaction.user.id,
              index,
            );

        break;
      }

      case "reaction": {
        const index =
          Number(
            value,
          );

        if (
          !Number.isInteger(
            index,
          )
        ) {
          throw new Error(
            "Reaction target ไม่ถูกต้อง",
          );
        }

        payload =
          await miniGameService
            .reaction(
              interaction.guildId,
              interaction.user.id,
              index,
            );

        break;
      }

      case "stats":
        payload =
          await miniGameService
            .stats(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "end":
        payload =
          await miniGameService
            .end(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      default:
        throw new Error(
          "ไม่รู้จัก Mini Game action นี้",
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
