import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import {
  getProgressBar,
  getRequiredXp,
  levelingService,
} from "../../services/levelingService.js";

export const data = new SlashCommandBuilder()
  .setName("rank")
  .setDescription(
    "View a member's NEXORA rank.",
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription(
        "Member whose rank you want to view.",
      )
      .setRequired(false),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const target =
    interaction.options.getUser("user") ??
    interaction.user;

  const {
    profile,
    rank,
  } = await levelingService.getRank(
    target.id,
  );

  const requiredXp =
    getRequiredXp(profile.level);

  const progressBar =
    getProgressBar(
      profile.xp,
      requiredXp,
    );

  const progress =
    Math.floor(
      (profile.xp / requiredXp) * 100,
    );

  const embed =
    new EmbedBuilder()
      .setTitle("✨ NEXORA Rank")
      .setDescription(
        `### ${target.displayName}\n<@${target.id}>`,
      )
      .setThumbnail(
        target.displayAvatarURL({
          size: 256,
        }),
      )
      .addFields(
        {
          name: "🏆 Level",
          value: `**${profile.level}**`,
          inline: true,
        },
        {
          name: "🥇 Rank",
          value: `**#${rank}**`,
          inline: true,
        },
        {
          name: "💬 Messages",
          value:
            profile.totalMessages.toLocaleString(),
          inline: true,
        },
        {
          name: "✨ XP",
          value:
            `${profile.xp.toLocaleString()} / ${requiredXp.toLocaleString()}`,
          inline: false,
        },
        {
          name: "📊 Progress",
          value:
            `${progressBar} **${progress}%**`,
          inline: false,
        },
      )
      .setFooter({
        text: "NEXORA • Leveling System",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}
