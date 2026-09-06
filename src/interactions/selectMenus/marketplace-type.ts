import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";

import {
  searchMarketplace,
} from "../../services/marketplaceService.js";

export const customId =
  "nexora_marketplace_type";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const type =
    interaction.values[0];

  if (
    type !== "shops" &&
    type !== "products"
  ) {
    await interaction.reply({
      content:
        "❌ ประเภท Marketplace ไม่ถูกต้อง",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const result =
    await searchMarketplace({
      type,
      page: 1,
    });

  const embed =
    buildMarketplaceEmbed(
      type,
      result.items,
      result.page,
      result.totalPages,
    );

  const components: any[] = [];

  if (
    type === "shops" &&
    result.items.length > 0
  ) {
    const shopMenu =
      new StringSelectMenuBuilder()
        .setCustomId(
          "nexora_marketplace_shop",
        )
        .setPlaceholder(
          "🏪 เลือกร้านค้าที่ต้องการดู",
        )
        .addOptions(
          result.items.map(
            (shop: any) => ({
              label:
                shop.name.slice(
                  0,
                  100,
                ),
              description:
                `⭐ ${shop.rating.toFixed(2)} • ${shop.completedOrders} ออเดอร์สำเร็จ`
                  .slice(
                    0,
                    100,
                  ),
              value:
                shop.shopId,
              emoji: "🏪",
            }),
          ),
        );

    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          shopMenu,
        ),
    );
  }

  components.push(
    buildPagination(
      type,
      result.page,
      result.totalPages,
    ),
  );

  const payload = {
    content: "",
    embeds: [embed],
    components,
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

function buildMarketplaceEmbed(
  type: "shops" | "products",
  items: any[],
  page: number,
  totalPages: number,
) {
  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        type === "shops"
          ? "🏪 ร้านค้า Verified"
          : "📦 สินค้า Marketplace",
      );

  if (items.length === 0) {
    embed.setDescription(
      "ไม่พบรายการที่ตรงกับเงื่อนไข",
    );
  } else if (type === "shops") {
    embed.setDescription(
      items
        .map(
          (shop: any) =>
            [
              `🏪 **${shop.name}**`,
              `⭐ ${shop.rating.toFixed(2)} / 5 • ${shop.reviewCount} รีวิว`,
              `🛒 ออเดอร์สำเร็จ: ${shop.completedOrders}`,
              `🏷️ ${shop.category}`,
            ].join("\n"),
        )
        .join("\n\n"),
    );
  } else {
    embed.setDescription(
      items
        .map(
          (product: any) =>
            [
              `📦 **${product.name}**`,
              `💰 ฿${product.price.toLocaleString("th-TH")} • 📦 ${product.stock}`,
              `🛒 ขายแล้ว: ${product.sold}`,
              `🏷️ ${product.category}`,
            ].join("\n"),
        )
        .join("\n\n"),
    );
  }

  embed.setFooter({
    text:
      `หน้า ${page} / ${totalPages} • NEXORA Marketplace`,
  });

  embed.setTimestamp();

  return embed;
}

function buildPagination(
  type: "shops" | "products",
  page: number,
  totalPages: number,
) {
  const row =
    new ActionRowBuilder<ButtonBuilder>();

  if (page > 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_marketplace_page:${type}:${page - 1}`,
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
      .setLabel("ปิด")
      .setEmoji("✖️")
      .setStyle(
        ButtonStyle.Secondary,
      ),
  );

  if (page < totalPages) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_marketplace_page:${type}:${page + 1}`,
        )
        .setLabel("ถัดไป")
        .setEmoji("➡️")
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
  }

  return row;
}
