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
  buildTemporaryVoicePanel,
  buildTemporaryVoicePanelEmbed,
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
            "panel",
          )
          .setDescription(
            "เปิด Control Panel ของห้องส่วนตัว",
          ),
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
            "ดูสถานะ Temporary Voice ของคุณ",
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
            "สร้าง/ซ่อม Join-to-Create Hub สำหรับแอดมิน",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags:
      MessageFlags
        .Ephemeral,
  });

  if (
    !interaction.guild
  ) {
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

      const {
        category,
        hub,
      } =
        await temporaryVoiceService
          .ensureSetup(
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
          `Category: **${category.name}**`,
          `Join-to-Create: <#${hub.id}>`,
          `Synced rooms: **${reconcile.synced}**`,
          `Cleaned stale rooms: **${reconcile.deleted}**`,
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
      const setup =
        await temporaryVoiceService
          .ensureSetup(
            interaction.guild,
          );

      await interaction.editReply({
        content: [
          "🔊 คุณยังไม่มี Temporary Voice Room",
          "",
          `เข้า <#${setup.hub.id}> เพื่อสร้างห้องส่วนตัว`,
        ].join(
          "\n",
        ),
      });

      return;
    }

    if (
      subcommand ===
      "status"
    ) {
      await interaction.editReply({
        embeds: [
          buildTemporaryVoicePanelEmbed(
            state.room as any,
            state.channel,
          ),
        ],
      });

      return;
    }

    if (
      subcommand ===
      "panel"
    ) {
      await interaction.editReply({
        embeds: [
          buildTemporaryVoicePanelEmbed(
            state.room as any,
            state.channel,
          ),
        ],

        components:
          buildTemporaryVoicePanel(
            state.room as any,
          ),
      });

      return;
    }

    await interaction.editReply({
      content:
        "❌ Unknown voice subcommand",
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
