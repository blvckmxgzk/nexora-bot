import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { productService } from "../../services/productService.js";

export const customId =
  "nexora_product_create_modal";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
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
        "🚫 ร้านค้าของคุณไม่สามารถเพิ่มสินค้าได้ในขณะนี้",
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

  const priceRaw =
    interaction.fields
      .getTextInputValue(
        "product_price",
      )
      .trim();

  const stockRaw =
    interaction.fields
      .getTextInputValue(
        "product_stock",
      )
      .trim();

  const imageRaw =
    interaction.fields
      .getTextInputValue(
        "product_image",
      )
      .trim();

  const price =
    Number(priceRaw);

  const stock =
    Number(stockRaw);

  if (
    !Number.isFinite(price) ||
    price < 0
  ) {
    await interaction.reply({
      content:
        "❌ ราคาสินค้าไม่ถูกต้อง",
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
        "❌ จำนวนสินค้าไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  if (
    imageRaw &&
    !/^https?:\/\/\S+$/i.test(
      imageRaw,
    )
  ) {
    await interaction.reply({
      content:
        "❌ URL รูปสินค้าไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  try {
    const product =
      await productService.createProduct({
        shopId: shop.shopId,
        ownerId: shop.ownerId,
        name,
        description,
        price,
        category: shop.category,
        stock,
        imageUrl:
          imageRaw || null,
      });

    const embed =
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(
          "✅ เพิ่มสินค้าสำเร็จ",
        )
        .setDescription(
          `สินค้า **${product.name}** ถูกเพิ่มลงในร้านเรียบร้อยแล้ว`,
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
          {
            name: "🏪 ร้าน",
            value:
              shop.name,
            inline: true,
          },
          {
            name: "🟢 สถานะ",
            value:
              "เปิดขาย",
            inline: true,
          },
        );

    if (product.imageUrl) {
      embed.setThumbnail(
        product.imageUrl,
      );
    }

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              "nexora_product_list",
            )
            .setLabel(
              "ดูรายการสินค้า",
            )
            .setEmoji("📋")
            .setStyle(
              ButtonStyle.Primary,
            ),

          new ButtonBuilder()
            .setCustomId(
              "nexora_product_manage",
            )
            .setLabel("จัดการสินค้า")
            .setEmoji("📦")
            .setStyle(
              ButtonStyle.Secondary,
            ),
        );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    console.error(
      "❌ Failed to create product:",
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถเพิ่มสินค้าได้",
      ephemeral: true,
    });
  }
}
