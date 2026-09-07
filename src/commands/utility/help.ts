import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  marketplaceMaintenanceService,
} from "../../services/community/marketplaceMaintenanceService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "help",
    )
    .setDescription(
      "ดูระบบและคำสั่งของ NEXORA",
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const marketplace =
    await marketplaceMaintenanceService
      .getState();

  const embed =
    new EmbedBuilder()
      .setTitle(
        "🧭 NEXORA Help Center",
      )
      .setDescription(
        "Community • Connection • Opportunity",
      )
      .addFields(
        {
          name:
            "👤 สมาชิก",

          value:
            "`/profile` `/rank` `/leaderboard` `/user` `/server` `/ping`",
        },
        {
          name:
            "💰 NEXO",

          value:
            "`/balance` `/daily` `/pay` `/inventory`",
        },
        {
          name:
            "🎫 Ticket",

          value:
            "🔧 กำลังพัฒนา",
        },
        {
          name:
            "💘 Matchmaking",

          value:
            "🔧 กำลังพัฒนา",
        },
        {
          name:
            "🛍️ Marketplace",

          value:
            marketplace.enabled
              ? "🔧 Maintenance"
              : "🟢 Online",
        },
      )
      .setFooter({
        text:
          "NEXORA",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [
      embed,
    ],

    ephemeral:
      true,
  });
}
