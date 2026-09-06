import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from "discord.js";

import {
  Order,
} from "../../models/Order.js";

import {
  Product,
} from "../../models/Product.js";

import {
  Shop,
} from "../../models/Shop.js";

export async function sendBuyerOrderPaidDM(
  client: Client,
  orderId: string,
): Promise<boolean> {
  try {
    const order =
      await Order.findOne({
        orderId,
      });

    if (!order) {
      console.error(
        `❌ Cannot send buyer DM: Order ${orderId} not found`,
      );

      return false;
    }

    const buyer =
      await client.users.fetch(
        order.buyerId,
      );

    const product =
      await Product.findOne({
        productId:
          order.productId,
      });

    const shop =
      await Shop.findOne({
        shopId:
          order.shopId,
      });

    const productName =
      product?.name ??
      order.productName ??
      "ไม่ทราบชื่อสินค้า";

    const shopName =
      shop?.name ??
      "ไม่ทราบชื่อร้าน";

    const totalAmount =
      Number(
        order.totalAmount ?? 0,
      );

    const embed =
      new EmbedBuilder()
        .setTitle(
          "💳 ชำระเงินสำเร็จ!",
        )
        .setDescription(
          [
            "คำสั่งซื้อของคุณได้รับการชำระเงินเรียบร้อยแล้ว",
            "",
            "📦 **ตอนนี้กำลังรอร้านค้าดำเนินการส่งมอบสินค้า**",
            "",
            "กรุณาติดต่อกับเจ้าของร้านเพื่อรับสินค้า",
            "",
            "เมื่อคุณได้รับสินค้าและตรวจสอบเรียบร้อยแล้ว",
            "**กรุณากด 🟢 Complete**",
          ].join("\n"),
        )
        .addFields(
          {
            name:
              "🛍️ สินค้า",
            value:
              productName,
            inline: true,
          },
          {
            name:
              "🏪 ร้านค้า",
            value:
              shopName,
            inline: true,
          },
          {
            name:
              "📦 จำนวน",
            value:
              String(
                order.quantity ??
                  1,
              ),
            inline: true,
          },
          {
            name:
              "💰 ยอดรวม",
            value:
              `฿${totalAmount.toLocaleString(
                "th-TH",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                },
              )}`,
            inline: true,
          },
          {
            name:
              "🧾 Order ID",
            value:
              `\`${orderId}\``,
            inline: true,
          },
          {
            name:
              "📌 สถานะ",
            value:
              "🔵 ชำระเงินแล้ว",
            inline: true,
          },
        )
        .setFooter({
          text:
            "NEXORA Marketplace • อย่ากดยืนยันก่อนที่คุณจะได้รับสินค้า",
        })
        .setTimestamp();

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_order_complete:${orderId}`,
            )
            .setLabel(
              "Complete",
            )
            .setEmoji("🟢")
            .setStyle(
              ButtonStyle.Success,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_order_abort:${orderId}`,
            )
            .setLabel(
              "Abort / ขอคืนเงิน",
            )
            .setEmoji("❌")
            .setStyle(
              ButtonStyle.Danger,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_order_report:${orderId}`,
            )
            .setLabel(
              "Report Scam",
            )
            .setEmoji("🚨")
            .setStyle(
              ButtonStyle.Secondary,
            ),
        );

    await buyer.send({
      embeds: [
        embed,
      ],
      components: [
        row,
      ],
    });

    console.log(
      `📩 Buyer paid DM sent: ${orderId} → ${buyer.tag}`,
    );

    return true;
  } catch (error) {
    console.error(
      `⚠️ Failed to send buyer paid DM for ${orderId}:`,
      error,
    );

    return false;
  }
}
