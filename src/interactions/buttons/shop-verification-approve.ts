import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type ButtonInteraction,
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
  "nexora_shop_verification_approve:";

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
        "❌ คุณไม่มีสิทธิ์อนุมัติร้านค้า",
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
        "❌ ไม่พบร้านค้าที่เกี่ยวข้องกับคำขอนี้",
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
        "🚫 ร้านนี้ไม่สามารถอนุมัติได้ในสถานะปัจจุบัน",
      ephemeral: true,
    });
    return;
  }

  shop.status = "verified";
  shop.verifiedAt = new Date();
  shop.verifiedBy = interaction.user.id;
  shop.rejectionReason = null;

  await shop.save();

  request.status = "approved";
  request.reviewedAt = new Date();
  request.reviewedBy = interaction.user.id;

  await request.save();

  try {
    const member =
      await interaction.guild.members.fetch(
        shop.ownerId,
      );

    const verifiedRole =
      await interaction.guild.roles.fetch(
        env.VERIFIED_SELLER_ROLE_ID,
      );

    const generalSellerRole =
      await interaction.guild.roles.fetch(
        env.GENERAL_SELLER_ROLE_ID,
      );

    if (verifiedRole) {
      await member.roles.add(
        verifiedRole,
        "NEXORA Marketplace - Verification approved",
      );
    }

    if (
      generalSellerRole &&
      member.roles.cache.has(
        generalSellerRole.id,
      )
    ) {
      await member.roles.remove(
        generalSellerRole,
        "NEXORA Marketplace - Verification approved",
      );
    }
  } catch (error) {
    console.error(
      "⚠️ Failed to sync verification roles:",
      error,
    );
  }

  try {
    await updateShopForum(
      interaction.client,
      shop.shopId,
    );
  } catch (error) {
    console.error(
      "⚠️ Failed to sync verified shop forum:",
      error,
    );
  }

  await shopNotificationService.notifyVerified(
    interaction.client,
    shop,
    interaction.user.id,
  );

  const disabledRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `nexora_shop_verification_approve_done:${request.requestId}`,
          )
          .setLabel("อนุมัติแล้ว")
          .setEmoji("🟢")
          .setStyle(ButtonStyle.Success)
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

  await interaction.message.edit({
    embeds: [
      {
        title:
          "🟢 ร้านค้าได้รับการอนุมัติ",
        description:
          `ร้าน **${shop.name}** ได้รับสถานะ **Verified Seller** แล้ว`,
        color: 0x22c55e,
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
            name: "👮 ผู้อนุมัติ",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
        ],
      },
    ],
    components: [disabledRow],
  });

  await interaction.reply({
    content:
      `🟢 อนุมัติร้าน **${shop.name}** สำเร็จ\n` +
      "📩 ส่งการแจ้งเตือนไปยัง DM ของเจ้าของร้านแล้ว",
    ephemeral: true,
  });
}
