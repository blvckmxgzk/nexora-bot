import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import { ticketService } from "../../services/ticketService.js";

export const customId = "nexora_ticket_delete:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;
  const ticketId = interaction.customId.split(":")[1];
  if (!ticketId) return;

  await ticketService.assertStaff(
    interaction.guild,
    interaction.user.id,
  );

  await interaction.reply({
    content: `⚠️ ต้องการลบ Ticket \`${ticketId}\` ถาวรหรือไม่?\nTranscript จะถูกเก็บไว้ใน Ticket Logs ก่อนลบ`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`nexora_ticket_delete_confirm:${ticketId}`)
          .setLabel("Delete permanently")
          .setEmoji("🗑️")
          .setStyle(ButtonStyle.Danger),
      ),
    ],
    ephemeral: true,
  });
}
