import {
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  temporaryVoiceService,
} from "../../services/voice/temporaryVoiceService.js";

import {
  buildTemporaryVoiceModal,
  buildTemporaryVoicePanel,
  buildTemporaryVoicePanelEmbed,
  buildTemporaryVoiceUserPicker,
  type TemporaryVoiceModalAction,
  type TemporaryVoiceUserAction,
} from "../../services/voice/temporaryVoiceUi.js";

export const customId =
  "tempvoice:";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  const [
    namespace,
    action,
    channelId,
  ] =
    interaction.customId
      .split(
        ":",
      );

  if (
    namespace !==
      "tempvoice" ||
    !action ||
    !channelId
  ) {
    await interaction.reply({
      content:
        "❌ Temporary Voice action ไม่ถูกต้อง",

      flags:
        MessageFlags
          .Ephemeral,
    });

    return;
  }

  if (
    action ===
      "rename" ||
    action ===
      "limit" ||
    action ===
      "bitrate"
  ) {
    await interaction.showModal(
      buildTemporaryVoiceModal(
        action as
          TemporaryVoiceModalAction,
        channelId,
      ),
    );

    return;
  }

  if (
    action ===
      "allow" ||
    action ===
      "remove" ||
    action ===
      "ban" ||
    action ===
      "transfer"
  ) {
    await interaction.reply({
      content:
        "เลือกสมาชิก 1 คน:",

      flags:
        MessageFlags
          .Ephemeral,

      components: [
        buildTemporaryVoiceUserPicker(
          action as
            TemporaryVoiceUserAction,
          channelId,
        ),
      ],
    });

    return;
  }

  await interaction.deferUpdate();

  try {
    if (
      !interaction.guild
    ) {
      throw new Error(
        "ใช้ Temporary Voice ได้เฉพาะใน Server",
      );
    }

    if (
      action ===
      "delete"
    ) {
      await temporaryVoiceService
        .deleteOwnedRoom(
          interaction.guild,
          interaction.user.id,
          channelId,
        );

      await interaction.editReply({
        content:
          "🗑️ ลบ Temporary Voice Room แล้ว",

        embeds:
          [],

        components:
          [],
      });

      return;
    }

    const result =
      action ===
        "lock"
        ? await temporaryVoiceService
            .toggleLock(
              interaction.guild,
              interaction.user.id,
              channelId,
            )
        : action ===
            "hide"
          ? await temporaryVoiceService
              .toggleHide(
                interaction.guild,
                interaction.user.id,
                channelId,
              )
          : null;

    if (!result) {
      throw new Error(
        "ไม่รู้จัก Temporary Voice action นี้",
      );
    }

    await interaction.editReply({
      embeds: [
        buildTemporaryVoicePanelEmbed(
          result.room as any,
          result.channel,
        ),
      ],

      components:
        buildTemporaryVoicePanel(
          result.room as any,
        ),
    });
  } catch (
    error
  ) {
    await interaction.followUp({
      content:
        `❌ ${error instanceof Error ? error.message : String(error)}`,

      flags:
        MessageFlags
          .Ephemeral,
    });
  }
}
