import {
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  cardGameService,
} from "../../services/cardGameService.js";

export const customId =
  "nexora_cards:";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ Card Games ใช้ได้เฉพาะในเซิร์ฟเวอร์",

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  const action =
    interaction.customId
      .slice(
        customId.length,
      );

  try {
    let payload:
      any;

    switch (
      action
    ) {
      case "home":
        payload =
          await cardGameService
            .home(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "resume":
        payload =
          await cardGameService
            .resume(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "blackjack_start":
        payload =
          await cardGameService
            .startBlackjack(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "blackjack_hit":
        payload =
          await cardGameService
            .blackjackHit(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "blackjack_stand":
        payload =
          await cardGameService
            .blackjackStand(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "highlow_start":
        payload =
          await cardGameService
            .startHighLow(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "highlow_higher":
        payload =
          await cardGameService
            .highLowGuess(
              interaction.guildId,
              interaction.user.id,
              "higher",
            );

        break;

      case "highlow_lower":
        payload =
          await cardGameService
            .highLowGuess(
              interaction.guildId,
              interaction.user.id,
              "lower",
            );

        break;

      case "stats":
        payload =
          await cardGameService
            .stats(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "end":
        payload =
          await cardGameService
            .endGame(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      default:
        throw new Error(
          "ไม่รู้จัก Card Game action นี้",
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
