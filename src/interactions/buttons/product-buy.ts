import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";
import { isShopOpenAt } from "../../services/shopHoursService.js";

export const customId =
  "nexora_product_buy:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const productId =
    interaction.customId.split(":")[1];

  if (!productId) {
    await interaction.reply({
      content: "❌ Product ID ไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  const product =
    await Product.findOne({
      productId,
      active: true,
      stock: {
        $gt: 0,
      },
    });

  if (!product) {
    await interaction.reply({
      content:
        "❌ สินค้านี้ไม่มีอยู่แล้ว หรือสินค้าหมด",
      ephemeral: true,
    });
    return;
  }

  const shop =
    await Shop.findOne({
      shopId: product.shopId,
      status: "verified",
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ร้านค้านี้ไม่พร้อมให้บริการ",
      ephemeral: true,
    });
    return;
  }

  if (shop.ownerId === interaction.user.id) {
    await interaction.reply({
      content:
        "❌ คุณไม่สามารถซื้อสินค้าจากร้านของตัวเองได้",
      ephemeral: true,
    });
    return;
  }

  const shopStatus =
    isShopOpenAt(shop);

  if (!shopStatus.open) {
    await interaction.reply({
      content:
        "🔴 ร้านปิดอยู่ในขณะนี้ ไม่สามารถสั่งซื้อได้",
      ephemeral: true,
    });
    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        `nexora_product_buy_modal:${product.productId}`,
      )
      .setTitle(
        "🛒 ซื้อสินค้า",
      );

  const quantityInput =
    new TextInputBuilder()
      .setCustomId("quantity")
      .setLabel("จำนวนสินค้า")
      .setPlaceholder(
        `กรอกจำนวน 1-${product.stock}`,
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(6);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        quantityInput,
      ),
  );

  await interaction.showModal(
    modal,
  );
}
