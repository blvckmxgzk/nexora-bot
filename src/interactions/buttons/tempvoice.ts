import {
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  temporaryVoiceService,
} from "../../services/voice/temporaryVoiceService.js";

import {
  temporaryVoicePanelService,
} from "../../services/voice/temporaryVoicePanelService.js";

import {
  buildTemporaryVoiceModal,
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
  ] =
    interaction.customId
      .split(
        ":",
      );

  if (
    namespace !==
      "tempvoice" ||
    !action
  ) {
    await interaction.reply({
      content:
        "❌ Temporary Voice action ไม่ถูกต้อง",

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  /*
   * Modal actions must acknowledge with showModal()
   * immediately. The owner's CURRENT room is resolved
   * again when the modal is submitted.
   */
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
      ),
    );

    return;
  }

  /*
   * User picker is also a new interaction.
   * The room is resolved when the user is selected.
   */
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
        MessageFlags.Ephemeral,

      components: [
        buildTemporaryVoiceUserPicker(
          action as
            TemporaryVoiceUserAction,
        ),
      ],
    });

    return;
  }

  /*
   * Direct actions ACK immediately, then resolve
   * whichever room the clicking user CURRENTLY owns.
   */
  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  try {
    if (!interaction.guild) {
      throw new Error(
        "ใช้ Temporary Voice ได้เฉพาะใน Server",
      );
    }

    const state =
      await temporaryVoiceService
        .getOwnedRoomState(
          interaction.guild,
          interaction.user.id,
        );

    if (!state) {
      const panel =
        await temporaryVoicePanelService
          .ensurePanel(
            interaction.guild,
          );

      await interaction.editReply({
        content: [
          "🔊 คุณยังไม่มี Temporary Voice Room",
          "",
          `เข้า <#${panel.hub.id}> เพื่อสร้างห้องก่อน`,
        ].join(
          "\n",
        ),
      });

      return;
    }

    const channelId =
      state.channel.id;

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
          "🗑️ ลบ Temporary Voice Room ของคุณแล้ว",
      });

      return;
    }

    if (
      action ===
      "lock"
    ) {
      const result =
        await temporaryVoiceService
          .toggleLock(
            interaction.guild,
            interaction.user.id,
            channelId,
          );

      await interaction.editReply({
        content:
          result.room.locked
            ? `🔒 ล็อก <#${result.channel.id}> แล้ว`
            : `🔓 ปลดล็อก <#${result.channel.id}> แล้ว`,
      });

      return;
    }

    if (
      action ===
      "hide"
    ) {
      const result =
        await temporaryVoiceService
          .toggleHide(
            interaction.guild,
            interaction.user.id,
            channelId,
          );

      await interaction.editReply({
        content:
          result.room.hidden
            ? `🙈 ซ่อน <#${result.channel.id}> แล้ว`
            : `👁️ แสดง <#${result.channel.id}> แล้ว`,
      });

      return;
    }

    throw new Error(
      "ไม่รู้จัก Temporary Voice action นี้",
    );
  } catch (
    error
  ) {
    await interaction.editReply({
      content:
        `❌ ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
