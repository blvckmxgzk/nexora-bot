import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type ButtonInteraction,
} from "discord.js";

export const customId =
  "nexora_marketplace";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🛍️ NEXORA Marketplace")
      .setDescription(
        [
          "ตลาดซื้อขายสินค้าของ NEXORA",
          "",
          "ค้นหาร้านค้าและสินค้าที่คุณสนใจได้จากเมนูด้านล่าง",
          "",
          "🛡️ **Verified Seller**",
          "ร้านค้าที่ผ่านการยืนยันจาก NEXORA",
          "",
          "💬 ซื้อขายผ่าน Discord DM โดยตรง",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace",
      })
      .setTimestamp();

  const typeMenu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "nexora_marketplace_type",
      )
      .setPlaceholder(
        "🛍️ เลือกสิ่งที่ต้องการค้นหา",
      )
      .addOptions(
        {
          label: "ร้านค้า",
          description:
            "ค้นหาและดูร้านค้า Verified",
          value: "shops",
          emoji: "🏪",
        },
        {
          label: "สินค้า",
          description:
            "ค้นหาสินค้าจาก Marketplace",
          value: "products",
          emoji: "📦",
        },
      );

  const categoryMenu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "nexora_marketplace_category",
      )
      .setPlaceholder(
        "🏷️ เลือกหมวดหมู่",
      )
      .addOptions(
        {
          label: "ทุกหมวดหมู่",
          value: "all",
          emoji: "🌐",
        },
        {
          label: "Game Top-up",
          value: "game_topup",
          emoji: "🎮",
        },
        {
          label: "Game Keys",
          value: "game_keys",
          emoji: "🔑",
        },
        {
          label: "Gift Cards",
          value: "gift_cards",
          emoji: "🎁",
        },
        {
          label: "Digital Services",
          value: "digital_services",
          emoji: "🛠️",
        },
        {
          label: "อื่น ๆ",
          value: "other",
          emoji: "📦",
        },
      );

  const searchRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_marketplace_search",
          )
          .setLabel("ค้นหา")
          .setEmoji("🔎")
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_marketplace_featured",
          )
          .setLabel("แนะนำ")
          .setEmoji("⭐")
          .setStyle(
            ButtonStyle.Success,
          ),
      );

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(typeMenu),

      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(categoryMenu),

      searchRow,
    ],
  });
}
