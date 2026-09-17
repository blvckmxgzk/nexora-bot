import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import {
  marketplaceV2Service,
} from "../../services/marketplace/marketplaceV2Service.js";

export const customId =
  "nexora_trade:";

function buildReviewModal(
  requestId:
    string,
) {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_trade_review_modal:${requestId}`,
      )
      .setTitle(
        "⭐ รีวิวร้านค้า",
      );

  const rating =
    new TextInputBuilder()
      .setCustomId(
        "rating",
      )
      .setLabel(
        "คะแนน 1–5 ดาว",
      )
      .setPlaceholder(
        "5",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMinLength(
        1,
      )
      .setMaxLength(
        1,
      )
      .setRequired(
        true,
      );

  const comment =
    new TextInputBuilder()
      .setCustomId(
        "comment",
      )
      .setLabel(
        "ความคิดเห็น (ไม่บังคับ)",
      )
      .setPlaceholder(
        "ประสบการณ์ซื้อขายของคุณ",
      )
      .setStyle(
        TextInputStyle.Paragraph,
      )
      .setMaxLength(
        1000,
      )
      .setRequired(
        false,
      );

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        rating,
      ),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        comment,
      ),
  );

  return modal;
}

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  const [
    namespace,
    action,
    requestId,
  ] =
    interaction.customId
      .split(
        ":",
      );

  if (
    namespace !==
      "nexora_trade" ||
    !action ||
    !requestId
  ) {
    await interaction.reply({
      content:
        "❌ Trade action ไม่ถูกต้อง",

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  if (
    action ===
    "review"
  ) {
    await interaction.showModal(
      buildReviewModal(
        requestId,
      ),
    );

    return;
  }

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  try {
    if (
      action ===
      "seller_contacted"
    ) {
      await marketplaceV2Service
        .sellerContacted(
          interaction.client,
          requestId,
          interaction.user.id,
        );

      await interaction.editReply({
        content:
          "✅ บันทึกว่าคุณติดต่อ Buyer แล้ว",
      });

      return;
    }

    if (
      action ===
      "buyer_confirm"
    ) {
      await marketplaceV2Service
        .buyerConfirm(
          interaction.client,
          requestId,
          interaction.user.id,
        );

      await interaction.editReply({
        content:
          "✅ ยืนยันแล้ว • กำลังรอ Seller ยืนยันขั้นสุดท้าย",
      });

      return;
    }

    if (
      action ===
      "seller_complete"
    ) {
      await marketplaceV2Service
        .sellerComplete(
          interaction.client,
          requestId,
          interaction.user.id,
        );

      await interaction.editReply({
        content:
          "🎉 Trade เสร็จสมบูรณ์แล้ว",
      });

      return;
    }

    if (
      action ===
      "cancel"
    ) {
      await marketplaceV2Service
        .cancel(
          interaction.client,
          requestId,
          interaction.user.id,
        );

      await interaction.editReply({
        content:
          "❌ ยกเลิก Trade Request แล้ว",
      });

      return;
    }

    if (
      action ===
      "issue"
    ) {
      await marketplaceV2Service
        .reportIssue(
          interaction.client,
          requestId,
          interaction.user.id,
        );

      await interaction.editReply({
        content: [
          "⚠️ บันทึกว่า Trade มีปัญหาแล้ว",
          "",
          "แนะนำให้เปิด Ticket เพื่อแจ้งให้แอดมินทราบจะดีกว่า",
        ].join(
          "\n",
        ),
      });

      return;
    }

    throw new Error(
      "ไม่รู้จัก Trade action นี้",
    );
  } catch (
    error
  ) {
    await interaction.editReply({
      content:
        `❌ ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
