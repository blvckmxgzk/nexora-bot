import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  temporaryVoiceService,
} from "../services/voice/temporaryVoiceService.js";

import {
  temporaryVoicePanelService,
} from "../services/voice/temporaryVoicePanelService.js";

import {
  buildTemporaryVoiceStatusEmbed,
} from "../services/voice/temporaryVoiceUi.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "voice",
    )
    .setDescription(
      "🔊 จัดการ NEXORA Temporary Voice",
    )

    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "status",
          )
          .setDescription(
            "ดูสถานะ Temporary Voice Room ของคุณ",
          ),
    )

    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "setup",
          )
          .setDescription(
            "สร้าง/ซ่อม Temporary Voice และ Control Panel",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  if (!interaction.guild) {
    await interaction.editReply({
      content:
        "❌ คำสั่งนี้ใช้ได้เฉพาะใน NEXORA Server",
    });

    return;
  }

  const subcommand =
    interaction.options
      .getSubcommand();

  try {
    if (
      subcommand ===
      "setup"
    ) {
      const member =
        await interaction.guild
          .members
          .fetch(
            interaction.user.id,
          );

      if (
        !member.permissions.has(
          PermissionFlagsBits
            .ManageChannels,
        )
      ) {
        await interaction.editReply({
          content:
            "❌ ต้องมีสิทธิ์ Manage Channels เพื่อใช้ `/voice setup`",
        });

        return;
      }

      const result =
        await temporaryVoicePanelService
          .ensurePanel(
            interaction.guild,
          );

      const reconcile =
        await temporaryVoiceService
          .reconcileGuild(
            interaction.guild,
          );

      await interaction.editReply({
        content: [
          "✅ **NEXORA Temporary Voice พร้อมใช้งานแล้ว**",
          "",
          `Category: **${result.category.name}**`,
          `Join-to-Create: <#${result.hub.id}>`,
          `Control Panel: <#${result.panelChannel.id}>`,
          `Panel Message: \`${result.panelMessage.id}\``,
          "",
          `Synced Rooms: **${reconcile.synced}**`,
          `Cleaned Rooms: **${reconcile.deleted}**`,
        ].join(
          "\n",
        ),
      });

      return;
    }

    const state =
      await temporaryVoiceService
        .getOwnedRoomState(
          interaction.guild,
          interaction.user.id,
        );

    if (!state) {
      const result =
        await temporaryVoicePanelService
          .ensurePanel(
            interaction.guild,
          );

      await interaction.editReply({
        content: [
          "🔊 คุณยังไม่มี Temporary Voice Room",
          "",
          `สร้างห้องโดยเข้า <#${result.hub.id}>`,
          `จากนั้นใช้พาแนลถาวรที่ <#${result.panelChannel.id}>`,
        ].join(
          "\n",
        ),
      });

      return;
    }

    await interaction.editReply({
      embeds: [
        buildTemporaryVoiceStatusEmbed(
          state.room as any,
          state.channel,
        ),
      ],
    });
  } catch (
    error
  ) {
    await interaction.editReply({
      content:
        `❌ ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
