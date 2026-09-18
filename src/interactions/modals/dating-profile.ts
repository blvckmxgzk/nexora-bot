import {
  MessageFlags,
  type ModalSubmitInteraction,
} from "discord.js";

import {
  datingService,
} from "../../services/datingService.js";

export const customId =
  "nexora_dating:profile_modal";

export async function execute(
  interaction:
    ModalSubmitInteraction,
): Promise<void> {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ ระบบหาคู่ใช้ได้เฉพาะในเซิร์ฟเวอร์",

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
    const displayName =
      interaction.user
        .globalName ??
      interaction.user
        .username;

    await datingService
      .saveProfile(
        interaction.guildId,
        interaction.user.id,
        displayName,
        {
          ageGroup:
            interaction.fields
              .getTextInputValue(
                "age_group",
              ),

          gender:
            interaction.fields
              .getTextInputValue(
                "gender",
              ),

          lookingFor:
            interaction.fields
              .getTextInputValue(
                "looking_for",
              ),

          interests:
            interaction.fields
              .getTextInputValue(
                "interests",
              ),

          bio:
            interaction.fields
              .getTextInputValue(
                "bio",
              ),
        },
      );

    /*
     * V2 FIX:
     * datingService.home accepts the optional third
     * argument as a notice shown above the dashboard.
     */
    const payload =
      await datingService
        .home(
          interaction.guildId,
          interaction.user.id,
          "✅ บันทึก Dating Profile แล้ว",
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
