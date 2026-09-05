import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_edit_modal:";

export async function execute(
  interaction: ModalSubmitInteraction,
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

  const name =
    interaction.fields
      .getTextInputValue(
        "product_name",
      )
      .trim();

  const description =
    interaction.fields
      .getTextInputValue(
        "product_description",
      )
      .trim();

  const price =
    Number(
      interaction.fields
        .getTextInputValue(
          "product_price",
        )
        .trim(),
    );

  const stock =
    Number(
      interaction.fields
        .getTextInputValue(
          "product_stock",
        )
        .trim(),
    );

  const image =
    interaction.fields
      .getTextInputValue(
        "product_image",
      )
      .trim();

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    await interaction.reply({
      content:
        "❌ ราคาไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  if (
    !Number.isInteger(stock) ||
    stock < 0
  ) {
    await interaction.reply({
      content:
        "❌ Stock ต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป",
      ephemeral: true,
    });
    return;
  }

  if (
    image &&
    !/^https?:\/\/\S+$/i.test(
      image,
    )
  ) {
    await interaction.reply({
      content:
        "❌ URL รูปสินค้าไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  product.name = name;
  product.description =
    description;
  product.price = price;
  product.stock = stock;
  product.imageUrl =
    image || null;

  await product.save();

  const embed =
    new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle(
        "✅ แก้ไขสินค้าสำเร็จ",
      )
      .setDescription(
        `สินค้า **${product.name}** ถูกอัปเดตเรียบร้อยแล้ว`,
      )
      .addFields(
        {
          name: "🆔 Product ID",
          value:
            `\`${product.productId}\``,
          inline: true,
        },
        {
          name: "💰 ราคา",
          value:
            `฿${product.price.toLocaleString("th-TH")}`,
          inline: true,
        },
        {
          name: "📦 Stock",
          value:
            String(product.stock),
          inline: true,
        },
      );

  if (product.imageUrl) {
    embed.setThumbnail(
      product.imageUrl,
    );
  }

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
