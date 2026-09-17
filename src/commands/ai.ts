import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  env,
} from "../config/env.js";

import {
  nexoraChatbotService,
} from "../services/chatbot/nexoraChatbotService.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "ai",
    )
    .setDescription(
      "จัดการ NEXORA AI ของคุณ",
    )
    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "reset",
          )
          .setDescription(
            "ล้างบริบทการสนทนาชั่วคราวของคุณ",
          ),
    )
    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "status",
          )
          .setDescription(
            "ดูสถานะ NEXORA AI",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  if (
    !interaction.guild
  ) {
    await interaction.reply({
      content:
        "คำสั่งนี้ใช้ได้เฉพาะใน NEXORA Server",

      ephemeral:
        true,
    });

    return;
  }

  const subcommand =
    interaction.options
      .getSubcommand();

  if (
    subcommand ===
    "reset"
  ) {
    const deleted =
      nexoraChatbotService
        .resetUserConversations(
          interaction.guild.id,
          interaction.user.id,
        );

    await interaction.reply({
      content:
        deleted > 0
          ? "🧹 ล้าง Conversation Context ของ NEXORA AI เรียบร้อยแล้ว"
          : "🧹 ตอนนี้ไม่มี Conversation Context ที่ต้องล้าง",

      ephemeral:
        true,
    });

    return;
  }

  const config =
    await nexoraChatbotService
      .ensureConfig(
        interaction.guild,
      );

  await interaction.reply({
    content: [
      "🤖 **NEXORA AI Status**",
      "",
      `Status: ${nexoraChatbotService.isEnabled() ? "✅ Enabled" : "❌ Disabled"}`,
      `AI Provider: ${nexoraChatbotService.isConfigured() ? "✅ Configured" : "⚠️ API key missing"}`,
      `Model: \`${nexoraChatbotService.getModel()}\``,
      `AI Channel: ${config.channelId ? `<#${config.channelId}>` : "ยังไม่มี"}`,
      `Mention Trigger: ${config.mentionEnabled ? "✅" : "❌"}`,
      `Reply Trigger: ${config.replyTriggerEnabled ? "✅" : "❌"}`,
      `Message Content Intent: ${env.NEXORA_MESSAGE_CONTENT_INTENT ? "✅" : "❌"}`,
      `Conversation Timeout: ${config.conversationTtlMinutes} นาที`,
      `Rate Limit: ${config.hourlyLimit}/hour`,
    ].join(
      "\n",
    ),

    ephemeral:
      true,
  });
}
