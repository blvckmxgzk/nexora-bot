import {
  MessageFlags,
  type ModalSubmitInteraction,
} from "discord.js";

import {
  temporaryVoiceService,
} from "../../services/voice/temporaryVoiceService.js";

export const customId =
  "tempvoice-modal:";

export async function execute(
  interaction:
    ModalSubmitInteraction,
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
        "tempvoice-modal" ||
      !action ||
      !channelId
    ) {
      throw new Error(
        "Temporary Voice modal ไม่ถูกต้อง",
      );
    }

    const raw =
      interaction.fields
        .getTextInputValue(
          "value",
        )
        .trim();

    if (
      action ===
      "rename"
    ) {
      const result =
        await temporaryVoiceService
          .rename(
            interaction.guild,
            interaction.user.id,
            channelId,
            raw,
          );

      await interaction.editReply({
        content:
          `✏️ เปลี่ยนชื่อห้องเป็น **${result.channel.name}** แล้ว`,
      });

      return;
    }

    if (
      action ===
      "limit"
    ) {
      const value =
        Number(
          raw,
        );

      await temporaryVoiceService
        .setUserLimit(
          interaction.guild,
          interaction.user.id,
          channelId,
          value,
        );

      await interaction.editReply({
        content:
          value ===
            0
            ? "👥 ปิด User Limit แล้ว"
            : `👥 ตั้ง User Limit เป็น **${value}** แล้ว`,
      });

      return;
    }

    if (
      action ===
      "bitrate"
    ) {
      const value =
        Number(
          raw,
        );

      const result =
        await temporaryVoiceService
          .setBitrate(
            interaction.guild,
            interaction.user.id,
            channelId,
            value,
          );

      await interaction.editReply({
        content:
          `🎙️ ตั้ง Bitrate เป็น **${Math.round(result.channel.bitrate / 1000)} kbps** แล้ว`,
      });

      return;
    }

    throw new Error(
      "ไม่รู้จัก Temporary Voice modal action",
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
