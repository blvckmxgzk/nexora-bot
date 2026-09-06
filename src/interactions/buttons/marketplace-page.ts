import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import {
  searchMarketplace,
} from "../../services/marketplaceService.js";

export const customId =
  "nexora_marketplace_page:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const parts =
    interaction.customId.split(":");

  const type =
    parts[1];

  const page =
    Number(parts[2]);

  const mode =
    parts[3];

  const query =
    mode === "search" &&
    parts[4]
      ? decodeURIComponent(parts[4])
      : undefined;

  if (
    type !== "shops" &&
    type !== "products"
  ) {
    await interaction.reply({
      content:
        "❌ ประเภท Marketplace ไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  if (
    !Number.isInteger(page) ||
    page < 1
  ) {
    await interaction.reply({
      content:
        "❌ หน้ารายการไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  const result =
    await searchMarketplace({
      type,
      query,
      page,
    });

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        type === "shops"
          ? "🏪 ร้านค้า Verified"
          : "📦 สินค้า Marketplace",
      );

  if (
    query
  ) {
    embed.setDescription(
      [
        `🔎 คำค้นหา: **${query}**`,
        "",
        result.items.length
          ? result.items
              .map(
                (item: any) =>
                  type === "shops"
                    ? [
                        `🏪 **${item.name}**`,
                        `⭐ ${item.rating.toFixed(2)} / 5`,
                        `🛒 สำเร็จ ${item.completedOrders} ออเดอร์`,
                      ].join("\n")
                    : [
                        `📦 **${item.name}**`,
                        `💰 ฿${item.price.toLocaleString("th-TH")}`,
                        `📦 Stock: ${item.stock}`,
                        `🛒 ขายแล้ว: ${item.sold}`,
                      ].join("\n"),
              )
              .join("\n\n")
          : "ไม่พบรายการ",
      ].join("\n"),
    );
  } else {
    embed.setDescription(
      result.items.length
        ? result.items
            .map(
              (item: any) =>
                type === "shops"
                  ? [
                      `🏪 **${item.name}**`,
                      `⭐ ${item.rating.toFixed(2)} / 5 • ${item.reviewCount} รีวิว`,
                      `🛒 สำเร็จ ${item.completedOrders} ออเดอร์`,
                    ].join("\n")
                  : [
                      `📦 **${item.name}**`,
                      `💰 ฿${item.price.toLocaleString("th-TH")}`,
                      `📦 Stock: ${item.stock}`,
                      `🛒 ขายแล้ว: ${item.sold}`,
                    ].join("\n"),
            )
            .join("\n\n")
        : "ไม่พบรายการ",
    );
  }

  embed.setFooter({
    text:
      `หน้า ${result.page} / ${result.totalPages} • NEXORA Marketplace`,
  });

  const row =
    new ActionRowBuilder<ButtonBuilder>();

  if (result.page > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_marketplace_page:${type}:${result.page - 1}${
            query
              ? `:search:${encodeURIComponent(query)}`
              : ""
          }`,
        )
        .setLabel("ก่อนหน้า")
        .setEmoji("⬅️")
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
  }

  row.addComponents(
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

  if (
    result.page <
    result.totalPages
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_marketplace_page:${type}:${result.page + 1}${
            query
              ? `:search:${encodeURIComponent(query)}`
              : ""
          }`,
        )
        .setLabel("ถัดไป")
        .setEmoji("➡️")
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
  }

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [row],
  });
}
