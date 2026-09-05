import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_edit:";

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

  const product =
    await Product.findOne({
      productId,
      ownerId: interaction.user.id,
    });

  if (!product) {
    await interaction.reply({
      content:
        "❌ ไม่พบสินค้านี้ หรือสินค้านี้ไม่ใช่ของคุณ",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_product_edit_modal:${product.productId}`,
      )
      .setTitle(
        "✏️ แก้ไขสินค้า",
      );

  const name =
    new TextInputBuilder()
      .setCustomId("product_name")
      .setLabel("ชื่อสินค้า")
      .setValue(product.name)
      .setStyle(
        TextInputStyle.Short,
      )
      .setMinLength(2)
      .setMaxLength(100)
      .setRequired(true);

  const description =
    new TextInputBuilder()
      .setCustomId(
        "product_description",
      )
      .setLabel("รายละเอียดสินค้า")
      .setValue(
        product.description ||
          "",
      )
      .setStyle(
        TextInputStyle.Paragraph,
      )
      .setMinLength(5)
      .setMaxLength(1000)
      .setRequired(true);

  const price =
    new TextInputBuilder()
      .setCustomId("product_price")
      .setLabel("ราคา")
      .setValue(
        String(product.price),
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setRequired(true);

  const stock =
    new TextInputBuilder()
      .setCustomId("product_stock")
      .setLabel("Stock")
      .setValue(
        String(product.stock),
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setRequired(true);

  const image =
    new TextInputBuilder()
      .setCustomId("product_image")
      .setLabel("URL รูปสินค้า")
      .setValue(
        product.imageUrl ||
          "",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(500)
      .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(name),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(description),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(price),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(stock),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(image),
  );

  await interaction.showModal(
    modal,
  );
}
