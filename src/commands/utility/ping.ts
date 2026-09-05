import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription(
    "Check NEXORA's latency and connection status.",
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const start = Date.now();

  await interaction.deferReply();

  const responseLatency = Date.now() - start;

  const embed = new EmbedBuilder()
    .setTitle("🏓 NEXORA Pong!")
    .setDescription(
      "NEXORA is alive and responding normally.",
    )
    .addFields(
      {
        name: "💓 Response",
        value: `${responseLatency}ms`,
        inline: true,
      },
      {
        name: "📡 Gateway",
        value: "Connected",
        inline: true,
      },
      {
        name: "🟢 Status",
        value: "Operational",
        inline: true,
      },
    )
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
  });
}