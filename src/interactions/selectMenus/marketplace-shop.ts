import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { isShopOpenAt } from "../../services/shopHoursService.js";

export const customId =
  "nexora_marketplace_shop";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const shopId =
    interaction.values[0];

  if (!shopId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Shop ID",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const shop =
    await Shop.findOne({
      shopId,
      status: {
        $in: [
          "pending",
          "verified",
        ],
      },
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ร้านค้านี้ไม่มีอยู่แล้ว หรือไม่ได้เป็น Verified Seller",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const status =
    isShopOpenAt(shop);

  const rating =
    shop.reviewCount > 0
      ? `⭐ ${shop.rating.toFixed(2)} / 5 (${shop.reviewCount.toLocaleString("th-TH")} รีวิว)`
      : "⭐ ยังไม่มีรีวิว";

  const scheduleText =
    status.schedule
      ? `${status.schedule.open} - ${status.schedule.close}`
      : "ปิดวันนี้";

  const embed =
    new EmbedBuilder()
      .setColor(
        status.open
          ? 0x57f287
          : 0xed4245,
      )
      .setTitle(
        `🏪 ${shop.name}`,
      )
      .setDescription(
        [
          shop.description ||
            "ร้านค้านี้ยังไม่มีคำอธิบาย",
          "",
          "🛡️ **Verified Seller**",
          status.open
            ? "🟢 **ร้านเปิดอยู่**"
            : "🔴 **ร้านปิดอยู่**",
        ].join("\n"),
      )
      .addFields(
        {
          name: "⭐ คะแนนร้าน",
          value: rating,
          inline: true,
        },
        {
          name: "🛒 ออเดอร์สำเร็จ",
          value:
            shop.completedOrders.toLocaleString(
              "th-TH",
            ),
          inline: true,
        },
        {
          name: "📦 ออเดอร์ทั้งหมด",
          value:
            shop.totalOrders.toLocaleString(
              "th-TH",
            ),
          inline: true,
        },
        {
          name: "🏷️ หมวดหมู่",
          value:
            `\`${shop.category}\``,
          inline: true,
        },
        {
          name: "🕐 เวลาทำการ",
          value: scheduleText,
          inline: true,
        },
        {
          name: "🌏 Timezone",
          value:
            shop.timezone ||
            "Asia/Bangkok",
          inline: true,
        },
        {
          name: "🆔 Shop ID",
          value:
            `\`${shop.shopId}\``,
          inline: false,
        },
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Shop Details",
      })
      .setTimestamp();

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `nexora_marketplace_shop_products:${shop.shopId}`,
          )
          .setLabel("ดูสินค้า")
          .setEmoji("📦")
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `nexora_marketplace_shop_reviews:${shop.shopId}`,
          )
          .setLabel("รีวิวร้าน")
          .setEmoji("⭐")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.reply({
    content: "",
    embeds: [embed],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}
