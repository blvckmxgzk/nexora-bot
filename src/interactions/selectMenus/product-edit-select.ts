import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type StringSelectMenuInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";

export const customId =
  "nexora_product_edit_select";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const productId = interaction.values[0];

  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    await interaction.update({
      content: "❌ ไม่พบร้านค้าของคุณ",
      components: [],
    });
    return;
  }

  const product =
    await Product.findOne({
      productId,
      shopId: shop.shopId,
      ownerId: interaction.user.id,
    });

  if (!product) {
    await interaction.update({
      content:
        "❌ ไม่พบสินค้านี้ หรือสินค้านี้ไม่ใช่ของคุณ",
      components: [],
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_product_edit_modal:${product.productId}`,
      )
      .setTitle("✏️ แก้ไขสินค้า");

  const nameInput =
    new TextInputBuilder()
      .setCustomId("product_name")
      .setLabel("ชื่อสินค้า")
      .setValue(product.name)
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(100)
      .setRequired(true);

  const descriptionInput =
    new TextInputBuilder()
      .setCustomId("product_description")
      .setLabel("รายละเอียดสินค้า")
      .setValue(product.description)
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(2)
      .setMaxLength(1000)
      .setRequired(true);

  const priceInput =
    new TextInputBuilder()
      .setCustomId("product_price")
      .setLabel("ราคา (บาท)")
      .setValue(String(product.price))
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

  const stockInput =
    new TextInputBuilder()
      .setCustomId("product_stock")
      .setLabel("Stock")
      .setValue(String(product.stock))
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

  const activeInput =
    new TextInputBuilder()
      .setCustomId("product_active")
      .setLabel("เปิดขายหรือไม่ (yes / no)")
      .setValue(product.active ? "yes" : "no")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(nameInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(descriptionInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(priceInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(stockInput),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(activeInput),
  );

  await interaction.showModal(modal);
}
