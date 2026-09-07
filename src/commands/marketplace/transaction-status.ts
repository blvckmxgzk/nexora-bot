import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  Order,
} from "../../models/Order.js";

import {
  Payment,
} from "../../models/Payment.js";

import {
  Refund,
} from "../../models/Refund.js";

import {
  NotificationDelivery,
} from "../../models/NotificationDelivery.js";

const orderNames:
  Record<
    string,
    string
  > = {
    pending:
      "🟡 รอเริ่มชำระเงิน",

    awaiting_payment:
      "🟠 รอชำระเงิน",

    paid:
      "🟢 ชำระเงินแล้ว",

    processing:
      "🔵 ร้านค้ากำลังดำเนินการ",

    completed:
      "✅ สำเร็จ",

    cancelled:
      "⚪ ยกเลิก",

    refunded:
      "💰 คืนเงินแล้ว",

    disputed:
      "🚨 อยู่ระหว่างข้อพิพาท",
  };

const paymentNames:
  Record<
    string,
    string
  > = {
    creating:
      "🟡 กำลังสร้าง Payment",

    pending:
      "🟠 รอชำระเงิน",

    paid:
      "✅ ชำระสำเร็จ",

    expired:
      "⌛ หมดอายุ",

    cancelled:
      "⚪ ยกเลิก",

    failed:
      "❌ ล้มเหลว",

    refunded:
      "💰 คืนเงินแล้ว",
  };

const refundNames:
  Record<
    string,
    string
  > = {
    requested:
      "🟡 ส่งคำขอแล้ว",

    approved:
      "🟢 อนุมัติแล้ว",

    rejected:
      "❌ ถูกปฏิเสธ",

    processing:
      "🔵 กำลังคืนเงิน",

    completed:
      "✅ คืนเงินสำเร็จ",

    failed:
      "⚠️ การคืนเงินมีปัญหา",

    cancelled:
      "⚪ ยกเลิก",
  };

function baht(
  value:
    number,
): string {
  return value.toLocaleString(
    "th-TH",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  );
}

function dateText(
  value:
    unknown,
): string {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      value as
        string |
        number |
        Date,
    );

  return Number.isFinite(
    date.getTime(),
  )
    ? date.toLocaleString(
        "th-TH",
        {
          timeZone:
            "Asia/Bangkok",
        },
      )
    : "-";
}

function notificationName(
  status:
    string |
    null |
    undefined,
): string {
  switch (status) {
    case "sent":
      return "✅ ส่งสำเร็จ";

    case "pending":
    case "retrying":
    case "sending":
      return "🟡 ระบบกำลังพยายามส่ง";

    case "dead_letter":
      return "🔴 ทีมงานได้รับ Alert แล้ว";

    default:
      return "— ยังไม่มี";
  }
}

async function latestNotification(
  recipientId:
    string,

  resourceType:
    "order" |
    "refund",

  resourceId:
    string,
) {
  return NotificationDelivery
    .findOne({
      recipientId,

      resourceType,

      resourceId,
    })
    .sort({
      createdAt:
        -1,
    });
}

export const data =
  new SlashCommandBuilder()
    .setName(
      "transaction-status",
    )
    .setDescription(
      "ตรวจสอบสถานะธุรกรรม NEXORA ของคุณ",
    )
    .addStringOption(
      (
        option,
      ) =>
        option
          .setName(
            "type",
          )
          .setDescription(
            "ประเภทธุรกรรม",
          )
          .setRequired(
            true,
          )
          .addChoices(
            {
              name:
                "Order",

              value:
                "order",
            },
            {
              name:
                "Payment",

              value:
                "payment",
            },
            {
              name:
                "Refund",

              value:
                "refund",
            },
          ),
    )
    .addStringOption(
      (
        option,
      ) =>
        option
          .setName(
            "id",
          )
          .setDescription(
            "Order / Payment / Refund ID",
          )
          .setRequired(
            true,
          )
          .setMinLength(
            3,
          )
          .setMaxLength(
            100,
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const type =
    interaction.options
      .getString(
        "type",
        true,
      );

  const id =
    interaction.options
      .getString(
        "id",
        true,
      )
      .trim();

  const userId =
    interaction.user.id;

  await interaction.deferReply({
    ephemeral:
      true,
  });

  if (
    type ===
    "order"
  ) {
    const order =
      await Order.findOne({
        orderId:
          id,
      });

    if (
      !order ||
      (
        order.buyerId !==
          userId &&
        order.sellerId !==
          userId
      )
    ) {
      await interaction.editReply(
        "❌ ไม่พบธุรกรรมนี้ หรือคุณไม่มีสิทธิ์ดูรายการนี้",
      );

      return;
    }

    const [
      payment,
      refund,
      notification,
    ] =
      await Promise.all([
        order.paymentId
          ? Payment.findOne({
              paymentId:
                order.paymentId,
            })
          : null,

        Refund.findOne({
          orderId:
            order.orderId,
        }).sort({
          createdAt:
            -1,
        }),

        latestNotification(
          userId,
          "order",
          order.orderId,
        ),
      ]);

    await interaction.editReply({
      content: [
        "🧾 **NEXORA Transaction Status**",
        "",
        `Order ID: \`${order.orderId}\``,
        `สถานะ Order: **${orderNames[order.status] ?? order.status}**`,
        `สินค้า: **${order.productName}**`,
        `จำนวน: **${order.quantity}**`,
        `ยอดรวม: **฿${baht(order.totalAmount)}**`,
        "",
        `Payment: **${payment ? paymentNames[payment.status] ?? payment.status : "— ยังไม่มี"}**`,
        `Refund: **${refund ? refundNames[refund.status] ?? refund.status : "— ไม่มี"}**`,
        "",
        `การแจ้งเตือนล่าสุด: **${notificationName(notification?.status)}**`,
        `อัปเดตล่าสุด: **${dateText(order.updatedAt)}**`,
        "",
        "🔐 ข้อมูลนี้อ่านจากสถานะธุรกรรมใน NEXORA โดยตรง",
      ].join(
        "\n",
      ),
    });

    return;
  }

  if (
    type ===
    "payment"
  ) {
    const payment =
      await Payment.findOne({
        paymentId:
          id,
      });

    if (
      !payment ||
      (
        payment.buyerId !==
          userId &&
        payment.sellerId !==
          userId
      )
    ) {
      await interaction.editReply(
        "❌ ไม่พบธุรกรรมนี้ หรือคุณไม่มีสิทธิ์ดูรายการนี้",
      );

      return;
    }

    const notification =
      await latestNotification(
        userId,
        "order",
        payment.orderId,
      );

    await interaction.editReply({
      content: [
        "💳 **NEXORA Payment Status**",
        "",
        `Payment ID: \`${payment.paymentId}\``,
        `Order ID: \`${payment.orderId}\``,
        `สถานะ: **${paymentNames[payment.status] ?? payment.status}**`,
        `ช่องทาง: **${payment.provider === "promptpay" ? "PromptPay" : "TrueMoney"}**`,
        `ยอด: **฿${baht(payment.amount)}**`,
        `ชำระเมื่อ: **${dateText(payment.paidAt)}**`,
        `หมดอายุ: **${dateText(payment.expiresAt)}**`,
        "",
        `การแจ้งเตือนล่าสุด: **${notificationName(notification?.status)}**`,
        "",
        "🔐 Provider transaction identifiers และข้อมูลภายในถูกซ่อนไว้เพื่อความปลอดภัย",
      ].join(
        "\n",
      ),
    });

    return;
  }

  const refund =
    await Refund.findOne({
      refundId:
        id,
    });

  if (
    !refund ||
    (
      refund.buyerId !==
        userId &&
      refund.sellerId !==
        userId
    )
  ) {
    await interaction.editReply(
      "❌ ไม่พบธุรกรรมนี้ หรือคุณไม่มีสิทธิ์ดูรายการนี้",
    );

    return;
  }

  const notification =
    await latestNotification(
      userId,
      "refund",
      refund.refundId,
    );

  const reviewText =
    refund.riskReviewStatus ===
      "pending"
      ? "🔎 อยู่ระหว่างการตรวจสอบเพิ่มเติม"
      : refundNames[
          refund.status
        ] ??
        refund.status;

  await interaction.editReply({
    content: [
      "💸 **NEXORA Refund Status**",
      "",
      `Refund ID: \`${refund.refundId}\``,
      `Order ID: \`${refund.orderId}\``,
      `สถานะ: **${reviewText}**`,
      `ยอดคืน: **฿${baht(refund.amount)}**`,
      "",
      refund.status ===
        "rejected"
        ? `เหตุผล: **${refund.rejectionReason ?? "ไม่ได้ระบุ"}**`
        : "",
      `การแจ้งเตือนล่าสุด: **${notificationName(notification?.status)}**`,
      `อัปเดตล่าสุด: **${dateText(refund.updatedAt)}**`,
      "",
      "🔐 Risk score และข้อมูลตรวจจับภายในจะไม่ถูกเปิดเผย",
    ]
      .filter(
        Boolean,
      )
      .join(
        "\n",
      ),
  });
}
