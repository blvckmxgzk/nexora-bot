import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import {
  Shop,
} from "../../models/Shop.js";

import {
  TradeRequest,
} from "../../models/TradeRequest.js";

import {
  isShopOpenAt,
} from "../../services/shopHoursService.js";

export const customId =
  "nexora_shop_manage";

const statusNames:
  Record<
    string,
    string
  > = {
    pending:
      "⚪ Unverified Seller",

    verified:
      "🟢 Verified Seller",

    rejected:
      "🔴 ไม่ผ่านการตรวจสอบ",

    suspended:
      "⛔ ถูกระงับ",

    closed:
      "⚫ ปิดร้าน",
  };

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId:
        interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ คุณยังไม่มีร้านค้า",

      ephemeral:
        true,
    });

    return;
  }

  const [
    totalTrades,
    openTrades,
    completedTrades,
  ] =
    await Promise.all([
      TradeRequest
        .countDocuments({
          shopId:
            shop.shopId,
        }),

      TradeRequest
        .countDocuments({
          shopId:
            shop.shopId,

          status: {
            $in: [
              "waiting_seller",
              "contacted",
              "buyer_confirmed",
            ],
          },
        }),

      TradeRequest
        .countDocuments({
          shopId:
            shop.shopId,

          status:
            "completed",
        }),
    ]);

  if (
    shop.deletedAt
  ) {
    const embed =
      new EmbedBuilder()
        .setColor(
          0x6b7280,
        )
        .setTitle(
          `🗄️ ร้านถูก Archive • ${shop.name}`,
        )
        .setDescription(
          [
            `**Shop ID:** \`${shop.shopId}\``,
            "",
            "ร้านนี้ถูกนำออกจาก Marketplace แล้ว",
            "",
            `🤝 **Trade ทั้งหมด:** ${totalTrades}`,
            `✅ **Trade สำเร็จ:** ${completedTrades}`,
          ].join(
            "\n",
          ),
        )
        .setFooter({
          text:
            "NEXORA Marketplace v2 • Archived Shop",
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [
        embed,
      ],

      ephemeral:
        true,
    });

    return;
  }

  const shopStatus =
    isShopOpenAt(
      shop,
    );

  const hoursText =
    shopStatus.schedule
      ? [
          shopStatus.open
            ? "🟢 ร้านเปิดอยู่"
            : "🔴 ร้านปิดอยู่",

          `วันนี้: ${shopStatus.schedule.open} - ${shopStatus.schedule.close}`,

          `Timezone: ${shop.timezone ?? "Asia/Bangkok"}`,
        ].join(
          "\n",
        )
      : "🔴 วันนี้ร้านปิด";

  const embed =
    new EmbedBuilder()
      .setColor(
        shop.status ===
            "verified" &&
          shopStatus.open
          ? 0x22c55e
          : 0x5338e8,
      )
      .setTitle(
        `⚙️ จัดการร้านค้า • ${shop.name}`,
      )
      .setDescription(
        [
          `**Shop ID:** \`${shop.shopId}\``,
          `**สถานะ:** ${statusNames[shop.status] ?? shop.status}`,
          `**หมวดหมู่:** ${shop.category}`,
          "",
          `🤝 **Trade ทั้งหมด:** ${totalTrades}`,
          `⏳ **กำลังดำเนินการ:** ${openTrades}`,
          `✅ **สำเร็จ:** ${completedTrades}`,
          `⭐ **คะแนน:** ${shop.rating.toFixed(1)} (${shop.reviewCount} รีวิว)`,
          "",
          "**🕐 เวลาทำการ**",
          hoursText,
          "",
          "Buyer และ Seller ติดต่อและชำระกันโดยตรง",
        ].join(
          "\n",
        ),
      )
      .setFooter({
        text:
          "NEXORA Marketplace v2 • Trade Handoff",
      })
      .setTimestamp();

  const mainRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_edit",
          )
          .setLabel(
            "แก้ไขร้านค้า",
          )
          .setEmoji(
            "✏️",
          )
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_product_manage",
          )
          .setLabel(
            "จัดการสินค้า",
          )
          .setEmoji(
            "📦",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_hours",
          )
          .setLabel(
            "เวลาทำการ",
          )
          .setEmoji(
            "🕐",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  const actionRow =
    new ActionRowBuilder<ButtonBuilder>();

  if (
    shop.status ===
      "pending" ||
    shop.status ===
      "rejected"
  ) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          "nexora_shop_request_verification",
        )
        .setLabel(
          "ขอ Verified Seller",
        )
        .setEmoji(
          "🛡️",
        )
        .setStyle(
          ButtonStyle.Success,
        ),
    );
  }

  if (
    shop.status ===
      "pending" ||
    shop.status ===
      "verified" ||
    shop.status ===
      "rejected"
  ) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          "nexora_shop_close",
        )
        .setLabel(
          "ปิดร้าน",
        )
        .setEmoji(
          "🔒",
        )
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
  }

  if (
    shop.status ===
    "closed"
  ) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          "nexora_shop_reopen",
        )
        .setLabel(
          "เปิดร้านอีกครั้ง",
        )
        .setEmoji(
          "🔓",
        )
        .setStyle(
          ButtonStyle.Success,
        ),
    );
  }

  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(
        "nexora_shop_delete",
      )
      .setLabel(
        "Archive ร้านค้า",
      )
      .setEmoji(
        "🗑️",
      )
      .setStyle(
        ButtonStyle.Danger,
      ),
  );

  await interaction.reply({
    embeds: [
      embed,
    ],

    components: [
      mainRow,
      actionRow,
    ],

    ephemeral:
      true,
  });
}
