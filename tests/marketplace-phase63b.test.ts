import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  NotificationDelivery,
} from "../src/models/NotificationDelivery.ts";

import {
  MarketplaceOpsAlert,
} from "../src/models/MarketplaceOpsAlert.ts";

import {
  WorkerHeartbeat,
} from "../src/models/WorkerHeartbeat.ts";

import {
  Order,
} from "../src/models/Order.ts";

import {
  Refund,
} from "../src/models/Refund.ts";

import {
  setMarketplaceDiscordClient,
} from "../src/services/marketplace/marketplaceNotificationService.ts";

import {
  notificationDeliveryService,
} from "../src/services/marketplace/notificationDeliveryService.ts";

import {
  marketplaceOpsHealthService,
} from "../src/services/marketplace/marketplaceOpsHealthService.ts";

import {
  MARKETPLACE_WORKERS,
} from "../src/services/marketplace/workerHealthService.ts";

let replSet:
  MongoMemoryReplSet |
  undefined;

let sendMock:
  ReturnType<
    typeof vi.fn
  >;

let fetchMock:
  ReturnType<
    typeof vi.fn
  >;

const OLD =
  new Date(
    Date.now() -
      60 *
        60 *
        1000,
  );

async function insertOrder(
  suffix:
    string,
) {
  const now =
    new Date();

  await Order.collection
    .insertOne({
      orderId:
        `ORD-63B-${suffix}`,

      buyerId:
        `BUYER-63B-${suffix}`,

      sellerId:
        `SELLER-63B-${suffix}`,

      shopId:
        "SHOP-63B",

      productId:
        `PROD-63B-${suffix}`,

      productName:
        "NEXORA Test Product",

      productCategory:
        "other",

      quantity:
        2,

      unitPrice:
        50,

      totalAmount:
        100,

      status:
        "paid",

      paymentId:
        `PAY-63B-${suffix}`,

      paymentMethod:
        "promptpay",

      paidAt:
        now,

      metadata: {},

      createdAt:
        now,

      updatedAt:
        now,
    });

  return {
    orderId:
      `ORD-63B-${suffix}`,

    buyerId:
      `BUYER-63B-${suffix}`,

    sellerId:
      `SELLER-63B-${suffix}`,
  };
}

async function insertRefund(
  suffix:
    string,

  status =
    "requested",
) {
  const now =
    new Date();

  await Refund.collection
    .insertOne({
      refundId:
        `REF-63B-${suffix}`,

      orderId:
        `ORD-REF-63B-${suffix}`,

      paymentId:
        `PAY-REF-63B-${suffix}`,

      shopId:
        "SHOP-63B",

      buyerId:
        `BUYER-REF-63B-${suffix}`,

      sellerId:
        `SELLER-REF-63B-${suffix}`,

      provider:
        "omise",

      providerPaymentId:
        `chrg_test_63b_${suffix}`,

      amount:
        250,

      currency:
        "THB",

      reason:
        "ลูกค้าขอคืนเงินเพื่อทดสอบ Phase 6.3B",

      status,

      requestedBy:
        `BUYER-REF-63B-${suffix}`,

      rejectionReason:
        status ===
          "rejected"
          ? "ไม่เข้าเงื่อนไขการคืนเงิน"
          : null,

      createdAt:
        now,

      updatedAt:
        now,
    });

  return {
    refundId:
      `REF-63B-${suffix}`,

    buyerId:
      `BUYER-REF-63B-${suffix}`,

    sellerId:
      `SELLER-REF-63B-${suffix}`,
  };
}

beforeAll(
  async () => {
    replSet =
      await MongoMemoryReplSet
        .create({
          replSet: {
            count:
              1,

            storageEngine:
              "wiredTiger",
          },
        });

    await mongoose.connect(
      replSet.getUri(),
      {
        dbName:
          "nexora-phase63b",
      },
    );

    await Promise.all([
      NotificationDelivery
        .syncIndexes(),

      MarketplaceOpsAlert
        .syncIndexes(),

      WorkerHeartbeat
        .syncIndexes(),
    ]);
  },
  120_000,
);

beforeEach(
  () => {
    sendMock =
      vi.fn()
        .mockResolvedValue({
          id:
            "discord-message-id",
        });

    fetchMock =
      vi.fn()
        .mockResolvedValue({
          tag:
            "NEXORA-Test",

          send:
            sendMock,
        });

    setMarketplaceDiscordClient(
      {
        users: {
          fetch:
            fetchMock,
        },
      } as any,
    );
  },
);

afterEach(
  async () => {
    vi.restoreAllMocks();

    await Promise.all([
      NotificationDelivery
        .deleteMany({}),

      MarketplaceOpsAlert
        .deleteMany({}),

      WorkerHeartbeat
        .deleteMany({}),

      Order.deleteMany({}),

      Refund.deleteMany({}),
    ]);
  },
);

afterAll(
  async () => {
    await mongoose.disconnect();

    if (replSet) {
      await replSet.stop();
    }
  },
  120_000,
);

describe(
  "NEXORA Marketplace Phase 6.3B Customer Trust",
  () => {
    it(
      "creates durable Buyer paid notification",
      async () => {
        const order =
          await insertOrder(
            "BUYER",
          );

        const delivery =
          await notificationDeliveryService
            .enqueueEvent({
              eventType:
                "order_paid_buyer",

              resourceId:
                order.orderId,
            });

        expect(
          delivery.recipientId,
        ).toBe(
          order.buyerId,
        );

        expect(
          delivery.status,
        ).toBe(
          "pending",
        );
      },
    );

    it(
      "creates durable Seller paid notification",
      async () => {
        const order =
          await insertOrder(
            "SELLER",
          );

        const delivery =
          await notificationDeliveryService
            .enqueueEvent({
              eventType:
                "order_paid_seller",

              resourceId:
                order.orderId,
            });

        expect(
          delivery.recipientId,
        ).toBe(
          order.sellerId,
        );
      },
    );

    it(
      "enqueue is idempotent for the same business event",
      async () => {
        const order =
          await insertOrder(
            "IDEMPOTENT",
          );

        const input = {
          eventType:
            "order_paid_buyer" as const,

          resourceId:
            order.orderId,
        };

        const [
          first,
          second,
        ] =
          await Promise.all([
            notificationDeliveryService
              .enqueueEvent(
                input,
              ),

            notificationDeliveryService
              .enqueueEvent(
                input,
              ),
          ]);

        expect(
          first.deliveryId,
        ).toBe(
          second.deliveryId,
        );

        expect(
          await NotificationDelivery
            .countDocuments(),
        ).toBe(
          1,
        );
      },
    );

    it(
      "successful delivery stores audit and customer reference",
      async () => {
        const order =
          await insertOrder(
            "SUCCESS",
          );

        const delivery =
          await notificationDeliveryService
            .enqueueAndAttempt({
              eventType:
                "order_paid_buyer",

              resourceId:
                order.orderId,
            });

        expect(
          delivery?.status,
        ).toBe(
          "sent",
        );

        expect(
          delivery?.attempts,
        ).toBe(
          1,
        );

        expect(
          delivery?.sentAt,
        ).not.toBeNull();

        expect(
          sendMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        const payload =
          sendMock.mock
            .calls[0][0];

        expect(
          payload.content,
        ).toContain(
          order.orderId,
        );

        expect(
          payload.content,
        ).toContain(
          "Notification Reference",
        );

        expect(
          payload.content,
        ).toContain(
          delivery?.deliveryId,
        );
      },
    );

    it(
      "concurrent processing sends Discord DM only once",
      async () => {
        const order =
          await insertOrder(
            "RACE",
          );

        const delivery =
          await notificationDeliveryService
            .enqueueEvent({
              eventType:
                "order_paid_buyer",

              resourceId:
                order.orderId,
            });

        await Promise.all([
          notificationDeliveryService
            .processById(
              delivery.deliveryId,
            ),

          notificationDeliveryService
            .processById(
              delivery.deliveryId,
            ),
        ]);

        expect(
          sendMock,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          (
            await NotificationDelivery
              .findOne({
                deliveryId:
                  delivery.deliveryId,
              })
          )?.status,
        ).toBe(
          "sent",
        );
      },
    );

    it(
      "Refund request notification routes to Seller",
      async () => {
        const refund =
          await insertRefund(
            "REQUEST",
          );

        const delivery =
          await notificationDeliveryService
            .enqueueAndAttempt({
              eventType:
                "refund_requested_seller",

              resourceId:
                refund.refundId,
            });

        expect(
          delivery?.recipientId,
        ).toBe(
          refund.sellerId,
        );

        expect(
          delivery?.status,
        ).toBe(
          "sent",
        );
      },
    );

    it(
      "completed Refund notification routes to Buyer with proof",
      async () => {
        const refund =
          await insertRefund(
            "COMPLETE",
            "completed",
          );

        const delivery =
          await notificationDeliveryService
            .enqueueAndAttempt({
              eventType:
                "refund_completed_buyer",

              resourceId:
                refund.refundId,
            });

        expect(
          delivery?.recipientId,
        ).toBe(
          refund.buyerId,
        );

        const content =
          sendMock.mock
            .calls[0][0]
            .content;

        expect(
          content,
        ).toContain(
          refund.refundId,
        );

        expect(
          content,
        ).toContain(
          "คืนเงินสำเร็จ",
        );
      },
    );

    it(
      "rejected Refund notification includes rejection reason",
      async () => {
        const refund =
          await insertRefund(
            "REJECT",
            "rejected",
          );

        await notificationDeliveryService
          .enqueueAndAttempt({
            eventType:
              "refund_rejected_buyer",

            resourceId:
              refund.refundId,
          });

        const content =
          sendMock.mock
            .calls[0][0]
            .content;

        expect(
          content,
        ).toContain(
          "ไม่เข้าเงื่อนไขการคืนเงิน",
        );

        expect(
          content,
        ).toContain(
          refund.refundId,
        );
      },
    );

    it(
      "Discord failure becomes retrying instead of disappearing",
      async () => {
        sendMock
          .mockRejectedValueOnce(
            new Error(
              "Cannot send messages to this user",
            ),
          );

        const order =
          await insertOrder(
            "RETRY",
          );

        const delivery =
          await notificationDeliveryService
            .enqueueAndAttempt({
              eventType:
                "order_paid_buyer",

              resourceId:
                order.orderId,
            });

        expect(
          delivery?.status,
        ).toBe(
          "retrying",
        );

        expect(
          delivery?.attempts,
        ).toBe(
          1,
        );

        expect(
          delivery?.nextAttemptAt,
        ).not.toBeNull();

        expect(
          await MarketplaceOpsAlert
            .countDocuments(),
        ).toBe(
          0,
        );
      },
    );

    it(
      "retry worker can deliver a previously failed notification",
      async () => {
        sendMock
          .mockRejectedValueOnce(
            new Error(
              "temporary Discord error",
            ),
          )
          .mockResolvedValueOnce({
            id:
              "second-attempt",
          });

        const order =
          await insertOrder(
            "RECOVER",
          );

        const first =
          await notificationDeliveryService
            .enqueueAndAttempt({
              eventType:
                "order_paid_buyer",

              resourceId:
                order.orderId,
            });

        expect(
          first?.status,
        ).toBe(
          "retrying",
        );

        await NotificationDelivery
          .collection
          .updateOne(
            {
              deliveryId:
                first?.deliveryId,
            },
            {
              $set: {
                nextAttemptAt:
                  OLD,
              },
            },
          );

        const result =
          await notificationDeliveryService
            .processDue();

        expect(
          result.sent,
        ).toBe(
          1,
        );

        const latest =
          await NotificationDelivery
            .findOne({
              deliveryId:
                first?.deliveryId,
            });

        expect(
          latest?.status,
        ).toBe(
          "sent",
        );

        expect(
          latest?.attempts,
        ).toBe(
          2,
        );

        expect(
          sendMock,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );

    it(
      "five failures create dead-letter and Critical Ops Alert",
      async () => {
        sendMock
          .mockRejectedValue(
            new Error(
              "DM permanently unavailable",
            ),
          );

        const order =
          await insertOrder(
            "DEAD",
          );

        const first =
          await notificationDeliveryService
            .enqueueAndAttempt({
              eventType:
                "order_paid_buyer",

              resourceId:
                order.orderId,
            });

        const deliveryId =
          first!.deliveryId;

        for (
          let attempt = 2;
          attempt <= 5;
          attempt++
        ) {
          await NotificationDelivery
            .collection
            .updateOne(
              {
                deliveryId,
              },
              {
                $set: {
                  nextAttemptAt:
                    OLD,
                },
              },
            );

          await notificationDeliveryService
            .processById(
              deliveryId,
            );
        }

        const latest =
          await NotificationDelivery
            .findOne({
              deliveryId,
            });

        expect(
          latest?.status,
        ).toBe(
          "dead_letter",
        );

        expect(
          latest?.attempts,
        ).toBe(
          5,
        );

        const alert =
          await MarketplaceOpsAlert
            .findOne({
              sourceKey:
                `ops:notification:${deliveryId}`,
            });

        expect(
          alert?.status,
        ).toBe(
          "active",
        );

        expect(
          alert?.severity,
        ).toBe(
          "critical",
        );

        expect(
          alert?.code,
        ).toBe(
          "notification_dead_letter",
        );
      },
    );

    it(
      "Ops health sweep never auto-resolves Notification dead-letter alerts",
      async () => {
        await MarketplaceOpsAlert
          .create({
            alertId:
              "OPS-NOTIFICATION-KEEP",

            sourceKey:
              "ops:notification:NTF-KEEP",

            code:
              "notification_dead_letter",

            severity:
              "critical",

            status:
              "active",

            count:
              5,

            message:
              "Notification failed",

            firstDetectedAt:
              new Date(),

            lastDetectedAt:
              new Date(),
          });

        /*
         * ไม่ต้อง seed worker heartbeat
         * เพราะเรากำลังพิสูจน์ ownership ของ Alert
         * ไม่ใช่ overall healthy state
         */
        await marketplaceOpsHealthService
          .syncAlerts();

        const alert =
          await MarketplaceOpsAlert
            .findOne({
              sourceKey:
                "ops:notification:NTF-KEEP",
            });

        expect(
          alert?.status,
        ).toBe(
          "active",
        );

        expect(
          Object.keys(
            MARKETPLACE_WORKERS,
          ),
        ).toHaveLength(
          4,
        );
      },
    );
  },
);
