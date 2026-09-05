import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from "discord.js";

import { Shop } from "../models/Shop.js";
import { Product } from "../models/Product.js";

const categoryNames: Record<string, string> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services: "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

function getStatus(
  status: string,
): {
  label: string;
  color: number;
  prefix: string;
} {
  switch (status) {
    case "verified":
      return {
        label: "🟢 **Verified Seller**",
        color: 0x22c55e,
        prefix: "🟢",
      };

    case "rejected":
      return {
        label: "🔴 **ถูกปฏิเสธ**",
        color: 0xef4444,
        prefix: "🔴",
      };

    case "suspended":
      return {
        label: "🚫 **ถูกระงับ**",
        color: 0x7f1d1d,
        prefix: "🚫",
      };

    case "closed":
      return {
        label: "⚫ **ร้านค้าปิดชั่วคราว**",
        color: 0x6b7280,
        prefix: "🔒",
      };

    case "pending":
    default:
      return {
        label: "🟡 **รอการตรวจสอบ**",
        color: 0xf59e0b,
        prefix: "🏪",
      };
  }
}

export async function updateShopForum(
  client: Client,
  shopId: string,
): Promise<void> {
  const shop = await Shop.findOne({
    shopId,
  });

  if (
    !shop ||
    !shop.forumThreadId
  ) {
    return;
  }

  const thread =
    await client.channels.fetch(
      shop.forumThreadId,
    );

  if (
    !thread ||
    !thread.isThread()
  ) {
    return;
  }

  const status =
    getStatus(shop.status);

  const productCount =
    await Product.countDocuments({
      shopId: shop.shopId,
      active: true,
      stock: { $gt: 0 },
    });

  const rating =
    shop.reviewCount > 0
      ? `${shop.rating.toFixed(1)} / 5 (${shop.reviewCount} รีวิว)`
      : "ยังไม่มีรีวิว";

  const embed =
    new EmbedBuilder()
      .setColor(status.color)
      .setTitle(
        `${status.prefix} ${shop.name}`,
      )
      .setDescription(
        shop.description ||
          "ไม่มีคำอธิบายร้าน",
      )
      .addFields(
        {
          name: "📂 หมวดหมู่",
          value:
            categoryNames[
              shop.category
            ] ?? shop.category,
          inline: true,
        },
        {
          name: "🛡️ สถานะ",
          value:
            status.label,
          inline: true,
        },
        {
          name: "👤 เจ้าของร้าน",
          value:
            `<@${shop.ownerId}>`,
          inline: true,
        },
        {
          name: "⭐ คะแนน",
          value: rating,
          inline: true,
        },
        {
          name: "📦 สินค้าพร้อมขาย",
          value:
            String(productCount),
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
          name: "🆔 Shop ID",
          value:
            `\`${shop.shopId}\``,
          inline: true,
        },
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Shop Information",
      })
      .setTimestamp();

  const components: ActionRowBuilder<ButtonBuilder>[] =
    [];

  /*
   * แสดงปุ่มดูสินค้าเฉพาะร้านที่ Verified
   *
   * สำคัญ:
   * ห้ามส่ง ActionRow ที่ไม่มี Button
   * เพราะ Discord จะตอบ:
   * BASE_TYPE_BAD_LENGTH
   */
  if (
    shop.status === "verified"
  ) {
    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_marketplace_shop_products:${shop.shopId}`,
            )
            .setLabel(
              "ดูสินค้า",
            )
            .setEmoji("📦")
            .setStyle(
              ButtonStyle.Primary,
            ),
        );

    components.push(row);
  }

  const starterMessage =
    await thread.fetchStarterMessage();

  if (starterMessage) {
    await starterMessage.edit({
      content:
        `## ${status.prefix} ${shop.name}\n\n` +
        `👤 เจ้าของ: <@${shop.ownerId}>\n` +
        `🆔 Shop ID: \`${shop.shopId}\``,
      embeds: [embed],
      components,
    });
  }

  const shouldArchive =
    shop.status === "closed" ||
    shop.status === "rejected" ||
    shop.status === "suspended";

  if (shouldArchive) {
    if (!thread.archived) {
      await thread.setArchived(
        true,
      );
    }
  } else if (
    thread.archived
  ) {
    await thread.setArchived(
      false,
    );
  }

  const prefix =
    shop.status === "verified"
      ? "🟢"
      : shop.status === "closed"
        ? "🔒"
        : shop.status === "rejected"
          ? "🔴"
          : shop.status === "suspended"
            ? "🚫"
            : "🏪";

  const desiredName =
    `${prefix} ${shop.name}`;

  if (
    thread.name !==
    desiredName
  ) {
    await thread.setName(
      desiredName,
    );
  }
}
