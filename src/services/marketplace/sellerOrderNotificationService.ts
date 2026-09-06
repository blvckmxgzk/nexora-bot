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

import {
  Refund,
} from "../../models/Refund.js";

export async function sendSellerOrderPaidDM(
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
        `❌ Seller DM: Order ${orderId} not found`,
      );
      return false;
    }

    const seller =
      await client.users.fetch(
        order.sellerId,
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

    const embed =
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(
          "💰 มีคำสั่งซื้อใหม่!",
        )
        .setDescription(
          [
            "ลูกค้าชำระเงินสำหรับสินค้าของคุณเรียบร้อยแล้ว",
            "",
            "📦 **กรุณาดำเนินการส่งมอบสินค้าให้ลูกค้า**",
          ].join("\n"),
        )
        .addFields(
          {
            name:
              "👤 ผู้ซื้อ",
            value:
              `<@${order.buyerId}>`,
            inline: true,
          },
          {
            name:
              "📦 สินค้า",
            value:
              productName,
            inline: true,
          },
          {
            name:
              "🔢 จำนวน",
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
              `฿${Number(
                order.totalAmount ?? 0,
              ).toLocaleString(
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
              "🏪 ร้านค้า",
            value:
              shopName,
            inline: true,
          },
          {
            name:
              "🧾 Order ID",
            value:
              `\`${order.orderId}\``,
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
            "NEXORA Marketplace • กรุณาตรวจสอบ Order ก่อนส่งมอบสินค้า",
        })
        .setTimestamp();

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_order_start:${order.orderId}`,
            )
            .setLabel(
              "เริ่มดำเนินการ",
            )
            .setEmoji("📦")
            .setStyle(
              ButtonStyle.Primary,
            ),
        );

    await seller.send({
      embeds: [embed],
      components: [row],
    });

    console.log(
      `📩 Seller paid DM sent: ${order.orderId} → ${seller.tag}`,
    );

    return true;
  } catch (error) {
    console.error(
      `⚠️ Failed to send seller paid DM for ${orderId}:`,
      error,
    );

    return false;
  }
}

export async function sendSellerRefundRequestDM(
  client: Client,
  refundId: string,
): Promise<boolean> {
  try {
    const refund =
      await Refund.findOne({
        refundId,
      });

    if (!refund) {
      return false;
    }

    const order =
      await Order.findOne({
        orderId:
          refund.orderId,
      });

    if (!order) {
      return false;
    }

    const product =
      await Product.findOne({
        productId:
          order.productId,
      });

    const shop =
      await Shop.findOne({
        shopId:
          refund.shopId,
      });

    const seller =
      await client.users.fetch(
        refund.sellerId,
      );

    const embed =
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(
          "💸 มีคำขอคืนเงินใหม่",
        )
        .setDescription(
          [
            "มีผู้ซื้อส่งคำขอคืนเงินสำหรับคำสั่งซื้อของร้านคุณ",
            "",
            `👤 **ผู้ซื้อ:** <@${refund.buyerId}>`,
            `📦 **สินค้า:** ${product?.name ?? order.productName}`,
            `🏪 **ร้าน:** ${shop?.name ?? "ไม่ทราบชื่อร้าน"}`,
            `🧾 **Order ID:** \`${refund.orderId}\``,
            `💸 **Refund ID:** \`${refund.refundId}\``,
            "",
            `**เหตุผล:**\n${refund.reason}`,
          ].join("\n"),
        )
        .addFields({
          name:
            "💰 ยอดคืนเงิน",
          value:
            `฿${refund.amount.toLocaleString(
              "th-TH",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              },
            )}`,
          inline: true,
        })
        .setFooter({
          text:
            "NEXORA Marketplace • Refund Review",
        })
        .setTimestamp();

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_refund_approve:${refund.refundId}`,
            )
            .setLabel(
              "อนุมัติคืนเงิน",
            )
            .setEmoji("✅")
            .setStyle(
              ButtonStyle.Success,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_refund_reject:${refund.refundId}`,
            )
            .setLabel(
              "ปฏิเสธ",
            )
            .setEmoji("❌")
            .setStyle(
              ButtonStyle.Danger,
            ),
        );

    await seller.send({
      embeds: [embed],
      components: [row],
    });

    console.log(
      `📩 Seller refund DM sent: ${refund.refundId} → ${seller.tag}`,
    );

    return true;
  } catch (error) {
    console.error(
      `⚠️ Failed to send seller refund DM for ${refundId}:`,
      error,
    );

    return false;
  }
}
