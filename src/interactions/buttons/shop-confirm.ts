import {
  type ButtonInteraction,
} from "discord.js";

import { env } from "../../config/env.js";
import {
  ChannelType,
  EmbedBuilder,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { shopService } from "../../services/shopService.js";
import { shopDraftService } from "../../services/shopDraftService.js";
import { updateShopForum } from "../../services/shopForumService.js";

const categoryNames: Record<string, string> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services: "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

export const customId =
  "nexora_shop_confirm";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  const draft =
    shopDraftService.get(
      interaction.user.id,
    );

  if (!draft || !draft.category) {
    await interaction.editReply({
      content:
        "❌ ข้อมูลการเปิดร้านหมดอายุแล้ว\n" +
        "กรุณากด **🏪 เปิดร้านค้า** ใหม่อีกครั้ง",
      embeds: [],
      components: [],
    });
    return;
  }

  let shop;

  try {
    shop =
      await shopService.createShop({
        ownerId:
          interaction.user.id,
        name: draft.name,
        description:
          draft.description,
        category:
          draft.category as
            | "game_topup"
            | "game_keys"
            | "gift_cards"
            | "digital_services"
            | "other",
      });

    const forumChannel =
      await interaction.client.channels.fetch(
        env.MARKETPLACE_FORUM_CHANNEL_ID,
      );

    if (!forumChannel) {
      throw new Error(
        "ไม่พบ Marketplace Forum Channel",
      );
    }

    if (
      forumChannel.type !==
      ChannelType.GuildForum
    ) {
      throw new Error(
        "Channel ที่กำหนดไม่ใช่ Forum Channel",
      );
    }

    const thread =
      await forumChannel.threads.create({
        name:
          `🏪 ${shop.name}`,
        message: {
          content:
            `## 🏪 ร้านค้าใหม่\n\n` +
            `ร้านนี้กำลังรอทีมงานตรวจสอบ\n\n` +
            `👤 เจ้าของ: <@${shop.ownerId}>\n` +
            `🆔 Shop ID: \`${shop.shopId}\``,
        },
      });

    shop.forumThreadId =
      thread.id;

    await shop.save();

    await updateShopForum(
      interaction.client,
      shop.shopId,
    );

    if (!interaction.guild) {
      throw new Error(
        "ไม่พบเซิร์ฟเวอร์ของ Interaction",
      );
    }

    const member =
      await interaction.guild.members.fetch(
        interaction.user.id,
      );

    const sellerRole =
      await interaction.guild.roles.fetch(
        env.GENERAL_SELLER_ROLE_ID,
      );

    if (!sellerRole) {
      throw new Error(
        "ไม่พบยศผู้ขายทั่วไป กรุณาตรวจสอบ GENERAL_SELLER_ROLE_ID",
      );
    }

    if (
      !member.roles.cache.has(
        sellerRole.id,
      )
    ) {
      await member.roles.add(
        sellerRole,
        "NEXORA Marketplace - Seller registration",
      );
    }

    shopDraftService.delete(
      interaction.user.id,
    );

    const successEmbed =
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(
          "🏪 เปิดร้านค้าสำเร็จ!",
        )
        .setDescription(
          `ร้าน **${shop.name}** ถูกสร้างเรียบร้อยแล้ว 🎉`,
        )
        .addFields(
          {
            name: "🆔 Shop ID",
            value:
              `\`${shop.shopId}\``,
            inline: true,
          },
          {
            name: "📂 หมวดหมู่",
            value:
              categoryNames[
                shop.category
              ] ??
              shop.category,
            inline: true,
          },
          {
            name: "🟡 สถานะ",
            value:
              "**รอการตรวจสอบ**",
            inline: true,
          },
          {
            name: "🏷️ ยศผู้ขาย",
            value:
              `<@&${sellerRole.id}>`,
            inline: true,
          },
          {
            name: "💬 Forum",
            value:
              `<#${thread.id}>`,
            inline: true,
          },
        )
        .setFooter({
          text:
            "NEXORA Marketplace • รอทีมงานตรวจสอบ",
        })
        .setTimestamp();

    await interaction.editReply({
      content: "",
      embeds: [successEmbed],
      components: [],
    });
  } catch (error) {
    console.error(
      "❌ Failed to create marketplace shop:",
      error,
    );

    if (shop) {
      try {
        await Shop.deleteOne({
          _id: shop._id,
        });
      } catch (rollbackError) {
        console.error(
          "❌ Failed to rollback shop:",
          rollbackError,
        );
      }
    }

    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถสร้างร้านค้าได้",
      embeds: [],
      components: [],
    });
  }
}
