import "dotenv/config";

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

import {
  Payment,
} from "../src/models/Payment.js";

const VALID_CATEGORIES =
  new Set([
    "game_topup",
    "game_keys",
    "gift_cards",
    "digital_services",
    "other",
  ]);

function dateValue(
  value:
    unknown,
): number | null {
  if (
    value instanceof Date &&
    Number.isFinite(
      value.getTime(),
    )
  ) {
    return value.getTime();
  }

  if (
    typeof value ===
      "string"
  ) {
    const parsed =
      new Date(
        value,
      );

    if (
      Number.isFinite(
        parsed.getTime(),
      )
    ) {
      return parsed.getTime();
    }
  }

  return null;
}

async function main() {
  await connectDatabase();

  try {
    /*
     * ใช้ raw collection query
     * เพื่อไม่ให้ Mongoose schema default
     * ทำ field ที่หายจริงดูเหมือนมีค่า "other"
     */
    const orders =
      await Order.collection
        .find({
          status: {
            $in: [
              "pending",
              "awaiting_payment",
            ],
          },

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
        })
        .sort({
          createdAt:
            1,
        })
        .toArray();

    console.log(
      `===== Legacy Open Orders: ${orders.length} =====`,
    );

    for (
      const order
      of orders
    ) {
      const product =
        order.productId
          ? await Product.collection
              .findOne({
                productId:
                  order.productId,
              })
          : null;

      const payment =
        order.paymentId
          ? await Payment.collection
              .findOne({
                paymentId:
                  order.paymentId,
              })
          : await Payment.collection
              .findOne({
                orderId:
                  order.orderId,
              });

      const orderCreated =
        dateValue(
          order.createdAt,
        );

      const productUpdated =
        dateValue(
          product?.updatedAt,
        );

      /*
       * current Product category จะถือเป็น
       * strong evidence ได้ก็ต่อเมื่อ Product
       * ไม่ได้ถูก update หลัง Order ถูกสร้าง
       *
       * ยังไม่ mutate อะไรใน script นี้
       */
      const productUnchangedSinceOrder =
        orderCreated != null &&
        productUpdated != null &&
        productUpdated <=
          orderCreated;

      const currentProductCategory =
        typeof product?.category ===
          "string" &&
        VALID_CATEGORIES.has(
          product.category,
        )
          ? product.category
          : null;

      const paymentMetadataCategory =
        typeof payment?.metadata
          ?.productCategory ===
          "string"
          ? payment
              .metadata
              .productCategory
          : null;

      console.log(
        JSON.stringify(
          {
            orderId:
              order.orderId,

            status:
              order.status,

            createdAt:
              order.createdAt ??
              null,

            updatedAt:
              order.updatedAt ??
              null,

            sellerId:
              order.sellerId ??
              null,

            shopId:
              order.shopId ??
              null,

            productId:
              order.productId ??
              null,

            productName:
              order.productName ??
              null,

            paymentId:
              order.paymentId ??
              null,

            stockReserved:
              order.metadata
                ?.stockReserved ??
              null,

            stockReleased:
              order.metadata
                ?.stockReleased ??
              null,

            productExists:
              Boolean(
                product,
              ),

            currentProductCategory,

            productCreatedAt:
              product?.createdAt ??
              null,

            productUpdatedAt:
              product?.updatedAt ??
              null,

            productUnchangedSinceOrder,

            paymentExists:
              Boolean(
                payment,
              ),

            paymentStatus:
              payment?.status ??
              null,

            paymentMetadataCategory,

            paymentPolicy:
              payment?.metadata
                ?.paymentPolicy ??
              null,
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch(
  (error) => {
    console.error(
      "❌ Legacy Order inspection failed:",
      error,
    );

    process.exitCode =
      1;
  },
);
