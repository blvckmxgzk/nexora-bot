import { type ModalSubmitInteraction } from "discord.js";
import { isTicketType } from "../../community/tickets/ticketTypes.js";
import { ticketService } from "../../services/ticketService.js";

export const customId = "nexora_ticket_create_modal:";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "❌ Ticket ใช้ได้เฉพาะในเซิร์ฟเวอร์",
      ephemeral: true,
    });
    return;
  }

  const type = interaction.customId.split(":")[1];

  if (!type || !isTicketType(type)) {
    await interaction.reply({
      content: "❌ ประเภท Ticket ไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  const subject = interaction.fields.getTextInputValue("subject").trim();
  const description = interaction.fields.getTextInputValue("description").trim();

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await ticketService.open(
      interaction.guild,
      interaction.user.id,
      interaction.user.username,
      type,
      subject,
      description,
    );

    await interaction.editReply({
      content: `✅ เปิด Ticket แล้ว: <#${result.channel.id}>\n🎫 ID: \`${result.ticket.ticketId}\``,
    });
  } catch (error) {
    await interaction.editReply({
      content: error instanceof Error ? `❌ ${error.message}` : "❌ ไม่สามารถเปิด Ticket ได้",
    });
  }
}
