import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { userService } from "../../services/userService.js";
import { UserProfile } from "../../models/UserProfile.js";

export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription(
    "View your NEXORA profile.",
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const user =
    await userService.createOrUpdate({
      discordId: interaction.user.id,
      username:
        interaction.user.username,
      avatar:
        interaction.user.displayAvatarURL(),
    });

  const profile =
    await UserProfile.findOneAndUpdate(
      {
        discordId: interaction.user.id,
      },
      {
        $setOnInsert: {
          discordId: interaction.user.id,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

  const embed =
    new EmbedBuilder()
      .setTitle("👤 NEXORA Profile")
      .setThumbnail(
        interaction.user.displayAvatarURL(),
      )
      .addFields(
        {
          name: "👤 Username",
          value:
            user?.username ??
            interaction.user.username,
          inline: true,
        },
        {
          name: "⭐ Level",
          value: `${profile?.level ?? 1}`,
          inline: true,
        },
        {
          name: "✨ XP",
          value: `${profile?.xp ?? 0}`,
          inline: true,
        },
        {
          name: "💬 Messages",
          value:
            `${profile?.totalMessages ?? 0}`,
          inline: true,
        },
        {
          name: "⭐ Reputation",
          value:
            `${profile?.reputation ?? 0}`,
          inline: true,
        },
      )
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}
