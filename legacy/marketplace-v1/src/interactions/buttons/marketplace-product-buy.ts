import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

export const customId =
  "nexora_marketplace_product_buy:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const productId =
    interaction.customId.split(":")[1];

  if (!productId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Product ID",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_marketplace_product_buy_modal:${productId}`,
      )
      .setTitle(
        "🛒 สั่งซื้อสินค้า",
      );

  const quantity =
    new TextInputBuilder()
      .setCustomId(
        "quantity",
      )
      .setLabel(
        "จำนวนสินค้า",
      )
      .setPlaceholder(
        "เช่น 1",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMinLength(1)
      .setMaxLength(6)
      .setValue("1")
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(quantity),
  );

  await interaction.showModal(
    modal,
  );
}
