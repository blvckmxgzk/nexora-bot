import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import {
  searchMarketplace,
} from "../../services/marketplaceService.js";

export const customId =
  "nexora_marketplace_search_modal";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const query =
    interaction.fields
      .getTextInputValue("query")
      .trim();

  if (!query) {
    await interaction.reply({
      content:
        "❌ กรุณาระบุคำค้นหา",
      ephemeral: true,
    });
    return;
  }

  const result =
    await searchMarketplace({
      type: "products",
      query,
      page: 1,
    });

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        `🔎 ผลการค้นหา: ${query}`,
      );

  if (result.items.length === 0) {
    embed.setDescription(
      [
        "ไม่พบสินค้าที่ตรงกับคำค้นหา",
        "",
        "ลองใช้คำค้นหาอื่นดูได้เลย",
      ].join("\n"),
    );
  } else {
    embed.setDescription(
      result.items
        .map(
          (product: any) =>
            [
              `📦 **${product.name}**`,
              `💰 ฿${product.price.toLocaleString("th-TH")}`,
              `📦 Stock: ${product.stock}`,
              `🛒 ขายแล้ว: ${product.sold}`,
              `🏷️ ${product.category}`,
            ].join("\n"),
        )
        .join("\n\n"),
    );
  }

  embed.setFooter({
    text:
      `หน้า ${result.page} / ${result.totalPages} • NEXORA Marketplace`,
  });

  const row =
    new ActionRowBuilder<ButtonBuilder>();

  if (result.page < result.totalPages) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_marketplace_page:products:${result.page + 1}:search:${encodeURIComponent(query)}`,
        )
        .setLabel("ถัดไป")
        .setEmoji("➡️")
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

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
