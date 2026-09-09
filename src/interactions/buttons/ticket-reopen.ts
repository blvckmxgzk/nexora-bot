import { type ButtonInteraction } from "discord.js";
import { ticketService } from "../../services/ticketService.js";

export const customId = "nexora_ticket_reopen:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  const ticketId = interaction.customId.split(":")[1];
  if (!ticketId) return;

  await ticketService.reopen(
    interaction.guild,
    ticketId,
    interaction.user.id,
  );

  await interaction.reply({
    content: `🔓 Ticket \`${ticketId}\` ถูกเปิดใหม่แล้ว`,
  });
}
