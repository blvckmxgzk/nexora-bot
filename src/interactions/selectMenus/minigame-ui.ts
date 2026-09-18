import {
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";

import {
  miniGameService,
} from "../../services/miniGameService.js";

export const customId =
  "nexora_minigame:";

export async function execute(
  interaction:
    StringSelectMenuInteraction,
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

  try {
    const action =
      interaction.customId
        .slice(
          customId.length,
        );

    if (
      action !==
      "guess_select"
    ) {
      throw new Error(
        "ไม่รู้จัก Mini Game Select Menu",
      );
    }

    const value =
      Number(
        interaction.values[
          0
        ],
      );

    if (
      !Number.isInteger(
        value,
      ) ||
      value <
        1 ||
      value >
        20
    ) {
      throw new Error(
        "เลขที่เลือกไม่ถูกต้อง",
      );
    }

    const payload =
      await miniGameService
        .guess(
          interaction.guildId,
          interaction.user.id,
          value,
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
