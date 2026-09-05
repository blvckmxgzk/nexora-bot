import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Product } from "../../models/Product.js";
import { Shop } from "../../models/Shop.js";
import { orderService } from "../../services/orderService.js";

export const customId =
  "nexora_product_buy:";

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
      active: true,
      stock: { $gt: 0 },
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
      quantity: 1,
      unitPrice:
        product.price,
    });

  const embed =
    new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle("🛒 สร้างคำสั่งซื้อแล้ว")
      .setDescription(
        [
          `📦 **${product.name}**`,
          "",
          "ระบบสร้าง Order ให้คุณแล้ว",
          "ขั้นตอนถัดไปคือเลือกช่องทางชำระเงิน",
        ].join("\n"),
      )
      .addFields(
        {
          name: "🆔 Order ID",
          value:
            `\`${order.orderId}\``,
          inline: true,
        },
        {
          name: "📦 จำนวน",
          value: "1",
          inline: true,
        },
        {
          name: "💰 ยอดรวม",
          value:
            `**฿${order.totalAmount.toLocaleString("th-TH")}**`,
          inline: true,
        },
        {
          name: "🛡️ ผู้ขาย",
          value:
            shop.name,
          inline: true,
        },
        {
          name: "📋 สถานะ",
          value:
            "🟡 รอเลือกวิธีชำระเงิน",
          inline: true,
        },
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Order System",
      })
      .setTimestamp();

  const paymentButton =
    new ButtonBuilder()
      .setCustomId(
        `nexora_order_payment:${order.orderId}`,
      )
      .setLabel("เลือกวิธีชำระเงิน")
      .setEmoji("💳")
      .setStyle(
        ButtonStyle.Primary,
      );

  const cancelButton =
    new ButtonBuilder()
      .setCustomId(
        `nexora_order_cancel:${order.orderId}`,
      )
      .setLabel("ยกเลิก Order")
      .setEmoji("❌")
      .setStyle(
        ButtonStyle.Danger,
      );

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        paymentButton,
        cancelButton,
      );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
