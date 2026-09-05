import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

export const customId = "nexora_shop_browse";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🛍️ NEXORA Marketplace")
      .setDescription(
        [
          "**ศูนย์กลางซื้อขายสินค้าและบริการดิจิทัล**",
          "",
          "เลือกหมวดหมู่ที่คุณต้องการค้นหา",
          "",
          "🎮 **Game Top-up**",
          "เติมเกมและไอเทมในเกม",
          "",
          "🔑 **Game Keys**",
          "คีย์เกมและโค้ดเกม",
          "",
          "🎁 **Gift Cards**",
          "บัตรของขวัญและบัตรเติมเงิน",
          "",
          "🛠️ **Digital Services**",
          "บริการดิจิทัลต่าง ๆ",
          "",
          "📦 **อื่น ๆ**",
          "สินค้าและบริการประเภทอื่น",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Browse Shops",
      })
      .setTimestamp();

  const menu =
    new StringSelectMenuBuilder()
      .setCustomId(
        "nexora_marketplace_category",
      )
      .setPlaceholder(
        "📂 เลือกหมวดหมู่ Marketplace",
      )
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Game Top-up")
          .setDescription(
            "เติมเกมและไอเทมในเกม",
          )
          .setValue("game_topup")
          .setEmoji("🎮"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Game Keys")
          .setDescription(
            "คีย์เกมและโค้ดเกม",
          )
          .setValue("game_keys")
          .setEmoji("🔑"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Gift Cards")
          .setDescription(
            "บัตรของขวัญและบัตรเติมเงิน",
          )
          .setValue("gift_cards")
          .setEmoji("🎁"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Digital Services")
          .setDescription(
            "บริการดิจิทัล",
          )
          .setValue("digital_services")
          .setEmoji("🛠️"),

        new StringSelectMenuOptionBuilder()
          .setLabel("อื่น ๆ")
          .setDescription(
            "สินค้าและบริการอื่น ๆ",
          )
          .setValue("other")
          .setEmoji("📦"),
      );

  const row =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(menu);

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
