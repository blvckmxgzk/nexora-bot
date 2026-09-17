import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { orderService } from "../../services/orderService.js";
import {
  orderValidationService,
} from "../../services/orderValidationService.js";

export const customId =
  "nexora_marketplace_product_buy_modal:";

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

  const quantity =
    Number(
      interaction.fields
        .getTextInputValue(
          "quantity",
        )
        .trim(),
    );

  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity < 1
  ) {
    await interaction.reply({
      content:
        "❌ จำนวนสินค้าต้องเป็นจำนวนเต็มอย่างน้อย 1",
      ephemeral: true,
    });
    return;
  }

  try {
    const {
      product,
      shop,
    } =
      await orderValidationService
        .validateProductForPurchase(
          productId,
          interaction.user.id,
          quantity,
        );

    /*
     * อ่านราคาโดยตรงจาก Database
     * ไม่รับราคาจาก Modal
     */
    const unitPrice =
      product.price;

    const totalAmount =
      unitPrice *
      quantity;

    const order =
      await orderService.createOrder({
        buyerId:
          interaction.user.id,

        sellerId:
          product.ownerId,

        shopId:
          shop.shopId,

        productId:
          product.productId,

        productName:
          product.name,

        quantity,

        unitPrice,
      });

    const embed =
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(
          "🛒 สร้างคำสั่งซื้อสำเร็จ",
        )
        .setDescription(
          [
            "ระบบสร้าง Order ของคุณเรียบร้อยแล้ว",
            "",
            "กรุณาดำเนินการชำระเงินเพื่อดำเนินการต่อ",
          ].join("\n"),
        )
        .addFields(
          {
            name:
              "🆔 Order ID",
            value:
              `\`${order.orderId}\``,
            inline: true,
          },
          {
            name:
              "🏪 ร้านค้า",
            value:
              shop.name,
            inline: true,
          },
          {
            name:
              "📦 สินค้า",
            value:
              product.name,
            inline: false,
          },
          {
            name:
              "🔢 จำนวน",
            value:
              `${quantity} ชิ้น`,
            inline: true,
          },
          {
            name:
              "💰 ราคาต่อชิ้น",
            value:
              `฿${unitPrice.toLocaleString("th-TH")}`,
            inline: true,
          },
          {
            name:
              "💵 ยอดรวม",
            value:
              `฿${totalAmount.toLocaleString("th-TH")}`,
            inline: true,
          },
          {
            name:
              "🟡 สถานะ",
            value:
              "รอชำระเงิน",
            inline: true,
          },
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Order",
        })
        .setTimestamp();

    if (
      product.imageUrl
    ) {
      embed.setThumbnail(
        product.imageUrl,
      );
    }

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_order_pay:${order.orderId}`,
            )
            .setLabel(
              "ชำระเงิน",
            )
            .setEmoji("💳")
            .setStyle(
              ButtonStyle.Success,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_order_cancel:${order.orderId}`,
            )
            .setLabel(
              "ยกเลิก Order",
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
    console.error(
      "❌ Failed to create marketplace order:",
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถสร้างคำสั่งซื้อได้",
      ephemeral: true,
    });
  }
}
