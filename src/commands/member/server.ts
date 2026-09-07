import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "server",
    )
    .setDescription(
      "ดูข้อมูล NEXORA Server",
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const guild =
    interaction.guild;

  if (!guild) {
    await interaction.reply({
      content:
        "❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์",

      ephemeral:
        true,
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        `🌐 ${guild.name}`,
      )
      .setThumbnail(
        guild.iconURL({
          size:
            512,
        }) ??
        null,
      )
      .addFields(
        {
          name:
            "👥 Members",

          value:
            guild
              .memberCount
              .toLocaleString(),

          inline:
            true,
        },
        {
          name:
            "💬 Channels",

          value:
            guild
              .channels
              .cache
              .size
              .toLocaleString(),

          inline:
            true,
        },
        {
          name:
            "🎭 Roles",

          value:
            guild
              .roles
              .cache
              .size
              .toLocaleString(),

          inline:
            true,
        },
        {
          name:
            "👑 Owner",

          value:
            `<@${guild.ownerId}>`,

          inline:
            true,
        },
        {
          name:
            "📅 Created",

          value:
            `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,

          inline:
            false,
        },
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [
      embed,
    ],
  });
}
