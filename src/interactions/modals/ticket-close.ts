import { type ModalSubmitInteraction } from "discord.js";
import { ticketService } from "../../services/ticketService.js";

export const customId = "nexora_ticket_close_modal:";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  const ticketId = interaction.customId.split(":")[1];
  if (!ticketId) return;

  const reason = interaction.fields.getTextInputValue("reason").trim();
  await interaction.deferReply({ ephemeral: true });

  await ticketService.close(
    interaction.guild,
    ticketId,
    interaction.user.id,
    reason,
  );

  await interaction.editReply({
    content: `🔒 ปิด Ticket \`${ticketId}\` แล้ว\nTranscript ถูกส่งเข้า Ticket Logs เรียบร้อย`,
  });
}
