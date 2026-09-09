import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type StringSelectMenuInteraction,
} from "discord.js";

import {
  isTicketType,
  TICKET_TYPE_MAP,
} from "../../community/tickets/ticketTypes.js";
import { ticketService } from "../../services/ticketService.js";

export const customId = "nexora_ticket_create";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "❌ Ticket ใช้ได้เฉพาะในเซิร์ฟเวอร์",
      ephemeral: true,
    });
    return;
  }

  const type = interaction.values[0];

  if (!type || !isTicketType(type)) {
    await interaction.reply({
      content: "❌ ประเภท Ticket ไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  try {
    await ticketService.canOpen(
      interaction.guildId,
      interaction.user.id,
      type,
    );
  } catch (error) {
    await interaction.reply({
      content: error instanceof Error ? `❌ ${error.message}` : "❌ ไม่สามารถเปิด Ticket ได้",
      ephemeral: true,
    });
    return;
  }

  const info = TICKET_TYPE_MAP.get(type)!;

  const modal = new ModalBuilder()
    .setCustomId(`nexora_ticket_create_modal:${type}`)
    .setTitle(`${info.emoji} ${info.label}`);

  const subject = new TextInputBuilder()
    .setCustomId("subject")
    .setLabel("หัวข้อ")
    .setPlaceholder("สรุปปัญหาสั้น ๆ")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(100);

  const description = new TextInputBuilder()
    .setCustomId("description")
    .setLabel("รายละเอียด")
    .setPlaceholder("อธิบายสิ่งที่เกิดขึ้นให้ทีมงานเข้าใจ พร้อมข้อมูลที่เกี่ยวข้อง")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(2000);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(subject),
    new ActionRowBuilder<TextInputBuilder>().addComponents(description),
  );

  await interaction.showModal(modal);
}
