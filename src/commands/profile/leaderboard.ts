import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import {
  getRequiredXp,
  levelingService,
} from "../../services/levelingService.js";

export const data = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription(
    "View the NEXORA leveling leaderboard.",
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const users =
    await levelingService.getLeaderboard(10);

  if (users.length === 0) {
    await interaction.reply({
      content:
        "📊 ยังไม่มีข้อมูล Leveling",
      ephemeral: true,
    });

    return;
  }

  const lines = users.map(
    (user, index) => {
      const position =
        index === 0
          ? "🥇"
          : index === 1
            ? "🥈"
            : index === 2
              ? "🥉"
              : `**${index + 1}.**`;

      const requiredXp =
        getRequiredXp(user.level);

      const progress = Math.floor(
        (user.xp / requiredXp) * 100,
      );

      return [
        `${position} <@${user.discordId}>`,
        `> **Lv.${user.level}** · ${user.xp.toLocaleString()} / ${requiredXp.toLocaleString()} XP · ${progress}%`,
      ].join("\n");
    },
  );

  const embed =
    new EmbedBuilder()
      .setTitle("🏆 NEXORA Leaderboard")
      .setDescription(
        lines.join("\n\n"),
      )
      .setFooter({
        text: "NEXORA • Top 10 Members",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}
