import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type ModalSubmitInteraction,
} from "discord.js";

import { env } from "../../config/env.js";
import { Shop } from "../../models/Shop.js";
import {
  ShopVerificationRequest,
} from "../../models/ShopVerificationRequest.js";
import { updateShopForum } from "../../services/shopForumService.js";
import {
  shopNotificationService,
} from "../../services/shopNotificationService.js";

export const customId =
  "nexora_shop_verification_reject_modal:";

export async function execute(
  interaction: ModalSubmitInteraction,
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
        "❌ ปุ่มนี้สามารถใช้งานได้เฉพาะในช่องตรวจสอบร้านค้า",
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

  const reason =
    interaction.fields
      .getTextInputValue(
        "rejection_reason",
      )
      .trim();

  if (reason.length < 5) {
    await interaction.reply({
      content:
        "❌ เหตุผลต้องมีอย่างน้อย 5 ตัวอักษร",
      ephemeral: true,
    });
    return;
  }

  const request =
    await ShopVerificationRequest.findOne({
      requestId,
      status: "pending",
    });

  if (!request) {
    await interaction.reply({
      content:
        "⚠️ คำขอนี้ถูกดำเนินการไปแล้ว หรือไม่พบคำขอ",
      ephemeral: true,
    });
    return;
  }

  const shop =
    await Shop.findOne({
      shopId: request.shopId,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้าที่เกี่ยวข้อง",
      ephemeral: true,
    });
    return;
  }

  if (shop.status === "verified") {
    await interaction.reply({
      content:
        "🟢 ร้านค้านี้ Verified แล้ว ไม่สามารถปฏิเสธคำขอนี้ได้",
      ephemeral: true,
    });
    return;
  }

  if (
    shop.status === "suspended" ||
    shop.status === "closed"
  ) {
    await interaction.reply({
      content:
        "🚫 ร้านค้านี้ไม่สามารถดำเนินการตรวจสอบได้ในสถานะปัจจุบัน",
      ephemeral: true,
    });
    return;
  }

  shop.status = "rejected";
  shop.rejectionReason = reason;

  await shop.save();

  request.status = "rejected";
  request.reviewedAt = new Date();
  request.reviewedBy = interaction.user.id;
  request.rejectionReason = reason;

  await request.save();

  try {
    await updateShopForum(
      interaction.client,
      shop.shopId,
    );
  } catch (error) {
    console.error(
      "⚠️ Failed to sync rejected shop forum:",
      error,
    );
  }

  await shopNotificationService.notifyRejected(
    interaction.client,
    shop,
    interaction.user.id,
    reason,
  );

  const disabledRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `nexora_shop_verification_rejected:${request.requestId}`,
          )
          .setLabel("ปฏิเสธแล้ว")
          .setEmoji("🔴")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId(
            `nexora_shop_verification_done:${request.requestId}`,
          )
          .setLabel("ดำเนินการเสร็จสิ้น")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );

  const message =
    interaction.message;

  if (message) {
    await message.edit({
      embeds: [
        {
          title:
            "🔴 ร้านค้าไม่ผ่านการตรวจสอบ",
          description:
            `ร้าน **${shop.name}** ไม่ผ่านการตรวจสอบ Verified Seller`,
          color: 0xef4444,
          fields: [
            {
              name: "🆔 Shop ID",
              value: `\`${shop.shopId}\``,
              inline: true,
            },
            {
              name: "👤 เจ้าของร้าน",
              value: `<@${shop.ownerId}>`,
              inline: true,
            },
            {
              name: "👮 ผู้ตรวจสอบ",
              value: `<@${interaction.user.id}>`,
              inline: true,
            },
            {
              name: "📝 เหตุผลที่ปฏิเสธ",
              value: reason,
              inline: false,
            },
          ],
        },
      ],
      components: [disabledRow],
    });
  }

  await interaction.reply({
    content:
      `🔴 **ปฏิเสธร้าน ${shop.name} สำเร็จ**\n\n` +
      `🆔 Shop ID: \`${shop.shopId}\`\n` +
      `📝 เหตุผล: ${reason}\n\n` +
      "📩 ส่งการแจ้งเตือนไปยัง DM ของเจ้าของร้านแล้ว",
    ephemeral: true,
  });
}
