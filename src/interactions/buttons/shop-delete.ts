import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { env } from "../../config/env.js";
import { Shop } from "../../models/Shop.js";
import { shopDraftService } from "../../services/shopDraftService.js";

export const customId = "nexora_shop_delete";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle("⚠️ ลบร้านค้าถาวร")
      .setDescription(
        [
          `คุณกำลังจะลบร้าน **${shop.name}**`,
          "",
          "การลบร้านจะ:",
          "🗑️ ลบข้อมูลร้านจาก MongoDB",
          "🗑️ ลบกระทู้ร้านจาก Forum",
          "🏷️ ลบยศ Seller",
          "📊 ลบข้อมูลร้านทั้งหมด",
          "",
          "**⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้**",
          "",
          "หากต้องการขายสินค้าอีกครั้ง",
          "คุณจะต้องเปิดร้านใหม่",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Permanent Deletion",
      })
      .setTimestamp();

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_delete_confirm",
          )
          .setLabel("ยืนยันลบร้านถาวร")
          .setEmoji("🗑️")
          .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_manage_cancel",
          )
          .setLabel("ยกเลิก")
          .setEmoji("↩️")
          .setStyle(ButtonStyle.Secondary),
      );

  await interaction.update({
    embeds: [embed],
    components: [row],
  });
}
