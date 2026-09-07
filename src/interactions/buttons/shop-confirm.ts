import {
  ChannelType,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import {
  env,
} from "../../config/env.js";

import {
  Shop,
} from "../../models/Shop.js";

import {
  shopService,
} from "../../services/shopService.js";

import {
  shopDraftService,
} from "../../services/shopDraftService.js";

import {
  updateShopForum,
} from "../../services/shopForumService.js";

const categoryNames:
  Record<string, string> = {
    game_topup:
      "🎮 Game Top-up",

    game_keys:
      "🔑 Game Keys",

    gift_cards:
      "🎁 Gift Cards",

    digital_services:
      "🛠️ Digital Services",

    other:
      "📦 อื่น ๆ",
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

  if (
    !draft ||
    !draft.category
  ) {
    await interaction.editReply({
      content:
        "❌ ข้อมูลการเปิดร้านหมดอายุแล้ว\n" +
        "กรุณากด **🏪 เปิดร้านค้า** ใหม่อีกครั้ง",

      embeds: [],
      components: [],
    });

    return;
  }

  let shop: any =
    null;

  let thread: any =
    null;

  let member: any =
    null;

  let sellerRole: any =
    null;

  let sellerRoleExistedBefore =
    false;

  let sellerRoleMutationAttempted =
    false;

  try {
    /*
     * --------------------------------------------------
     * PREFLIGHT
     * --------------------------------------------------
     *
     * ตรวจ Discord resources ที่จำเป็นทั้งหมดก่อน
     * สร้าง Shop หรือ Forum thread
     *
     * read-only failures ไม่ควรสร้าง side effect
     */
    if (!interaction.guild) {
      throw new Error(
        "ไม่พบเซิร์ฟเวอร์ของ Interaction",
      );
    }

    const forumChannel =
      await interaction.client
        .channels.fetch(
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

    member =
      await interaction.guild
        .members.fetch(
          interaction.user.id,
        );

    sellerRole =
      await interaction.guild
        .roles.fetch(
          env.GENERAL_SELLER_ROLE_ID,
        );

    if (!sellerRole) {
      throw new Error(
        "ไม่พบยศผู้ขายทั่วไป กรุณาตรวจสอบ GENERAL_SELLER_ROLE_ID",
      );
    }

    sellerRoleExistedBefore =
      member.roles.cache.has(
        sellerRole.id,
      );

    /*
     * --------------------------------------------------
     * PROVISION SHOP
     * --------------------------------------------------
     */
    shop =
      await shopService.createShop({
        ownerId:
          interaction.user.id,

        name:
          draft.name,

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

    /*
     * --------------------------------------------------
     * CREATE FORUM THREAD
     * --------------------------------------------------
     */
    thread =
      await forumChannel
        .threads.create({
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

    /*
     * ทำ starter message / embed
     * ให้เสร็จก่อนมอบ role
     */
    await updateShopForum(
      interaction.client,
      shop.shopId,
    );

    /*
     * --------------------------------------------------
     * SELLER ROLE
     * --------------------------------------------------
     *
     * ถ้ามี role อยู่ก่อนแล้ว
     * operation นี้ไม่มีสิทธิ์ remove มันตอน rollback
     */
    if (
      !sellerRoleExistedBefore
    ) {
      /*
       * ตั้ง flag ก่อน await เพื่อครอบคลุม
       * ambiguous Discord API failure:
       *
       * server อาจเพิ่ม role สำเร็จแล้ว
       * แต่ response กลับมาหา bot ไม่สำเร็จ
       */
      sellerRoleMutationAttempted =
        true;

      await member.roles.add(
        sellerRole,

        "NEXORA Marketplace - Seller registration",
      );
    }

    /*
     * ถึงตรงนี้ provisioning สำเร็จแล้ว
     *
     * UI response หลังจากนี้ไม่ใช่ส่วนหนึ่ง
     * ของ provisioning transaction
     */
  } catch (error) {
    console.error(
      "❌ Failed to create marketplace shop:",
      error,
    );

    /*
     * --------------------------------------------------
     * COMPENSATING ROLLBACK
     * --------------------------------------------------
     *
     * reverse order:
     * Role -> Thread -> Shop
     */

    if (
      sellerRoleMutationAttempted &&
      !sellerRoleExistedBefore &&
      member &&
      sellerRole
    ) {
      try {
        /*
         * remove แบบ unconditional
         *
         * ถ้า roles.add() ล้มแบบ ambiguous
         * Discord อาจเพิ่ม role ไปแล้วก็ได้
         *
         * ถ้าไม่ได้เพิ่มจริง การ remove
         * role ที่ไม่มีอยู่ถือเป็น safe cleanup
         */
        await member.roles.remove(
          sellerRole,

          "NEXORA Marketplace - Shop creation rollback",
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "❌ Failed to rollback seller role:",
          rollbackError,
        );
      }
    }

    if (thread) {
      try {
        await thread.delete(
          "NEXORA Marketplace - Shop creation rollback",
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "❌ Failed to rollback marketplace forum thread:",
          rollbackError,
        );
      }
    }

    if (shop) {
      try {
        await Shop.deleteOne({
          _id:
            shop._id,
        });
      } catch (
        rollbackError
      ) {
        console.error(
          "❌ Failed to rollback shop:",
          rollbackError,
        );
      }
    }

    /*
     * อย่าลบ draft เมื่อ provisioning ไม่สำเร็จ
     * เพื่อให้ผู้ใช้ retry ได้
     */
    try {
      await interaction.editReply({
        content:
          error instanceof Error
            ? `❌ ${error.message}`
            : "❌ ไม่สามารถสร้างร้านค้าได้",

        embeds: [],
        components: [],
      });
    } catch (
      replyError
    ) {
      console.error(
        "❌ Failed to send shop creation failure response:",
        replyError,
      );
    }

    return;
  }

  if (
    !shop ||
    !thread ||
    !sellerRole
  ) {
    /*
     * Defensive invariant.
     * ไม่ควรเกิดขึ้นถ้า provisioning
     * ด้านบนทำงานครบ
     */
    console.error(
      "❌ Shop provisioning finished without complete context",
    );

    return;
  }

  /*
   * --------------------------------------------------
   * COMMITTED
   * --------------------------------------------------
   *
   * ตั้งแต่ตรงนี้:
   * - Shop มีอยู่
   * - Forum มีอยู่
   * - Forum sync แล้ว
   * - Seller role sync แล้ว
   *
   * ห้าม rollback เพราะ UI reply failure
   */
  shopDraftService.delete(
    interaction.user.id,
  );

  const successEmbed =
    new EmbedBuilder()
      .setColor(
        0x22c55e,
      )
      .setTitle(
        "🏪 เปิดร้านค้าสำเร็จ!",
      )
      .setDescription(
        `ร้าน **${shop.name}** ถูกสร้างเรียบร้อยแล้ว 🎉`,
      )
      .addFields(
        {
          name:
            "🆔 Shop ID",

          value:
            `\`${shop.shopId}\``,

          inline:
            true,
        },

        {
          name:
            "📂 หมวดหมู่",

          value:
            categoryNames[
              shop.category
            ] ??
            shop.category,

          inline:
            true,
        },

        {
          name:
            "🟡 สถานะ",

          value:
            "**รอการตรวจสอบ**",

          inline:
            true,
        },

        {
          name:
            "🏷️ ยศผู้ขาย",

          value:
            `<@&${sellerRole.id}>`,

          inline:
            true,
        },

        {
          name:
            "💬 Forum",

          value:
            `<#${thread.id}>`,

          inline:
            true,
        },
      )
      .setFooter({
        text:
          "NEXORA Marketplace • รอทีมงานตรวจสอบ",
      })
      .setTimestamp();

  /*
   * UI response failure ไม่ใช่เหตุผล
   * สำหรับลบร้านที่ provision สำเร็จแล้ว
   */
  try {
    await interaction.editReply({
      content:
        "",

      embeds: [
        successEmbed,
      ],

      components: [],
    });
  } catch (error) {
    console.error(
      `⚠️ Shop ${shop.shopId} was created successfully but success response could not be sent:`,
      error,
    );
  }
}
