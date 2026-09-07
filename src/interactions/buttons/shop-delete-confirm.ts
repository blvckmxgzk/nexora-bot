import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import {
  env,
} from "../../config/env.js";

import {
  shopDraftService,
} from "../../services/shopDraftService.js";

import {
  shopArchiveService,
} from "../../services/shopArchiveService.js";

export const customId =
  "nexora_shop_delete_confirm";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  let archived:
    Awaited<
      ReturnType<
        typeof shopArchiveService.archiveShop
      >
    >;

  /*
   * Mongo archive ก่อน Discord cleanup
   *
   * ถ้า financial preflight fail
   * ห้ามแตะ Forum / Role
   */
  try {
    archived =
      await shopArchiveService
        .archiveShop({
          ownerId:
            interaction.user.id,

          actorId:
            interaction.user.id,

          reason:
            "Seller requested permanent marketplace archive",
        });
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถ archive ร้านค้าได้",

      embeds: [],
      components: [],
    });

    return;
  }

  const shop =
    archived.shop;

  let forumDeleteFailed =
    false;

  /*
   * Mongo เป็น source of truth แล้ว
   * Discord cleanup หลังจากนี้เป็น
   * best-effort side effect
   */
  if (
    archived.forumThreadId
  ) {
    try {
      const thread =
        await interaction.client
          .channels.fetch(
            archived.forumThreadId,
          );

      if (
        thread &&
        thread.isThread()
      ) {
        await thread.delete(
          "NEXORA Marketplace - Shop financially archived",
        );
      }
    } catch (error) {
      forumDeleteFailed =
        true;

      console.error(
        "⚠️ Failed to delete archived Shop forum thread:",
        error,
      );
    }
  }

  if (interaction.guild) {
    try {
      const member =
        await interaction.guild
          .members.fetch(
            interaction.user.id,
          );

      const generalRole =
        await interaction.guild
          .roles.fetch(
            env.GENERAL_SELLER_ROLE_ID,
          );

      const verifiedRole =
        await interaction.guild
          .roles.fetch(
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

          `NEXORA Marketplace - Shop archived: ${shop.shopId}`,
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

          `NEXORA Marketplace - Shop archived: ${shop.shopId}`,
        );
      }
    } catch (error) {
      console.error(
        "⚠️ Failed to remove archived Shop seller roles:",
        error,
      );
    }
  }

  shopDraftService.delete(
    interaction.user.id,
  );

  const embed =
    new EmbedBuilder()
      .setColor(
        0x6b7280,
      )
      .setTitle(
        "🗄️ Archive ร้านค้าเรียบร้อย",
      )
      .setDescription(
        [
          `ร้าน **${shop.name}** ถูกนำออกจาก Marketplace แล้ว`,
          "",
          "✅ ปิดการรับ Order ใหม่",
          "✅ เก็บ Shop ID และประวัติทางการเงินไว้",
          "✅ Order / Payment / Refund / Ledger / Payout เดิมไม่ถูกลบ",
          "✅ ลบ Seller roles",
          forumDeleteFailed
            ? "⚠️ Forum cleanup ไม่สำเร็จ"
            : "✅ ลบ Forum thread",
          "",
          "💰 หากยังมียอดคงเหลือ คุณยังสามารถจัดการการถอนเงินจากหน้า Shop Management ได้",
          "",
          "ร้านที่ archive แล้วจะไม่ถูกเปิดกลับด้วยปุ่ม Reopen เดิม",
        ].join(
          "\n",
        ),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Financial History Preserved",
      })
      .setTimestamp();

  await interaction.editReply({
    content: "",
    embeds: [
      embed,
    ],
    components: [],
  });
}
