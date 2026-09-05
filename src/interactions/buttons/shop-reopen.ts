import {
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { updateShopForum } from "../../services/shopForumService.js";

export const customId =
  "nexora_shop_reopen";

export async function execute(
  interaction: ButtonInteraction,
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

  if (shop.status !== "closed") {
    await interaction.reply({
      content:
        "❌ ร้านค้าของคุณไม่ได้อยู่ในสถานะปิดชั่วคราว",
      ephemeral: true,
    });
    return;
  }

  const previousStatus =
    shop.closedFromStatus ??
    "pending";

  if (
    previousStatus !== "pending" &&
    previousStatus !== "verified"
  ) {
    await interaction.reply({
      content:
        "❌ ไม่สามารถคืนสถานะร้านค้าได้ กรุณาติดต่อทีมงาน",
      ephemeral: true,
    });
    return;
  }

  shop.status =
    previousStatus;

  shop.closedFromStatus =
    null;

  await shop.save();

  try {
    await updateShopForum(
      interaction.client,
      shop.shopId,
    );
  } catch (error) {
    console.error(
      "⚠️ Failed to sync reopened shop forum:",
      error,
    );
  }

  await interaction.update({
    content:
      "🔓 **เปิดร้านค้ากลับมาสำเร็จ**\n\n" +
      `ร้าน **${shop.name}** กลับมาเปิดแล้ว 🎉\n\n` +
      "📦 สินค้าและ Stock เดิมยังอยู่ครบ\n" +
      "⭐ รีวิวและประวัติการขายยังคงอยู่\n" +
      "💬 Forum ของร้านกลับมาเปิดใช้งานแล้ว",
    embeds: [],
    components: [],
  });
}
