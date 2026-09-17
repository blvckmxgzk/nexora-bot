import {
  MessageFlags,
  type UserSelectMenuInteraction,
} from "discord.js";

import {
  temporaryVoiceService,
} from "../../services/voice/temporaryVoiceService.js";

export const customId =
  "tempvoice-user:";

export async function execute(
  interaction:
    UserSelectMenuInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags:
      MessageFlags
        .Ephemeral,
  });

  try {
    if (
      !interaction.guild
    ) {
      throw new Error(
        "ใช้ Temporary Voice ได้เฉพาะใน Server",
      );
    }

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
        "tempvoice-user" ||
      !action ||
      !channelId
    ) {
      throw new Error(
        "Temporary Voice action ไม่ถูกต้อง",
      );
    }

    const userId =
      interaction.values[
        0
      ];

    if (!userId) {
      throw new Error(
        "กรุณาเลือกสมาชิก",
      );
    }

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
          `✅ อนุญาต <@${userId}> ให้เข้าห้องแล้ว`,
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
          `🚫 Ban <@${userId}> จาก Temporary Voice Room แล้ว`,
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
          `👑 โอน Ownership ให้ <@${userId}> แล้ว`,
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
