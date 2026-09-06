import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import {
  ensureBusinessHours,
  parseSchedule,
} from "../../services/shopHoursService.js";

export const customId =
  "nexora_shop_hours_weekdays";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId:
        interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });

    return;
  }

  const hours =
    ensureBusinessHours(
      shop,
    );

  const dayIds = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ] as const;

  try {
    for (const day of dayIds) {
      const value =
        interaction.fields.getTextInputValue(
          day,
        );

      hours[day] =
        parseSchedule(
          value,
        );
    }
  } catch (error) {
    await interaction.reply({
      content:
        `❌ ${
          error instanceof Error
            ? error.message
            : "รูปแบบเวลาไม่ถูกต้อง"
        }`,
      ephemeral: true,
    });

    return;
  }

  shop.businessHours =
    hours;

  await shop.save();

  const embed =
    new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(
        "✅ บันทึกเวลาจันทร์–ศุกร์แล้ว",
      )
      .setDescription(
        [
          "เหลืออีก 2 วันครับ",
          "",
          "🟦 **ขั้นตอนถัดไป**",
          "ตั้งค่า **เสาร์ / อาทิตย์ / Timezone**",
          "",
          "ตัวอย่าง:",
          "`09:00-22:00`",
          "`22:00-02:00`",
          "`closed`",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Business Hours",
      })
      .setTimestamp();

  const nextButton =
    new ButtonBuilder()
      .setCustomId(
        "nexora_shop_hours_weekend",
      )
      .setLabel(
        "ตั้งค่า เสาร์ / อาทิตย์",
      )
      .setEmoji("➡️")
      .setStyle(
        ButtonStyle.Primary,
      );

  const backButton =
    new ButtonBuilder()
      .setCustomId(
        "nexora_shop_hours",
      )
      .setLabel(
        "ดูเวลาทำการ",
      )
      .setEmoji("🕐")
      .setStyle(
        ButtonStyle.Secondary,
      );

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        nextButton,
        backButton,
      );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
