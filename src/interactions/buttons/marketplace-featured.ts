import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";

export const customId =
  "nexora_marketplace_featured";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shops =
    await Shop.find({
      status: "verified",
      completedOrders: {
        $gt: 0,
      },
    })
      .sort({
        rating: -1,
        completedOrders: -1,
        reviewCount: -1,
      })
      .limit(6);

  const embed =
    new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(
        "⭐ ร้านค้าแนะนำ",
      )
      .setDescription(
        shops.length
          ? shops
              .map(
                (shop) =>
                  [
                    `🏪 **${shop.name}**`,
                    `⭐ ${shop.rating.toFixed(2)} / 5 • ${shop.reviewCount} รีวิว`,
                    `🛒 ออเดอร์สำเร็จ: ${shop.completedOrders}`,
                    `🏷️ ${shop.category}`,
                  ].join("\n"),
              )
              .join("\n\n")
          : "ยังไม่มีร้านค้าที่มีประวัติการขายเพียงพอ",
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Featured Sellers",
      })
      .setTimestamp();

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_marketplace",
          )
          .setLabel("Marketplace")
          .setEmoji("🛍️")
          .setStyle(
            ButtonStyle.Primary,
          ),
      );

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [row],
  });
}
