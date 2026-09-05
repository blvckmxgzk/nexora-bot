import {
  type ModalSubmitInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { updateShopForum } from "../../services/shopForumService.js";

type ShopCategory =
  | "game_topup"
  | "game_keys"
  | "gift_cards"
  | "digital_services"
  | "other";

const validCategories =
  new Set<ShopCategory>([
    "game_topup",
    "game_keys",
    "gift_cards",
    "digital_services",
    "other",
  ]);

const categoryNames: Record<
  ShopCategory,
  string
> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services:
    "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

export const customId =
  "nexora_shop_edit_modal";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId:
        interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });
    return;
  }

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.reply({
      content:
        "❌ ไม่สามารถแก้ไขร้านค้าในสถานะนี้ได้",
      ephemeral: true,
    });
    return;
  }

  const name =
    interaction.fields
      .getTextInputValue(
        "shop_name",
      )
      .trim();

  const description =
    interaction.fields
      .getTextInputValue(
        "shop_description",
      )
      .trim();

  const categoryInput =
    interaction.fields
      .getTextInputValue(
        "shop_category",
      )
      .trim()
      .toLowerCase();

  if (
    !validCategories.has(
      categoryInput as ShopCategory,
    )
  ) {
    await interaction.reply({
      content:
        "❌ หมวดหมู่ไม่ถูกต้อง\n\n" +
        "`game_topup` — Game Top-up\n" +
        "`game_keys` — Game Keys\n" +
        "`gift_cards` — Gift Cards\n" +
        "`digital_services` — Digital Services\n" +
        "`other` — อื่น ๆ",
      ephemeral: true,
    });
    return;
  }

  const category =
    categoryInput as ShopCategory;

  shop.name = name;
  shop.description =
    description;
  shop.category = category;

  await shop.save();

  try {
    await updateShopForum(
      interaction.client,
      shop.shopId,
    );
  } catch (error) {
    console.error(
      "⚠️ Failed to sync shop forum after edit:",
      error,
    );
  }

  await interaction.reply({
    content:
      "✅ **แก้ไขข้อมูลร้านสำเร็จ**\n\n" +
      `🏪 ชื่อร้าน: **${shop.name}**\n` +
      `📂 หมวดหมู่: **${categoryNames[category]}**\n\n` +
      "ข้อมูลใน Marketplace และ Forum ถูกอัปเดตแล้ว",
    ephemeral: true,
  });
}
