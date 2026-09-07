import crypto from "node:crypto";

import {
  NotificationDelivery,
} from "../../models/NotificationDelivery.js";

import {
  MarketplaceOpsAlert,
} from "../../models/MarketplaceOpsAlert.js";

import {
  Order,
} from "../../models/Order.js";

import {
  Refund,
} from "../../models/Refund.js";

import {
  getMarketplaceDiscordClient,
} from "./marketplaceNotificationService.js";

export type NotificationEventType =
  | "order_paid_buyer"
  | "order_paid_seller"
  | "refund_requested_seller"
  | "refund_completed_buyer"
  | "refund_rejected_buyer";

type ResourceType =
  | "order"
  | "refund";

const SENDING_STALE_MS =
  5 *
  60 *
  1000;

const RETRY_DELAYS_MS = [
  30_000,
  2 * 60_000,
  10 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
];

function createDeliveryId():
  string {
  return (
    "NTF-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function createAlertId():
  string {
  return (
    "OPS-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function errorMessage(
  error:
    unknown,
): string {
  return (
    error instanceof Error
      ? error.message
      : String(error)
  ).slice(
    0,
    2000,
  );
}

function formatBaht(
  amount:
    number,
): string {
  return amount.toLocaleString(
    "th-TH",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  );
}

function retryDelay(
  attempts:
    number,
): number {
  return (
    RETRY_DELAYS_MS[
      Math.min(
        Math.max(
          attempts - 1,
          0,
        ),

        RETRY_DELAYS_MS.length -
          1,
      )
    ] ??
    RETRY_DELAYS_MS[
      RETRY_DELAYS_MS.length -
        1
    ]
  );
}

async function resolveRecipient(
  eventType:
    NotificationEventType,

  resourceId:
    string,
): Promise<{
  recipientId:
    string;

  resourceType:
    ResourceType;
}> {
  if (
    eventType ===
      "order_paid_buyer" ||
    eventType ===
      "order_paid_seller"
  ) {
    const order =
      await Order.findOne({
        orderId:
          resourceId,
      });

    if (!order) {
      throw new Error(
        `ไม่พบ Order สำหรับ Notification: ${resourceId}`,
      );
    }

    return {
      recipientId:
        eventType ===
          "order_paid_buyer"
          ? order.buyerId
          : order.sellerId,

      resourceType:
        "order",
    };
  }

  const refund =
    await Refund.findOne({
      refundId:
        resourceId,
    });

  if (!refund) {
    throw new Error(
      `ไม่พบ Refund สำหรับ Notification: ${resourceId}`,
    );
  }

  return {
    recipientId:
      eventType ===
        "refund_requested_seller"
        ? refund.sellerId
        : refund.buyerId,

    resourceType:
      "refund",
  };
}

async function sendDelivery(
  delivery:
    any,
): Promise<void> {
  const client =
    getMarketplaceDiscordClient();

  const user =
    await client.users.fetch(
      delivery.recipientId,
    );

  if (
    delivery.resourceType ===
    "order"
  ) {
    const order =
      await Order.findOne({
        orderId:
          delivery.resourceId,
      });

    if (!order) {
      throw new Error(
        "Order ของ Notification หายไปจากระบบ",
      );
    }

    if (
      delivery.eventType ===
      "order_paid_buyer"
    ) {
      if (
        order.buyerId !==
        delivery.recipientId
      ) {
        throw new Error(
          "Notification recipient ไม่ตรงกับ Buyer",
        );
      }

      await user.send({
        content: [
          "✅ **NEXORA ยืนยันการชำระเงินแล้ว**",
          "",
          `🧾 Order ID: \`${order.orderId}\``,
          `💳 Payment ID: \`${order.paymentId ?? "-"}\``,
          `📦 สินค้า: **${order.productName}**`,
          `🔢 จำนวน: **${order.quantity}**`,
          `💰 ยอดชำระ: **฿${formatBaht(order.totalAmount)}**`,
          "",
          "NEXORA ได้บันทึกการชำระเงินของรายการนี้เรียบร้อยแล้ว",
          "กรุณาเก็บ Order ID และ Payment ID ไว้ใช้อ้างอิงกับทีมงาน",
          "",
          `🔐 Notification Reference: \`${delivery.deliveryId}\``,
        ].join(
          "\n",
        ),
      });

      return;
    }

    if (
      order.sellerId !==
      delivery.recipientId
    ) {
      throw new Error(
        "Notification recipient ไม่ตรงกับ Seller",
      );
    }

    await user.send({
      content: [
        "💰 **มีคำสั่งซื้อชำระเงินสำเร็จ**",
        "",
        `🧾 Order ID: \`${order.orderId}\``,
        `📦 สินค้า: **${order.productName}**`,
        `🔢 จำนวน: **${order.quantity}**`,
        `💰 ยอดคำสั่งซื้อ: **฿${formatBaht(order.totalAmount)}**`,
        "",
        "Payment ได้รับการยืนยันจากระบบแล้ว",
        "กรุณาดำเนินการคำสั่งซื้อตามขั้นตอนของ NEXORA",
        "",
        `🔐 Notification Reference: \`${delivery.deliveryId}\``,
      ].join(
        "\n",
      ),
    });

    return;
  }

  const refund =
    await Refund.findOne({
      refundId:
        delivery.resourceId,
    });

  if (!refund) {
    throw new Error(
      "Refund ของ Notification หายไปจากระบบ",
    );
  }

  if (
    delivery.eventType ===
    "refund_requested_seller"
  ) {
    if (
      refund.sellerId !==
      delivery.recipientId
    ) {
      throw new Error(
        "Notification recipient ไม่ตรงกับ Refund Seller",
      );
    }

    await user.send({
      content: [
        "💸 **มีคำขอคืนเงินใหม่**",
        "",
        `🧾 Order ID: \`${refund.orderId}\``,
        `💸 Refund ID: \`${refund.refundId}\``,
        `💰 จำนวน: **฿${formatBaht(refund.amount)}**`,
        "",
        "**เหตุผลจากผู้ซื้อ:**",
        refund.reason,
        "",
        "กรุณาตรวจสอบคำขอนี้ผ่านระบบ NEXORA",
        "",
        `🔐 Notification Reference: \`${delivery.deliveryId}\``,
      ].join(
        "\n",
      ),
    });

    return;
  }

  if (
    refund.buyerId !==
    delivery.recipientId
  ) {
    throw new Error(
      "Notification recipient ไม่ตรงกับ Refund Buyer",
    );
  }

  if (
    delivery.eventType ===
    "refund_completed_buyer"
  ) {
    await user.send({
      content: [
        "💰 **คืนเงินสำเร็จ**",
        "",
        `🧾 Order ID: \`${refund.orderId}\``,
        `💸 Refund ID: \`${refund.refundId}\``,
        `💰 จำนวน: **฿${formatBaht(refund.amount)}**`,
        "",
        "NEXORA ได้ดำเนินการ Refund ผ่าน Payment Provider แล้ว",
        "สถานะ Order และ Payment ถูกบันทึกเป็น refunded แล้ว",
        "",
        "กรุณาเก็บ Refund ID ไว้เป็นหลักฐานอ้างอิง",
        "",
        `🔐 Notification Reference: \`${delivery.deliveryId}\``,
      ].join(
        "\n",
      ),
    });

    return;
  }

  await user.send({
    content: [
      "❌ **คำขอคืนเงินถูกปฏิเสธ**",
      "",
      `🧾 Order ID: \`${refund.orderId}\``,
      `💸 Refund ID: \`${refund.refundId}\``,
      "",
      "**เหตุผล:**",
      refund.rejectionReason ??
        "ไม่ได้ระบุเหตุผล",
      "",
      "หากคิดว่าการตัดสินใจไม่เป็นธรรม คุณยังสามารถใช้ระบบ Report ของ NEXORA เพื่อส่งหลักฐานให้ทีมงานตรวจสอบได้",
      "",
      `🔐 Notification Reference: \`${delivery.deliveryId}\``,
    ].join(
      "\n",
    ),
  });
}

async function resolveDeadLetterAlert(
  deliveryId:
    string,
): Promise<void> {
  await MarketplaceOpsAlert
    .updateOne(
      {
        sourceKey:
          `ops:notification:${deliveryId}`,

        status:
          "active",
      },
      {
        $set: {
          status:
            "resolved",

          resolvedAt:
            new Date(),
        },
      },
    );
}

async function raiseDeadLetterAlert(
  delivery:
    any,
): Promise<void> {
  const now =
    new Date();

  await MarketplaceOpsAlert
    .findOneAndUpdate(
      {
        sourceKey:
          `ops:notification:${delivery.deliveryId}`,
      },
      {
        $set: {
          code:
            "notification_dead_letter",

          severity:
            "critical",

          status:
            "active",

          count:
            delivery.attempts,

          message:
            "Customer Marketplace notification ส่งไม่สำเร็จหลัง retry ครบ",

          details: {
            deliveryId:
              delivery.deliveryId,

            eventType:
              delivery.eventType,

            recipientId:
              delivery.recipientId,

            resourceType:
              delivery.resourceType,

            resourceId:
              delivery.resourceId,
          },

          lastDetectedAt:
            now,

          resolvedAt:
            null,
        },

        $setOnInsert: {
          alertId:
            createAlertId(),

          sourceKey:
            `ops:notification:${delivery.deliveryId}`,

          firstDetectedAt:
            now,
        },
      },
      {
        upsert:
          true,

        new:
          true,
      },
    );
}

export const notificationDeliveryService = {
  async enqueueEvent(
    data: {
      eventType:
        NotificationEventType;

      resourceId:
        string;
    },
  ) {
    const resolved =
      await resolveRecipient(
        data.eventType,
        data.resourceId,
      );

    const sourceKey =
      `${data.eventType}:${resolved.resourceType}:${data.resourceId}`;

    try {
      return await NotificationDelivery
        .findOneAndUpdate(
          {
            sourceKey,
          },
          {
            $setOnInsert: {
              deliveryId:
                createDeliveryId(),

              sourceKey,

              eventType:
                data.eventType,

              recipientId:
                resolved.recipientId,

              resourceType:
                resolved.resourceType,

              resourceId:
                data.resourceId,

              status:
                "pending",

              attempts:
                0,

              maxAttempts:
                5,

              nextAttemptAt:
                new Date(),
            },
          },
          {
            upsert:
              true,

            new:
              true,
          },
        );
    } catch (
      error: any
    ) {
      if (
        error?.code ===
        11000
      ) {
        const existing =
          await NotificationDelivery
            .findOne({
              sourceKey,
            });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  },

  async processById(
    deliveryId:
      string,
  ) {
    const now =
      new Date();

    const staleBefore =
      new Date(
        now.getTime() -
        SENDING_STALE_MS,
      );

    const claimed =
      await NotificationDelivery
        .findOneAndUpdate(
          {
            deliveryId,

            $or: [
              {
                status: {
                  $in: [
                    "pending",
                    "retrying",
                  ],
                },

                nextAttemptAt: {
                  $lte:
                    now,
                },
              },

              {
                status:
                  "sending",

                updatedAt: {
                  $lte:
                    staleBefore,
                },
              },
            ],
          },
          {
            $set: {
              status:
                "sending",

              lastAttemptAt:
                now,
            },
          },
          {
            new:
              true,
          },
        );

    if (!claimed) {
      return NotificationDelivery
        .findOne({
          deliveryId,
        });
    }

    try {
      await sendDelivery(
        claimed,
      );

      const sent =
        await NotificationDelivery
          .findOneAndUpdate(
            {
              deliveryId,

              status:
                "sending",
            },
            {
              $set: {
                status:
                  "sent",

                sentAt:
                  new Date(),

                lastError:
                  null,
              },

              $inc: {
                attempts:
                  1,
              },
            },
            {
              new:
                true,
            },
          );

      await resolveDeadLetterAlert(
        deliveryId,
      );

      return sent;
    } catch (error) {
      const attempts =
        claimed.attempts +
        1;

      const deadLetter =
        attempts >=
        claimed.maxAttempts;

      const failed =
        await NotificationDelivery
          .findOneAndUpdate(
            {
              deliveryId,

              status:
                "sending",
            },
            {
              $set: {
                status:
                  deadLetter
                    ? "dead_letter"
                    : "retrying",

                attempts,

                lastError:
                  errorMessage(
                    error,
                  ),

                nextAttemptAt:
                  deadLetter
                    ? null
                    : new Date(
                        Date.now() +
                        retryDelay(
                          attempts,
                        ),
                      ),
              },
            },
            {
              new:
                true,
            },
          );

      if (
        deadLetter &&
        failed
      ) {
        await raiseDeadLetterAlert(
          failed,
        );
      }

      return failed;
    }
  },

  async enqueueAndAttempt(
    data: {
      eventType:
        NotificationEventType;

      resourceId:
        string;
    },
  ) {
    const delivery =
      await this.enqueueEvent(
        data,
      );

    if (
      delivery.status ===
      "sent"
    ) {
      return delivery;
    }

    return this.processById(
      delivery.deliveryId,
    );
  },

  async retryDeadLetter(
    deliveryId:
      string,
  ) {
    const current =
      await NotificationDelivery
        .findOne({
          deliveryId,
        });

    if (!current) {
      throw new Error(
        "ไม่พบ Notification Delivery",
      );
    }

    if (
      current.status ===
      "sent"
    ) {
      return current;
    }

    if (
      current.status !==
      "dead_letter"
    ) {
      throw new Error(
        `Notification สถานะ ${current.status} ไม่ใช่ dead-letter`,
      );
    }

    if (
      current.attempts >=
      10
    ) {
      throw new Error(
        "Notification ถึง manual retry limit แล้ว",
      );
    }

    const requeued =
      await NotificationDelivery
        .findOneAndUpdate(
          {
            deliveryId,

            status:
              "dead_letter",
          },
          {
            $set: {
              status:
                "retrying",

              nextAttemptAt:
                new Date(),

              lastError:
                null,

              maxAttempts:
                Math.min(
                  10,
                  current.attempts +
                    3,
                ),
            },
          },
          {
            new:
              true,
          },
        );

    if (!requeued) {
      throw new Error(
        "Notification ถูกเปลี่ยนสถานะก่อน manual retry",
      );
    }

    return this.processById(
      deliveryId,
    );
  },

  async processDue(
    limit =
      25,
  ) {
    const safeLimit =
      Math.max(
        1,
        Math.min(
          100,
          Math.trunc(
            limit,
          ),
        ),
      );

    const now =
      new Date();

    const staleBefore =
      new Date(
        now.getTime() -
        SENDING_STALE_MS,
      );

    const candidates =
      await NotificationDelivery
        .find({
          $or: [
            {
              status: {
                $in: [
                  "pending",
                  "retrying",
                ],
              },

              nextAttemptAt: {
                $lte:
                  now,
              },
            },

            {
              status:
                "sending",

              updatedAt: {
                $lte:
                  staleBefore,
              },
            },
          ],
        })
        .sort({
          nextAttemptAt:
            1,
        })
        .limit(
          safeLimit,
        );

    let sent =
      0;

    let retried =
      0;

    let deadLetter =
      0;

    for (
      const candidate
      of candidates
    ) {
      const result =
        await this.processById(
          candidate.deliveryId,
        );

      if (
        result?.status ===
        "sent"
      ) {
        sent++;
      } else if (
        result?.status ===
        "dead_letter"
      ) {
        deadLetter++;
      } else if (
        result?.status ===
        "retrying"
      ) {
        retried++;
      }
    }

    return {
      checked:
        candidates.length,

      sent,

      retried,

      deadLetter,
    };
  },
};
