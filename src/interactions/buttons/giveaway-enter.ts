import {
  type ButtonInteraction,
} from "discord.js";

import {
  giveawayService,
} from "../../services/giveawayService.js";

export const customId =
  "nexora_giveaway_enter:";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  await interaction.deferReply({
    ephemeral:
      true,
  });

  const giveawayId =
    interaction.customId
      .slice(
        customId.length,
      )
      .trim();

  if (!giveawayId) {
    await interaction.editReply({
      content:
        "❌ Giveaway ID ไม่ถูกต้อง",
    });

    return;
  }

  const result =
    await giveawayService
      .toggleEntry(
        interaction.client,
        giveawayId,
        interaction.user.id,
      );

  await interaction.editReply({
    content:
      result.joined
        ? [
            "🎉 **เข้าร่วม Giveaway แล้ว!**",
            `ผู้เข้าร่วมทั้งหมด: **${result.entrantCount} คน**`,
            "",
            "กดปุ่มเดิมอีกครั้งหากต้องการถอนตัว",
          ].join(
            "\n",
          )
        : [
            "↩️ **ถอนตัวจาก Giveaway แล้ว**",
            `ผู้เข้าร่วมทั้งหมด: **${result.entrantCount} คน**`,
          ].join(
            "\n",
          ),
  });
}
