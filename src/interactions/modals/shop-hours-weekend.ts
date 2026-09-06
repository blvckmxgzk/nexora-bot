import {
  type ModalSubmitInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import {
  ensureBusinessHours,
  parseSchedule,
  updateShopHours,
} from "../../services/shopHoursService.js";

export const customId =
  "nexora_shop_hours_weekend";

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

  try {
    const saturday =
      interaction.fields.getTextInputValue(
        "saturday",
      );

    const sunday =
      interaction.fields.getTextInputValue(
        "sunday",
      );

    const timezone =
      interaction.fields.getTextInputValue(
        "timezone",
      ).trim();

    if (!timezone) {
      throw new Error(
        "กรุณาระบุ Timezone",
      );
    }

    hours.saturday =
      parseSchedule(
        saturday,
      );

    hours.sunday =
      parseSchedule(
        sunday,
      );

    await updateShopHours(
      shop.shopId,
      hours,
      timezone,
    );
  } catch (error) {
    await interaction.reply({
      content:
        `❌ ${
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกเวลาทำการได้"
        }`,
      ephemeral: true,
    });

    return;
  }

  await interaction.reply({
    content:
      [
        "✅ **บันทึกเวลาทำการสำเร็จ**",
        "",
        `🏪 ร้าน: **${shop.name}**`,
        `🌏 Timezone: \`${shop.timezone ?? "Asia/Bangkok"}\``,
        "",
        "ระบบจะใช้เวลานี้ตรวจสอบก่อนสร้าง Order ใหม่",
        "และจะไม่รับ Order ในช่วงที่ร้านปิด",
      ].join("\n"),
    ephemeral: true,
  });
}
