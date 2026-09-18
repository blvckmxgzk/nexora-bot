import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  miniGameService,
} from "../../services/miniGameService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "minigame-panel",
    )
    .setDescription(
      "ติดตั้ง NEXORA Mini Games Panel",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits
        .ManageGuild
        .toString(),
    )
    .addChannelOption(
      (
        option,
      ) =>
        option
          .setName(
            "channel",
          )
          .setDescription(
            "ช่องมินิเกมที่สร้างไว้แล้ว",
          )
          .addChannelTypes(
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์",

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  const selected =
    interaction.options
      .getChannel(
        "channel",
      );

  const channel =
    selected ??
    interaction.channel;

  if (
    !channel ||
    typeof (
      channel as any
    ).send !==
      "function"
  ) {
    await interaction.editReply({
      content:
        "❌ ช่องนี้ไม่รองรับ Mini Games Panel",
    });

    return;
  }

  const message =
    await (
      channel as any
    ).send(
      miniGameService
        .buildPanel(),
    );

  await interaction.editReply({
    content: [
      "✅ ติดตั้ง Mini Games Panel แล้ว",
      `🔗 https://discord.com/channels/${interaction.guildId}/${channel.id}/${message.id}`,
    ].join(
      "\n",
    ),
  });
}
