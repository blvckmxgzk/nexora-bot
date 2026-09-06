import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";
import { orderService } from "../../services/orderService.js";
import { isShopOpenAt } from "../../services/shopHoursService.js";

export const customId =
  "nexora_product_buy_modal:";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const productId =
    interaction.customId.split(":")[1];

  if (!productId) {
    await interaction.reply({
      content:
        "❌ Product ID ไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  const rawQuantity =
    interaction.fields
      .getTextInputValue(
        "quantity",
      )
      .trim();

  const quantity =
    Number(rawQuantity);

  if (
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    await interaction.reply({
      content:
        "❌ จำนวนสินค้าต้องเป็นจำนวนเต็มอย่างน้อย 1",
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

  if (
    quantity >
    product.stock
  ) {
    await interaction.reply({
      content:
        `❌ สินค้าเหลือเพียง ${product.stock.toLocaleString("th-TH")} ชิ้น`,
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

  if (
    shop.ownerId ===
    interaction.user.id
  ) {
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
        "🔴 ร้านปิดอยู่ในขณะนี้",
      ephemeral: true,
    });
    return;
  }

  try {
    const order =
      await orderService.createOrder({
        buyerId:
          interaction.user.id,
        sellerId:
          shop.ownerId,
        shopId:
          shop.shopId,
        productId:
          product.productId,
        productName:
          product.name,
        quantity,
        unitPrice:
          product.price,
      });

    const total =
      order.totalAmount;

    const embed =
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(
          "🧾 สร้างคำสั่งซื้อแล้ว",
        )
        .setDescription(
          [
            "กรุณาเลือกช่องทางการชำระเงิน",
            "",
            `📦 **สินค้า:** ${product.name}`,
            `🔢 **จำนวน:** ${quantity.toLocaleString("th-TH")}`,
            `💰 **ราคาต่อชิ้น:** ฿${product.price.toLocaleString("th-TH")}`,
            `💵 **ยอดรวม:** ฿${total.toLocaleString("th-TH")}`,
            "",
            `🧾 **Order ID:** \`${order.orderId}\``,
            "",
            "⚠️ สินค้าถูกกัน Stock ไว้สำหรับคำสั่งซื้อนี้แล้ว",
          ].join("\n"),
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Checkout",
        })
        .setTimestamp();

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_payment_create:promptpay:${order.orderId}`,
            )
            .setLabel(
              "PromptPay",
            )
            .setEmoji("📱")
            .setStyle(
              ButtonStyle.Success,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_payment_create:truemoney:${order.orderId}`,
            )
            .setLabel(
              "TrueMoney",
            )
            .setEmoji("💳")
            .setStyle(
              ButtonStyle.Primary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_order_cancel:${order.orderId}`,
            )
            .setLabel(
              "ยกเลิก",
            )
            .setEmoji("❌")
            .setStyle(
              ButtonStyle.Danger,
            ),
        );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถสร้างคำสั่งซื้อได้",
      ephemeral: true,
    });
  }
}
