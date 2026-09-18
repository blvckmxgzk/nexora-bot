import {
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  puzzleService,
} from "../../services/puzzleService.js";

export const customId =
  "nexora_puzzle:";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ Puzzle Games ใช้ได้เฉพาะในเซิร์ฟเวอร์",

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
          await puzzleService
            .home(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "start":
        if (
          !value ||
          !puzzleService
            .isGame(
              value,
            )
        ) {
          throw new Error(
            "ประเภท Puzzle ไม่ถูกต้อง",
          );
        }

        payload =
          await puzzleService
            .start(
              interaction.guildId,
              interaction.user.id,
              value,
            );

        break;

      case "resume":
        payload =
          await puzzleService
            .resume(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "answer": {
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
            "คำตอบไม่ถูกต้อง",
          );
        }

        payload =
          await puzzleService
            .answer(
              interaction.guildId,
              interaction.user.id,
              index,
            );

        break;
      }

      case "hint":
        payload =
          await puzzleService
            .hint(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "end":
        payload =
          await puzzleService
            .end(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "stats":
        payload =
          await puzzleService
            .stats(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      default:
        throw new Error(
          "ไม่รู้จัก Puzzle action นี้",
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
