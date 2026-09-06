import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";
import { isShopOpenAt } from "../../services/shopHoursService.js";

export const customId =
  "nexora_marketplace_shop:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shopId =
    interaction.customId.split(":")[1];

  if (!shopId) {
    await interaction.reply({
      content:
        "❌ Shop ID ไม่ถูกต้อง",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const shop =
    await Shop.findOne({
      shopId,
      status: "verified",
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้านี้ หรือร้านค้านี้ไม่ได้เป็น Verified Seller แล้ว",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const status =
    isShopOpenAt(shop);

  const productCount =
    await Product.countDocuments({
      shopId: shop.shopId,
      active: true,
      stock: {
        $gt: 0,
      },
    });

  const rating =
    shop.reviewCount > 0
      ? `⭐ ${shop.rating.toFixed(2)} / 5 (${shop.reviewCount.toLocaleString("th-TH")} รีวิว)`
      : "⭐ ยังไม่มีรีวิว";

  const embed =
    new EmbedBuilder()
      .setColor(
        status.open
          ? 0x8b5cf6
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
          status.open
            ? "🟢 **ร้านเปิดอยู่ — สามารถสั่งซื้อได้**"
            : "🔴 **ร้านปิดอยู่ — ไม่สามารถสั่งซื้อได้ในขณะนี้**",
        ].join("\n"),
      )
      .addFields(
        {
          name: "🛡️ สถานะร้าน",
          value:
            "🟢 Verified Seller",
          inline: true,
        },
        {
          name: "⭐ คะแนนร้าน",
          value: rating,
          inline: true,
        },
        {
          name: "🏷️ หมวดหมู่",
          value:
            shop.category ||
            "ทั่วไป",
          inline: true,
        },
        {
          name: "📦 สินค้าพร้อมขาย",
          value:
            productCount.toLocaleString(
              "th-TH",
            ),
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
          name: "🕐 เวลาทำการ",
          value:
            status.schedule
              ? `${status.schedule.open} - ${status.schedule.close}`
              : "ปิดวันนี้",
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
          "NEXORA Marketplace • Shop",
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
