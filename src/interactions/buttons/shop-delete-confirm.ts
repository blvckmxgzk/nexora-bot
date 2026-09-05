import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { env } from "../../config/env.js";
import { Shop } from "../../models/Shop.js";
import { shopDraftService } from "../../services/shopDraftService.js";

export const customId =
  "nexora_shop_delete_confirm";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    await interaction.editReply({
      content:
        "❌ ไม่พบร้านค้าของคุณแล้ว",
      embeds: [],
      components: [],
    });

    return;
  }

  let forumDeleteFailed = false;

  // ลบ Forum Thread
  if (shop.forumThreadId) {
    try {
      const thread =
        await interaction.client.channels.fetch(
          shop.forumThreadId,
        );

      if (
        thread &&
        thread.isThread()
      ) {
        await thread.delete(
          "NEXORA Marketplace - Permanent shop deletion",
        );
      }
    } catch (error) {
      forumDeleteFailed = true;

      console.error(
        "❌ Failed to delete shop forum thread:",
        error,
      );
    }
  }

  // ลบ Seller Roles
  if (interaction.guild) {
    try {
      const member =
        await interaction.guild.members.fetch(
          interaction.user.id,
        );

      const generalRole =
        await interaction.guild.roles.fetch(
          env.GENERAL_SELLER_ROLE_ID,
        );

      const verifiedRole =
        await interaction.guild.roles.fetch(
          env.VERIFIED_SELLER_ROLE_ID,
        );

      if (
        generalRole &&
        member.roles.cache.has(
          generalRole.id,
        )
      ) {
        await member.roles.remove(
          generalRole,
          `NEXORA Marketplace - Shop deleted: ${shop.shopId}`,
        );
      }

      if (
        verifiedRole &&
        member.roles.cache.has(
          verifiedRole.id,
        )
      ) {
        await member.roles.remove(
          verifiedRole,
          `NEXORA Marketplace - Shop deleted: ${shop.shopId}`,
        );
      }
    } catch (error) {
      console.error(
        "⚠️ Failed to remove seller roles:",
        error,
      );
    }
  }

  // ลบข้อมูลร้าน
  await Shop.deleteOne({
    _id: shop._id,
  });

  shopDraftService.delete(
    interaction.user.id,
  );

  const embed =
    new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("🗑️ ลบร้านค้าเรียบร้อย")
      .setDescription(
        [
          `ร้าน **${shop.name}** ถูกลบออกจากระบบแล้ว`,
          "",
          "✅ ลบข้อมูลร้านจาก MongoDB",
          "✅ ลบกระทู้ Forum",
          "✅ ลบยศ Seller",
          "✅ ลบข้อมูลร้านทั้งหมด",
          "",
          "หากต้องการขายสินค้าอีกครั้ง",
          "สามารถเปิดร้านใหม่ได้จาก Marketplace Panel",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Shop Permanently Deleted",
      })
      .setTimestamp();

  if (forumDeleteFailed) {
    embed.addFields({
      name: "⚠️ ไม่สามารถลบ Forum ได้",
      value:
        "ข้อมูลร้านถูกลบจาก MongoDB แล้ว แต่ Bot ไม่มีสิทธิ์ลบกระทู้ Forum",
    });
  }

  await interaction.editReply({
    content: "",
    embeds: [embed],
    components: [],
  });
}
