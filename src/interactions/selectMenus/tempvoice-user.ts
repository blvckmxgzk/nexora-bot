import {
  MessageFlags,
  type UserSelectMenuInteraction,
} from "discord.js";

import {
  temporaryVoiceService,
} from "../../services/voice/temporaryVoiceService.js";

import {
  temporaryVoicePanelService,
} from "../../services/voice/temporaryVoicePanelService.js";

export const customId =
  "tempvoice-user:";

export async function execute(
  interaction:
    UserSelectMenuInteraction,
): Promise<void> {
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
        "tempvoice-user" ||
      !action
    ) {
      throw new Error(
        "Temporary Voice action ไม่ถูกต้อง",
      );
    }

    const userId =
      interaction.values[0];

    if (!userId) {
      throw new Error(
        "กรุณาเลือกสมาชิก",
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
        content:
          `❌ คุณยังไม่มีห้อง กรุณาเข้า <#${panel.hub.id}> ก่อน`,
      });

      return;
    }

    const channelId =
      state.channel.id;

    if (
      action ===
      "allow"
    ) {
      await temporaryVoiceService
        .allowUser(
          interaction.guild,
          interaction.user.id,
          channelId,
          userId,
        );

      await interaction.editReply({
        content:
          `✅ อนุญาต <@${userId}> ให้เข้าห้อง <#${channelId}> แล้ว`,
      });

      return;
    }

    if (
      action ===
      "remove"
    ) {
      await temporaryVoiceService
        .removeAccess(
          interaction.guild,
          interaction.user.id,
          channelId,
          userId,
        );

      await interaction.editReply({
        content:
          `➖ ลบสิทธิ์พิเศษของ <@${userId}> แล้ว`,
      });

      return;
    }

    if (
      action ===
      "ban"
    ) {
      await temporaryVoiceService
        .banUser(
          interaction.guild,
          interaction.user.id,
          channelId,
          userId,
        );

      await interaction.editReply({
        content:
          `🚫 Ban <@${userId}> จาก <#${channelId}> แล้ว`,
      });

      return;
    }

    if (
      action ===
      "transfer"
    ) {
      await temporaryVoiceService
        .transferOwnership(
          interaction.guild,
          interaction.user.id,
          channelId,
          userId,
        );

      await interaction.editReply({
        content:
          `👑 โอน Ownership ของ <#${channelId}> ให้ <@${userId}> แล้ว`,
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
