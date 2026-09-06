import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";
import { isShopOpenAt } from "../../services/shopHoursService.js";
import { reviewService } from "../../services/reviewService.js";

export const customId =
  "nexora_marketplace_product";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const productId =
    interaction.values[0];

  const product =
    await Product.findOne({
      productId,
      active: true,
      stock: {
        $gt: 0,
      },
    });

  if (!product) {
    if (
      interaction.message.flags.has(
        MessageFlags.Ephemeral,
      )
    ) {
      await interaction.update({
        content:
          "❌ สินค้านี้ไม่มีอยู่แล้ว หรือสินค้าหมด",
        embeds: [],
        components: [],
      });
    } else {
      await interaction.reply({
        content:
          "❌ สินค้านี้ไม่มีอยู่แล้ว หรือสินค้าหมด",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  const shop =
    await Shop.findOne({
      shopId: product.shopId,
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
          "❌ ร้านค้านี้ไม่พร้อมให้บริการในขณะนี้",
        embeds: [],
        components: [],
      });
    } else {
      await interaction.reply({
        content:
          "❌ ร้านค้านี้ไม่พร้อมให้บริการในขณะนี้",
        flags: MessageFlags.Ephemeral,
      });
    }
    return;
  }

  const shopStatus =
    isShopOpenAt(shop);

  const rating =
    shop.reviewCount > 0
      ? `⭐ ${shop.rating.toFixed(2)} / 5 (${shop.reviewCount.toLocaleString("th-TH")} รีวิว)`
      : "⭐ ยังไม่มีรีวิว";

  const reviews =
    await reviewService.getDisplayReviews(
      shop.shopId,
    );

  const embed =
    new EmbedBuilder()
      .setColor(
        shopStatus.open
          ? 0x8b5cf6
          : 0xed4245,
      )
      .setTitle(
        `📦 ${product.name}`,
      )
      .setDescription(
        [
          product.description ||
            "ไม่มีรายละเอียดสินค้า",
          "",
          shopStatus.open
            ? "🟢 **ร้านเปิดอยู่ — สามารถสั่งซื้อได้**"
            : "🔴 **ร้านปิดอยู่ — ขณะนี้ไม่สามารถสั่งซื้อได้**",
        ].join("\n"),
      )
      .addFields(
        {
          name: "🏪 ร้านค้า",
          value: `**${shop.name}**`,
          inline: true,
        },
        {
          name: "🛡️ ผู้ขาย",
          value: "🟢 Verified Seller",
          inline: true,
        },
        {
          name: "⭐ คะแนนร้าน",
          value: rating,
          inline: true,
        },
        {
          name: "💰 ราคา",
          value:
            `**฿${product.price.toLocaleString("th-TH")}**`,
          inline: true,
        },
        {
          name: "📦 Stock",
          value:
            product.stock.toLocaleString(
              "th-TH",
            ),
          inline: true,
        },
        {
          name: "🛒 ขายแล้ว",
          value:
            product.sold.toLocaleString(
              "th-TH",
            ),
          inline: true,
        },
        {
          name: "🕐 เวลาทำการ",
          value:
            shopStatus.schedule
              ? `${shopStatus.schedule.open} - ${shopStatus.schedule.close}`
              : "ปิดวันนี้",
          inline: true,
        },
        {
          name: "🆔 Product ID",
          value:
            `\`${product.productId}\``,
          inline: false,
        },
      );

  const displayReviews =
    reviews.display
      .slice(0, 20);

  if (
    displayReviews.length > 0
  ) {
    const positive =
      displayReviews
        .filter(
          (review: any) =>
            review.rating >= 4,
        )
        .slice(0, 10);

    const negative =
      displayReviews
        .filter(
          (review: any) =>
            review.rating <= 2,
        )
        .slice(0, 10);

    const neutral =
      displayReviews
        .filter(
          (review: any) =>
            review.rating === 3,
        )
        .slice(0, 5);

    if (positive.length) {
      embed.addFields({
        name: `👍 รีวิวเชิงบวก (${positive.length})`,
        value: makeReviewText(
          positive,
          900,
        ),
        inline: false,
      });
    }

    if (negative.length) {
      embed.addFields({
        name: `👎 รีวิวเชิงลบ (${negative.length})`,
        value: makeReviewText(
          negative,
          900,
        ),
        inline: false,
      });
    }

    if (
      neutral.length &&
      positive.length +
        negative.length <
        20
    ) {
      embed.addFields({
        name: `😐 รีวิวอื่น ๆ (${neutral.length})`,
        value: makeReviewText(
          neutral,
          900,
        ),
        inline: false,
      });
    }
  }

  embed
    .setFooter({
      text:
        "NEXORA Marketplace • Product Details",
    })
    .setTimestamp();

  const row =
    new ActionRowBuilder<ButtonBuilder>();

  if (shopStatus.open) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_product_buy:${product.productId}`,
        )
        .setLabel("ซื้อสินค้า")
        .setEmoji("🛒")
        .setStyle(
          ButtonStyle.Success,
        ),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(
        `nexora_marketplace_shop_products:${shop.shopId}`,
      )
      .setLabel("กลับสินค้าร้านนี้")
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
