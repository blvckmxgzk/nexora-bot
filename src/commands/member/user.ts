import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "user",
    )
    .setDescription(
      "ข้อมูลสมาชิก NEXORA",
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "avatar",
          )
          .setDescription(
            "ดู Avatar",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "info",
          )
          .setDescription(
            "ดูข้อมูลสมาชิก",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "สมาชิก",
                ),
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const user =
    interaction.options
      .getUser(
        "user",
      ) ??
    interaction.user;

  const sub =
    interaction.options
      .getSubcommand();

  if (
    sub ===
    "avatar"
  ) {
    const avatar =
      user.displayAvatarURL({
        size:
          4096,
      });

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `🖼️ ${user.username}`,
          )
          .setImage(
            avatar,
          )
          .setDescription(
            `[เปิดรูปขนาดเต็ม](${avatar})`,
          ),
      ],
    });

    return;
  }

  const member =
    interaction.guild
      ? await interaction.guild
          .members
          .fetch(
            user.id,
          )
          .catch(
            () =>
              null,
          )
      : null;

  const embed =
    new EmbedBuilder()
      .setTitle(
        `👤 ${user.username}`,
      )
      .setThumbnail(
        user.displayAvatarURL({
          size:
            512,
        }),
      )
      .addFields(
        {
          name:
            "🆔 User ID",

          value:
            `\`${user.id}\``,

          inline:
            true,
        },
        {
          name:
            "🤖 Bot",

          value:
            user.bot
              ? "Yes"
              : "No",

          inline:
            true,
        },
        {
          name:
            "📅 Account Created",

          value:
            `<t:${Math.floor(
              user.createdTimestamp /
              1000
            )}:F>`,

          inline:
            false,
        },
        {
          name:
            "📥 Joined NEXORA",

          value:
            member
              ?.joinedTimestamp
              ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`
              : "Unknown",

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
