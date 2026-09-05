import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { env } from "../../config/env.js";

export const customId =
  "nexora_shop_verification_reject:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content:
        "❌ ใช้งานได้เฉพาะในเซิร์ฟเวอร์",
      ephemeral: true,
    });
    return;
  }

  if (
    interaction.channelId !==
    env.MARKETPLACE_VERIFICATION_REVIEW_CHANNEL_ID
  ) {
    await interaction.reply({
      content:
        "❌ ปุ่มนี้ใช้ได้เฉพาะในช่องตรวจสอบร้านค้า",
      ephemeral: true,
    });
    return;
  }

  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator,
    ) &&
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild,
    )
  ) {
    await interaction.reply({
      content:
        "❌ คุณไม่มีสิทธิ์ปฏิเสธร้านค้า",
      ephemeral: true,
    });
    return;
  }

  const requestId =
    interaction.customId.split(":")[1];

  if (!requestId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Request ID",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_shop_verification_reject_modal:${requestId}`,
      )
      .setTitle(
        "🔴 ปฏิเสธร้านค้า",
      );

  const reason =
    new TextInputBuilder()
      .setCustomId(
        "rejection_reason",
      )
      .setLabel(
        "เหตุผลที่ปฏิเสธ",
      )
      .setPlaceholder(
        "ระบุเหตุผลที่เจ้าของร้านสามารถนำไปแก้ไขได้...",
      )
      .setStyle(
        TextInputStyle.Paragraph,
      )
      .setMinLength(5)
      .setMaxLength(1000)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(reason),
  );

  await interaction.showModal(
    modal,
  );
}
