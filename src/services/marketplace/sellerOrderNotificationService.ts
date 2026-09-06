import {
  EmbedBuilder,
  type Client,
} from "discord.js";

import { Order } from "../../models/Order.js";
import { Shop } from "../../models/Shop.js";
import { Refund } from "../../models/Refund.js";

export async function sendSellerOrderPaidDM(
  client: Client,
  orderId: string,
): Promise<void> {
  const order =
    await Order.findOne({
      orderId,
    });

  if (!order) {
    throw new Error(
      "ไม่พบคำสั่งซื้อ",
    );
  }

  const shop =
    await Shop.findOne({
      shopId: order.shopId,
    });

  const seller =
    await client.users.fetch(
      order.sellerId,
    );

  const embed =
    new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(
        "💰 มีลูกค้าชำระเงินแล้ว!",
      )
      .setDescription(
        [
          "มีลูกค้าชำระเงินเพื่อซื้อสินค้าจากร้านของคุณเรียบร้อยแล้ว",
          "",
          "👤 **ลูกค้า**",
          `<@${order.buyerId}>`,
          "",
          "📦 **สินค้า**",
          order.productName,
          "",
          "🔢 **จำนวน**",
          String(order.quantity),
          "",
          "💰 **ยอดเงิน**",
          `฿${order.totalAmount.toLocaleString("th-TH")}`,
          "",
          "🏪 **ร้านค้า**",
          shop?.name ?? order.shopId,
          "",
          "🧾 **Order ID**",
          `\`${order.orderId}\``,
          "",
          "💬 กรุณาติดต่อกับลูกค้าผ่าน DM เพื่อดำเนินการซื้อขายและส่งมอบสินค้า",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Seller Notification",
      })
      .setTimestamp();

  await seller.send({
    embeds: [embed],
  });
}

export async function sendSellerRefundRequestDM(
  client: Client,
  refundId: string,
): Promise<void> {
  const refund =
    await Refund.findOne({
      refundId,
    });

  if (!refund) {
    throw new Error(
      "ไม่พบคำขอ Refund",
    );
  }

  const order =
    await Order.findOne({
      orderId: refund.orderId,
    });

  if (!order) {
    throw new Error(
      "ไม่พบคำสั่งซื้อของ Refund",
    );
  }

  const seller =
    await client.users.fetch(
      refund.sellerId,
    );

  const embed =
    new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(
        "🔄 มีคำขอยกเลิกคำสั่งซื้อ",
      )
      .setDescription(
        [
          "ลูกค้าได้ร้องขอยกเลิกคำสั่งซื้อและขอคืนเงิน",
          "",
          "🧾 **Order ID**",
          `\`${refund.orderId}\``,
          "",
          "📦 **สินค้า**",
          order.productName,
          "",
          "💰 **ยอดเงิน**",
          `฿${refund.amount.toLocaleString("th-TH")}`,
          "",
          "📝 **เหตุผล**",
          refund.reason,
          "",
          "🆔 **Refund ID**",
          `\`${refund.refundId}\``,
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Refund Request",
      })
      .setTimestamp();

  await seller.send({
    embeds: [embed],
  });
}
