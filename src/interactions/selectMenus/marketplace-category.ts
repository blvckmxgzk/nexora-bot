import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";

import {
  searchMarketplace,
} from "../../services/marketplaceService.js";

export const customId =
  "nexora_marketplace_category";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const category =
    interaction.values[0];

  const type =
    "products" as const;

  const result =
    await searchMarketplace({
      type,
      category:
        category === "all"
          ? undefined
          : category,
      page: 1,
    });

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        category === "all"
          ? "📦 สินค้าทั้งหมด"
          : `🏷️ ${category}`,
      )
      .setDescription(
        result.items.length
          ? result.items
              .map(
                (product: any) =>
                  [
                    `📦 **${product.name}**`,
                    `💰 ฿${product.price.toLocaleString("th-TH")}`,
                    `📦 Stock: ${product.stock}`,
                    `🛒 ขายแล้ว: ${product.sold}`,
                  ].join("\n"),
              )
              .join("\n\n")
          : "ไม่พบสินค้าในหมวดหมู่นี้",
      )
      .setFooter({
        text:
          `หน้า ${result.page} / ${result.totalPages}`,
      });

  const row =
    new ActionRowBuilder<ButtonBuilder>();

  if (
    result.totalPages > 1
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_marketplace_page:products:2`,
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

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [row],
  });
}
