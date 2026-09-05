import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";

import { shopDraftService } from "../../services/shopDraftService.js";

const categoryNames: Record<string, string> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services: "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

export const customId = "nexora_shop_category";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const category = interaction.values[0];

  const draft =
    shopDraftService.setCategory(
      interaction.user.id,
      category,
    );

  if (!draft) {
    await interaction.update({
      content:
        "❌ ข้อมูลการเปิดร้านหมดอายุแล้ว\n" +
        "กรุณากด **🏪 เปิดร้านค้า** ใหม่อีกครั้ง",
      components: [],
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🏪 ยืนยันข้อมูลร้านค้า")
      .setDescription(
        "ตรวจสอบข้อมูลของคุณก่อนสร้างร้านค้า",
      )
      .addFields(
        {
          name: "🏪 ชื่อร้าน",
          value: draft.name,
          inline: false,
        },
        {
          name: "📝 รายละเอียด",
          value: draft.description,
          inline: false,
        },
        {
          name: "📂 หมวดหมู่",
          value: categoryNames[category] ?? category,
          inline: true,
        },
        {
          name: "🟡 สถานะหลังสร้าง",
          value: "รอการตรวจสอบ",
          inline: true,
        },
      )
      .setFooter({
        text: "NEXORA Marketplace • ตรวจสอบข้อมูลก่อนยืนยัน",
      })
      .setTimestamp();

  const confirmButton =
    new ButtonBuilder()
      .setCustomId("nexora_shop_confirm")
      .setLabel("ยืนยันเปิดร้าน")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);

  const cancelButton =
    new ButtonBuilder()
      .setCustomId("nexora_shop_cancel")
      .setLabel("ยกเลิก")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary);

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        confirmButton,
        cancelButton,
      );

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [row],
  });
}
