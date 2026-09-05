import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { shopDraftService } from "../../services/shopDraftService.js";

export const customId = "nexora_shop_create_modal";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const name =
    interaction.fields
      .getTextInputValue("shop_name")
      .trim();

  const description =
    interaction.fields
      .getTextInputValue("shop_description")
      .trim();

  shopDraftService.set({
    ownerId: interaction.user.id,
    name,
    description,
  });

  const categoryMenu =
    new StringSelectMenuBuilder()
      .setCustomId("nexora_shop_category")
      .setPlaceholder("📂 เลือกหมวดหมู่ร้านค้าของคุณ")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Game Top-up")
          .setDescription("บริการเติมเกมและไอเทมในเกม")
          .setValue("game_topup")
          .setEmoji("🎮"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Game Keys")
          .setDescription("คีย์เกมและโค้ดสำหรับเกม")
          .setValue("game_keys")
          .setEmoji("🔑"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Gift Cards")
          .setDescription("บัตรของขวัญและบัตรเติมเงิน")
          .setValue("gift_cards")
          .setEmoji("🎁"),

        new StringSelectMenuOptionBuilder()
          .setLabel("Digital Services")
          .setDescription("บริการดิจิทัลต่าง ๆ")
          .setValue("digital_services")
          .setEmoji("🛠️"),

        new StringSelectMenuOptionBuilder()
          .setLabel("อื่น ๆ")
          .setDescription("สินค้าและบริการประเภทอื่น")
          .setValue("other")
          .setEmoji("📦"),
      );

  const row =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(categoryMenu);

  await interaction.reply({
    content:
      "📂 **เลือกหมวดหมู่ร้านค้าของคุณ**\n\n" +
      `🏪 ชื่อร้าน: **${name}**\n` +
      "📝 รายละเอียดถูกบันทึกไว้แล้ว\n\n" +
      "กรุณาเลือกหมวดหมู่จากรายการด้านล่าง",
    components: [row],
    ephemeral: true,
  });
}
