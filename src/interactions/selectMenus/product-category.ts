import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type StringSelectMenuInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { productDraftService } from "../../services/productDraftService.js";

const categoryNames: Record<string, string> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services: "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

const validCategories = new Set([
  "game_topup",
  "game_keys",
  "gift_cards",
  "digital_services",
  "other",
]);

export const customId =
  "nexora_product_category";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const category = interaction.values[0];

  if (!validCategories.has(category)) {
    await interaction.update({
      content:
        "❌ หมวดหมู่สินค้าไม่ถูกต้อง",
      embeds: [],
      components: [],
    });
    return;
  }

  const draft =
    productDraftService.setCategory(
      interaction.user.id,
      category as
        | "game_topup"
        | "game_keys"
        | "gift_cards"
        | "digital_services"
        | "other",
    );

  if (!draft) {
    await interaction.update({
      content:
        "❌ ข้อมูลสินค้า หมดอายุแล้ว\n\n" +
        "กรุณากด **➕ เพิ่มสินค้า** ใหม่อีกครั้ง",
      embeds: [],
      components: [],
    });
    return;
  }

  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    productDraftService.delete(
      interaction.user.id,
    );

    await interaction.update({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      embeds: [],
      components: [],
    });
    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("📦 ยืนยันการเพิ่มสินค้า")
      .setDescription(
        "ตรวจสอบข้อมูลสินค้าให้เรียบร้อยก่อนสร้างสินค้า",
      )
      .addFields(
        {
          name: "🏪 ร้านค้า",
          value: shop.name,
          inline: false,
        },
        {
          name: "📦 ชื่อสินค้า",
          value: draft.name,
          inline: false,
        },
        {
          name: "📝 รายละเอียด",
          value: draft.description,
          inline: false,
        },
        {
          name: "💰 ราคา",
          value:
            `฿${draft.price.toLocaleString("th-TH")}`,
          inline: true,
        },
        {
          name: "📊 Stock",
          value:
            draft.stock.toLocaleString("th-TH"),
          inline: true,
        },
        {
          name: "📂 หมวดหมู่",
          value:
            categoryNames[category] ?? category,
          inline: true,
        },
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Product Creation",
      })
      .setTimestamp();

  const confirm =
    new ButtonBuilder()
      .setCustomId(
        "nexora_product_confirm",
      )
      .setLabel("ยืนยันเพิ่มสินค้า")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success);

  const cancel =
    new ButtonBuilder()
      .setCustomId(
        "nexora_product_cancel",
      )
      .setLabel("ยกเลิก")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Secondary);

  await interaction.update({
    content: "",
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          confirm,
          cancel,
        ),
    ],
  });
}
