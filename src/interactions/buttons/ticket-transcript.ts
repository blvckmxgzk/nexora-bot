import {
  ChannelType,
  type ButtonInteraction,
  type TextChannel,
} from "discord.js";
import { ticketService } from "../../services/ticketService.js";
import { ticketTranscriptService } from "../../services/ticketTranscriptService.js";

export const customId = "nexora_ticket_transcript:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  const ticketId = interaction.customId.split(":")[1];
  if (!ticketId) return;

  const ticket = await ticketService.get(ticketId);
  await ticketService.assertCanView(
    interaction.guild,
    ticket,
    interaction.user.id,
  );

  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "❌ ไม่สามารถสร้าง Transcript จากห้องนี้ได้",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const transcript = await ticketTranscriptService.create(
    interaction.channel as TextChannel,
    ticket.ticketId,
  );

  await interaction.editReply({
    content: `📄 Transcript • ${transcript.messageCount.toLocaleString()} messages`,
    files: [transcript.attachment],
  });
}
