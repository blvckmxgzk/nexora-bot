import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

export const customId = "nexora_ticket_close:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const ticketId = interaction.customId.split(":")[1];
  if (!ticketId) return;

  const modal = new ModalBuilder()
    .setCustomId(`nexora_ticket_close_modal:${ticketId}`)
    .setTitle("🔒 Close Ticket");

  const reason = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("เหตุผลที่ปิด Ticket")
    .setPlaceholder("เช่น แก้ไขปัญหาเรียบร้อยแล้ว")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reason),
  );

  await interaction.showModal(modal);
}
