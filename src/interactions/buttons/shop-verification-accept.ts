import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { env } from "../../config/env.js";
import { Shop } from "../../models/Shop.js";
import {
  shopVerificationService,
} from "../../services/shopVerificationService.js";

export const customId =
  "nexora_shop_verification_accept";

const RULES_VERSION = "1.0";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId: interaction.user.id,
    });

  if (!shop) {
    await interaction.update({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      embeds: [],
      components: [],
    });
    return;
  }

  if (shop.status === "verified") {
    await interaction.update({
      content:
        "🟢 ร้านค้านี้ Verified แล้ว",
      embeds: [],
      components: [],
    });
    return;
  }

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.update({
      content:
        "❌ ร้านนี้ไม่สามารถยื่นขอ Verified ได้ในขณะนี้",
      embeds: [],
      components: [],
    });
    return;
  }

  const existing =
    await shopVerificationService
      .getPendingByShopId(
        shop.shopId,
      );

  if (existing) {
    await interaction.update({
      content:
        "⏳ คำขอของร้านนี้กำลังรอทีมงานตรวจสอบอยู่แล้ว",
      embeds: [],
      components: [],
    });
    return;
  }

  let request;

  try {
    if (shop.status === "rejected") {
      shop.status = "pending";
      shop.rejectionReason = null;
      await shop.save();
    }

    request =
      await shopVerificationService.createRequest({
        shopId: shop.shopId,
        ownerId: shop.ownerId,
        rulesVersion:
          RULES_VERSION,
      });

    const channel =
      await interaction.client.channels.fetch(
        env.MARKETPLACE_VERIFICATION_REVIEW_CHANNEL_ID,
      );

    if (!channel) {
      throw new Error(
        "ไม่พบช่องตรวจสอบร้านค้า",
      );
    }

    if (
      channel.type !==
        ChannelType.GuildText &&
      channel.type !==
        ChannelType.GuildAnnouncement
    ) {
      throw new Error(
        "ช่องตรวจสอบร้านค้าต้องเป็น Text Channel หรือ Announcement Channel",
      );
    }

    const requestEmbed =
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(
          "🛡️ คำขอ Verified Seller ใหม่",
        )
        .setDescription(
          "มีสมาชิกส่งคำขอ Verified Seller ให้ทีมงานตรวจสอบ",
        )
        .addFields(
          {
            name: "🏪 ร้านค้า",
            value:
              `**${shop.name}**`,
            inline: true,
          },
          {
            name: "🆔 Shop ID",
            value:
              `\`${shop.shopId}\``,
            inline: true,
          },
          {
            name: "📋 Request ID",
            value:
              `\`${request.requestId}\``,
            inline: true,
          },
          {
            name: "👤 เจ้าของร้าน",
            value:
              `<@${shop.ownerId}>`,
            inline: true,
          },
          {
            name: "📂 หมวดหมู่",
            value:
              shop.category,
            inline: true,
          },
          {
            name: "🛡️ สถานะ",
            value:
              "🟡 รอการตรวจสอบ",
            inline: true,
          },
          {
            name: "📝 รายละเอียดร้าน",
            value:
              shop.description ||
              "ไม่มีรายละเอียด",
            inline: false,
          },
          {
            name: "⭐ คะแนน",
            value:
              shop.reviewCount > 0
                ? `${shop.rating.toFixed(1)} / 5 (${shop.reviewCount} รีวิว)`
                : "ยังไม่มีรีวิว",
            inline: true,
          },
          {
            name: "🛒 ออเดอร์สำเร็จ",
            value:
              String(
                shop.completedOrders,
              ),
            inline: true,
          },
          {
            name: "📜 Rules Version",
            value:
              RULES_VERSION,
            inline: true,
          },
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Verification Review",
        })
        .setTimestamp();

    const buttons =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_shop_verification_approve:${request.requestId}`,
            )
            .setLabel(
              "อนุมัติร้านค้า",
            )
            .setEmoji("🟢")
            .setStyle(
              ButtonStyle.Success,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_shop_verification_reject:${request.requestId}`,
            )
            .setLabel(
              "ปฏิเสธร้านค้า",
            )
            .setEmoji("🔴")
            .setStyle(
              ButtonStyle.Danger,
            ),
        );

    const message =
      await channel.send({
        embeds: [
          requestEmbed,
        ],
        components: [
          buttons,
        ],
        allowedMentions: {
          parse: [],
        },
      });

    request.reviewChannelId =
      channel.id;

    request.reviewMessageId =
      message.id;

    await request.save();

    await interaction.update({
      content:
        "✅ **ส่งคำขอ Verified Seller แล้ว**\n\n" +
        `🏪 ร้าน: **${shop.name}**\n` +
        `🆔 Request ID: \`${request.requestId}\`\n\n` +
        "คำขอของคุณถูกส่งให้ทีมงานตรวจสอบแล้ว\n" +
        "📩 เมื่อมีผลการตรวจสอบ ระบบจะแจ้งให้คุณทราบทาง DM",
      embeds: [],
      components: [],
    });
  } catch (error) {
    console.error(
      "❌ Failed to create verification request:",
      error,
    );

    if (request) {
      await request.deleteOne();
    }

    await interaction.update({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถส่งคำขอได้",
      embeds: [],
      components: [],
    });
  }
}
