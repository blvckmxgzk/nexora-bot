import { type ButtonInteraction } from "discord.js";
import { ticketService } from "../../services/ticketService.js";

export const customId = "nexora_ticket_delete_confirm:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  const ticketId = interaction.customId.split(":")[1];
  if (!ticketId) return;

  await interaction.update({
    content: `🗑️ กำลังลบ Ticket \`${ticketId}\`...`,
    components: [],
  });

  await ticketService.delete(
    interaction.guild,
    ticketId,
    interaction.user.id,
  );
}
