import "dotenv/config";

import mongoose from "mongoose";

import {
  connectDatabase,
  disconnectDatabase,
} from "../src/database/connection.js";

import {
  Order,
} from "../src/models/Order.js";

import {
  Product,
} from "../src/models/Product.js";

const APPLY =
  process.argv.includes(
    "--apply",
  );

if (
  APPLY &&
  process.env
    .NEXORA_PHASE60_ALLOW_ORDER_REPAIR !==
    "YES"
) {
  throw new Error(
    "Phase 6.0 Order repair ถูก block: ต้องใช้ --apply พร้อม NEXORA_PHASE60_ALLOW_ORDER_REPAIR=YES",
  );
}

const CANCEL_TARGETS = [
  {
    orderId:
      "ORD-1788635962032-D8BBLN",

    productId:
      "PROD-1788635861625-Y2MGLD",

    productName:
      "RoV Voucher 5500",
  },

  {
    orderId:
      "ORD-1788636422005-WGM3QE",

    productId:
      "PROD-1788635861625-Y2MGLD",

    productName:
      "RoV Voucher 5500",
  },
] as const;

const BACKFILL_TARGET = {
  orderId:
    "ORD-1788681468814-QJCLWM",

  productId:
    "PROD-1788625202134-TWKWZQ",

  productName:
    "SP BOT V.54",

  category:
    "other",
} as const;

function validDate(
  value: unknown,
): value is Date {
  return (
    value instanceof Date &&
    Number.isFinite(
      value.getTime(),
    )
  );
}

async function inspectCancelTarget(
  target:
    typeof CANCEL_TARGETS[number],

  session?:
    mongoose.ClientSession,
) {
  const order =
    await Order.collection
      .findOne(
        {
          orderId:
            target.orderId,
        },
        {
          session,
        },
      );

  if (!order) {
    throw new Error(
      `ไม่พบ Order ${target.orderId}`,
    );
  }

  /*
   * idempotent success
   */
  if (
    order.status ===
      "cancelled" &&
    order.metadata
      ?.stockReleased ===
      true
  ) {
    return {
      order,
      alreadyResolved:
        true,
    };
  }

  if (
    order.status !==
      "pending"
  ) {
    throw new Error(
      `${target.orderId}: expected pending, got ${order.status}`,
    );
  }

  if (
    order.paymentId !=
    null
  ) {
    throw new Error(
      `${target.orderId}: มี Payment แล้ว ห้ามใช้ legacy repair`,
    );
  }

  if (
    order.productId !==
      target.productId ||
    order.productName !==
      target.productName
  ) {
    throw new Error(
      `${target.orderId}: Product identity เปลี่ยนจาก inspection`,
    );
  }

  if (
    order.metadata
      ?.stockReserved !==
      true ||
    order.metadata
      ?.stockReleased ===
      true
  ) {
    throw new Error(
      `${target.orderId}: stock reservation state ไม่ตรงกับ inspection`,
    );
  }

  if (
    !Number.isSafeInteger(
      order.quantity,
    ) ||
    order.quantity <=
      0
  ) {
    throw new Error(
      `${target.orderId}: quantity ไม่ถูกต้อง`,
    );
  }

  const product =
    await Product.collection
      .findOne(
        {
          productId:
            target.productId,
        },
        {
          session,
        },
      );

  if (!product) {
    throw new Error(
      `${target.orderId}: ไม่พบ Product สำหรับคืน Stock`,
    );
  }

  /*
   * จุดสำคัญ:
   * Product ถูกแก้หลัง Order
   * จึงห้ามใช้ category ปัจจุบัน backfill
   */
  if (
    !validDate(
      order.createdAt,
    ) ||
    !validDate(
      product.updatedAt,
    ) ||
    product.updatedAt <=
      order.createdAt
  ) {
    throw new Error(
      `${target.orderId}: Product timeline ไม่ตรงกับ evidence ที่อนุมัติให้ cancel`,
    );
  }

  return {
    order,
    product,
    alreadyResolved:
      false,
  };
}

async function cancelLegacyOrder(
  target:
    typeof CANCEL_TARGETS[number],
) {
  const session =
    await mongoose
      .startSession();

  try {
    let result:
      "cancelled" |
      "already_cancelled" =
        "cancelled";

    await session
      .withTransaction(
        async () => {
          const inspected =
            await inspectCancelTarget(
              target,
              session,
            );

          if (
            inspected
              .alreadyResolved
          ) {
            result =
              "already_cancelled";

            return;
          }

          const order =
            inspected.order;

          const now =
            new Date();

          const update =
            await Order.collection
              .updateOne(
                {
                  _id:
                    order._id,

                  orderId:
                    target.orderId,

                  status:
                    "pending",

                  paymentId:
                    null,

                  "metadata.stockReserved":
                    true,

                  "metadata.stockReleased": {
                    $ne:
                      true,
                  },
                },
                {
                  $set: {
                    status:
                      "cancelled",

                    cancelledAt:
                      now,

                    cancelReason:
                      "Phase 6.0: legacy Order ไม่มี trusted productCategory snapshot และยังไม่มี Payment",

                    "metadata.stockReserved":
                      false,

                    "metadata.stockReleased":
                      true,

                    "metadata.phase60Resolution":
                      "cancelled_untrusted_product_category",

                    "metadata.phase60ResolvedAt":
                      now,
                  },
                },
                {
                  session,
                },
              );

          if (
            update.matchedCount !==
              1 ||
            update.modifiedCount !==
              1
          ) {
            throw new Error(
              `${target.orderId}: ไม่สามารถ claim Order cancellation ได้`,
            );
          }

          /*
           * คืน reserved stock
           * ใน transaction เดียวกัน
           */
          const stock =
            await Product.collection
              .updateOne(
                {
                  productId:
                    target.productId,
                },
                {
                  $inc: {
                    stock:
                      order.quantity,
                  },
                },
                {
                  session,
                },
              );

          if (
            stock.matchedCount !==
            1
          ) {
            throw new Error(
              `${target.orderId}: ไม่พบ Product สำหรับคืน Stock`,
            );
          }

          if (
            stock.modifiedCount !==
            1
          ) {
            throw new Error(
              `${target.orderId}: คืน Stock ไม่สำเร็จ`,
            );
          }
        },
      );

    return result;
  } finally {
    await session
      .endSession();
  }
}

async function inspectBackfillTarget(
  session?:
    mongoose.ClientSession,
) {
  const order =
    await Order.collection
      .findOne(
        {
          orderId:
            BACKFILL_TARGET
              .orderId,
        },
        {
          session,
        },
      );

  if (!order) {
    throw new Error(
      "ไม่พบ SP BOT legacy Order",
    );
  }

  /*
   * idempotent success
   */
  if (
    order.productCategory ===
      BACKFILL_TARGET
        .category
  ) {
    return {
      order,
      alreadyResolved:
        true,
    };
  }

  if (
    order.status !==
      "pending"
  ) {
    throw new Error(
      `SP BOT Order expected pending, got ${order.status}`,
    );
  }

  if (
    order.paymentId !=
    null
  ) {
    throw new Error(
      "SP BOT Order มี Payment แล้ว ห้าม backfill ด้วย Product ปัจจุบัน",
    );
  }

  if (
    order.productCategory !=
    null
  ) {
    throw new Error(
      `SP BOT Order มี productCategory ที่ไม่คาดไว้: ${order.productCategory}`,
    );
  }

  if (
    order.productId !==
      BACKFILL_TARGET
        .productId ||
    order.productName !==
      BACKFILL_TARGET
        .productName
  ) {
    throw new Error(
      "SP BOT Product identity เปลี่ยนจาก inspection",
    );
  }

  const product =
    await Product.collection
      .findOne(
        {
          productId:
            BACKFILL_TARGET
              .productId,
        },
        {
          session,
        },
      );

  if (!product) {
    throw new Error(
      "ไม่พบ SP BOT Product",
    );
  }

  if (
    product.category !==
      BACKFILL_TARGET
        .category
  ) {
    throw new Error(
      `SP BOT current Product category เปลี่ยนแล้ว: ${product.category}`,
    );
  }

  if (
    !validDate(
      order.createdAt,
    ) ||
    !validDate(
      product.updatedAt,
    )
  ) {
    throw new Error(
      "SP BOT timeline ไม่สมบูรณ์",
    );
  }

  /*
   * Product ต้องไม่ถูก update
   * หลัง Order ถูกสร้าง
   */
  if (
    product.updatedAt >
    order.createdAt
  ) {
    throw new Error(
      "SP BOT Product ถูกเปลี่ยนหลัง Order — ห้าม backfill",
    );
  }

  return {
    order,
    product,
    alreadyResolved:
      false,
  };
}

async function backfillTrustedCategory() {
  const session =
    await mongoose
      .startSession();

  try {
    let result:
      "backfilled" |
      "already_backfilled" =
        "backfilled";

    await session
      .withTransaction(
        async () => {
          const inspected =
            await inspectBackfillTarget(
              session,
            );

          if (
            inspected
              .alreadyResolved
          ) {
            result =
              "already_backfilled";

            return;
          }

          const now =
            new Date();

          const update =
            await Order.collection
              .updateOne(
                {
                  _id:
                    inspected
                      .order._id,

                  orderId:
                    BACKFILL_TARGET
                      .orderId,

                  status:
                    "pending",

                  paymentId:
                    null,

                  $or: [
                    {
                      productCategory: {
                        $exists:
                          false,
                      },
                    },

                    {
                      productCategory:
                        null,
                    },
                  ],
                },
                {
                  $set: {
                    productCategory:
                      BACKFILL_TARGET
                        .category,

                    "metadata.phase60CategoryBackfilledAt":
                      now,

                    "metadata.phase60CategoryEvidence":
                      "product_unchanged_since_order",

                    "metadata.phase60CategorySourceProductId":
                      BACKFILL_TARGET
                        .productId,
                  },
                },
                {
                  session,
                },
              );

          if (
            update.matchedCount !==
              1 ||
            update.modifiedCount !==
              1
          ) {
            throw new Error(
              "SP BOT category backfill claim ไม่สำเร็จ",
            );
          }
        },
      );

    return result;
  } finally {
    await session
      .endSession();
  }
}

async function main() {
  console.log(
    APPLY
      ? "⚠️ Phase 6.0 legacy Order APPLY"
      : "🔎 Phase 6.0 legacy Order DRY-RUN",
  );

  await connectDatabase();

  try {
    for (
      const target
      of CANCEL_TARGETS
    ) {
      const inspected =
        await inspectCancelTarget(
          target,
        );

      console.log(
        JSON.stringify(
          {
            orderId:
              target.orderId,

            action:
              inspected
                .alreadyResolved
                ? "already_cancelled"
                : "cancel_and_release_stock",

            quantity:
              inspected
                .order
                .quantity,

            productId:
              target.productId,
          },
          null,
          2,
        ),
      );
    }

    const backfillInspection =
      await inspectBackfillTarget();

    console.log(
      JSON.stringify(
        {
          orderId:
            BACKFILL_TARGET
              .orderId,

          action:
            backfillInspection
              .alreadyResolved
              ? "already_backfilled"
              : "backfill_product_category",

          category:
            BACKFILL_TARGET
              .category,
        },
        null,
        2,
      ),
    );

    if (!APPLY) {
      console.log(
        "✅ DRY-RUN complete — no database mutation",
      );

      return;
    }

    for (
      const target
      of CANCEL_TARGETS
    ) {
      console.log(
        `${target.orderId}: ${await cancelLegacyOrder(
          target,
        )}`,
      );
    }

    console.log(
      `${BACKFILL_TARGET.orderId}: ${await backfillTrustedCategory()}`,
    );

    console.log(
      "✅ Phase 6.0 legacy Orders resolved",
    );
  } finally {
    await disconnectDatabase();
  }
}

main().catch(
  (error) => {
    console.error(
      "❌ Phase 6.0 legacy Order repair failed:",
      error,
    );

    process.exitCode =
      1;
  },
);
