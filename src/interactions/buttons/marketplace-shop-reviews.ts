import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { reviewService } from "../../services/reviewService.js";

export const customId =
  "nexora_marketplace_shop_reviews:";

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
    if (
      interaction.message.flags.has(
        MessageFlags.Ephemeral,
      )
    ) {
      await interaction.update({
        content:
          "❌ ไม่พบร้านค้านี้",
        embeds: [],
        components: [],
      });
    } else {
      await interaction.reply({
        content:
          "❌ ไม่พบร้านค้านี้",
        flags: MessageFlags.Ephemeral,
      });
    }

    return;
  }

  const reviews =
    await reviewService.getDisplayReviews(
      shop.shopId,
    );

  const embed =
    new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(
        `⭐ รีวิวร้าน ${shop.name}`,
      )
      .setDescription(
        shop.reviewCount > 0
          ? [
              `คะแนนเฉลี่ย: **${shop.rating.toFixed(2)} / 5**`,
              `รีวิวทั้งหมด: **${shop.reviewCount.toLocaleString("th-TH")}**`,
            ].join("\n")
          : "ร้านนี้ยังไม่มีรีวิว",
      );

  const display =
    reviews.display.slice(0, 20);

  if (display.length > 0) {
    embed.addFields({
      name:
        `💬 รีวิวล่าสุด (${display.length})`,
      value:
        makeReviewText(
          display,
          900,
        ),
      inline: false,
    });
  }

  embed
    .setFooter({
      text:
        "NEXORA Marketplace • Shop Reviews",
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
            `nexora_marketplace_shop:${shop.shopId}`,
          )
          .setLabel("กลับหน้าร้าน")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  const payload = {
    content: "",
    embeds: [embed],
    components: [row],
  };

  if (
    interaction.message.flags.has(
      MessageFlags.Ephemeral,
    )
  ) {
    await interaction.update(
      payload,
    );

    return;
  }

  await interaction.reply({
    ...payload,
    flags: MessageFlags.Ephemeral,
  });
}

function makeReviewText(
  reviews: any[],
  maxLength: number,
): string {
  const lines: string[] = [];
  let length = 0;

  for (const review of reviews) {
    const stars =
      "⭐".repeat(
        Math.max(
          1,
          Math.min(
            5,
            review.rating,
          ),
        ),
      );

    const comment =
      review.comment?.trim() ||
      "ไม่มีข้อความ";

    const line =
      `${stars} — ${comment}`;

    if (
      length +
        line.length +
        1 >
      maxLength
    ) {
      break;
    }

    lines.push(line);
    length +=
      line.length + 1;
  }

  return (
    lines.join("\n") ||
    "ไม่มีข้อความรีวิว"
  );
}
