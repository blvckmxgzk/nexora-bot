import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Shop } from "../models/Shop.js";
import { isShopOpenAt } from "./shopHoursService.js";
import { sellerLedgerService } from "./sellerLedgerService.js";

function createOrderId(): string {
  return (
    `ORD-${Date.now()}-` +
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );
}

async function reserveStock(
  productId: string,
  quantity: number,
  session?: mongoose.ClientSession,
): Promise<boolean> {
  const result =
    await Product.updateOne(
      {
        productId,
        active: true,
        stock: {
          $gte: quantity,
        },
      },
      {
        $inc: {
          stock: -quantity,
        },
      },
      {
        session,
      },
    );

  return result.modifiedCount === 1;
}

async function releaseStock(
  productId: string,
  quantity: number,
  session?: mongoose.ClientSession,
): Promise<void> {
  if (quantity <= 0) {
    throw new Error(
      "จำนวน Stock ที่ต้องคืนต้องมากกว่า 0",
    );
  }

  const result =
    await Product.updateOne(
      {
        productId,
      },
      {
        $inc: {
          stock: quantity,
        },
      },
      {
        session,
      },
    );

  if (result.matchedCount !== 1) {
    throw new Error(
      `ไม่พบ Product สำหรับคืน Stock: ${productId}`,
    );
  }

  if (result.modifiedCount !== 1) {
    throw new Error(
      `ไม่สามารถคืน Stock ของ Product: ${productId}`,
    );
  }
}

export const orderService = {
  async getByOrderId(orderId: string) {
    return Order.findOne({ orderId });
  },

  async getBuyerOrders(buyerId: string) {
    return Order.find({
      buyerId,
    }).sort({
      createdAt: -1,
    });
  },

  async getSellerOrders(sellerId: string) {
    return Order.find({
      sellerId,
    }).sort({
      createdAt: -1,
    });
  },

  async getShopOrders(shopId: string) {
    return Order.find({
      shopId,
    }).sort({
      createdAt: -1,
    });
  },

  async createOrder(data: {
    buyerId: string;
    sellerId: string;
    shopId: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }) {
    if (
      !Number.isInteger(data.quantity) ||
      data.quantity < 1
    ) {
      throw new Error(
        "จำนวนสินค้าต้องเป็นจำนวนเต็มอย่างน้อย 1",
      );
    }

    if (
      !Number.isFinite(data.unitPrice) ||
      data.unitPrice < 0
    ) {
      throw new Error(
        "ราคาสินค้าไม่ถูกต้อง",
      );
    }

    if (
      data.buyerId ===
      data.sellerId
    ) {
      throw new Error(
        "คุณไม่สามารถซื้อสินค้าของตัวเองได้",
      );
    }

    const session =
      await mongoose.startSession();

    const orderId =
      createOrderId();

    let createdOrder: any = null;

    try {
      await session.withTransaction(
        async () => {
          /*
           * ตรวจสอบร้านภายใน transaction
           */
          const shop =
            await Shop.findOne({
              shopId:
                data.shopId,
            }).session(session);

          if (!shop) {
            throw new Error(
              "ไม่พบร้านค้า",
            );
          }

          if (
            shop.status !==
            "verified"
          ) {
            throw new Error(
              "ร้านค้านี้ยังไม่พร้อมให้บริการ",
            );
          }

          /*
           * ตรวจสอบเวลาทำการของร้าน
           */
          const shopStatus =
            isShopOpenAt(shop);

          if (!shopStatus.open) {
            throw new Error(
              `ร้านค้าปิดอยู่ในขณะนี้\n${shopStatus.reason}`,
            );
          }

          /*
           * ตรวจสอบสินค้าอีกครั้งจาก Database
           */
          const product =
            await Product.findOne({
              productId:
                data.productId,
              shopId:
                data.shopId,
              ownerId:
                data.sellerId,
              active: true,
            }).session(session);

          if (!product) {
            throw new Error(
              "ไม่พบสินค้านี้ หรือสินค้าไม่ได้เปิดขาย",
            );
          }

          /*
           * ใช้ราคาจริงจาก Database
           */
          if (
            product.price !==
            data.unitPrice
          ) {
            throw new Error(
              "ราคาสินค้ามีการเปลี่ยนแปลง กรุณาเปิดหน้าสินค้าใหม่แล้วลองอีกครั้ง",
            );
          }

          /*
           * ตรวจสอบ Stock แบบ atomic
           *
           * การเช็ก stock ด้วย product.stock
           * เพียงอย่างเดียวไม่เพียงพอเมื่อมี
           * ผู้ซื้อหลายคนพร้อมกัน
           */
          const reserved =
            await reserveStock(
              data.productId,
              data.quantity,
              session,
            );

          if (!reserved) {
            throw new Error(
              "สินค้าเหลือไม่เพียงพอ หรือสินค้าถูกปิดการขายแล้ว",
            );
          }

          const totalAmount =
            product.price *
            data.quantity;

          if (
            !Number.isFinite(
              totalAmount,
            ) ||
            totalAmount < 0
          ) {
            throw new Error(
              "ไม่สามารถคำนวณราคารวมของคำสั่งซื้อได้",
            );
          }

          const order =
            new Order({
              orderId,
              buyerId:
                data.buyerId,
              sellerId:
                data.sellerId,
              shopId:
                data.shopId,
              productId:
                data.productId,
              productName:
                product.name,

              productCategory:
                product.category,

              quantity:
                data.quantity,
              unitPrice:
                product.price,
              totalAmount,
              status: "pending",
              paymentMethod:
                "none",
              metadata: {
                stockReserved:
                  true,
                stockReleased:
                  false,
              },
            });

          await order.save({
            session,
          });

          /*
           * เพิ่มยอด Order ของร้าน
           * ใน transaction เดียวกับ Order
           */
          const updatedShop =
            await Shop.findOneAndUpdate(
              {
                shopId:
                  data.shopId,
              },
              {
                $inc: {
                  totalOrders: 1,
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!updatedShop) {
            throw new Error(
              "ไม่พบร้านค้าสำหรับอัปเดตจำนวนคำสั่งซื้อ",
            );
          }

          createdOrder =
            order;

          console.log(
            `🧾 Order created: ${order.orderId} → Shop ${data.shopId} totalOrders +1`,
          );
        },
      );

      if (!createdOrder) {
        throw new Error(
          "ไม่สามารถสร้างคำสั่งซื้อได้",
        );
      }

      return createdOrder;
    } finally {
      await session.endSession();
    }
  },

  async setAwaitingPayment(
    orderId: string,
    paymentMethod:
      | "promptpay"
      | "truemoney",
    expiresAt: Date,
  ) {
    const order =
      await Order.findOneAndUpdate(
        {
          orderId,
          status:
            "pending",
        },
        {
          $set: {
            status:
              "awaiting_payment",
            paymentMethod,
            paymentExpiresAt:
              expiresAt,
          },
        },
        {
          returnDocument:
            "after",
        },
      );

    if (!order) {
      throw new Error(
        "คำสั่งซื้อนี้ไม่อยู่ในสถานะที่สามารถเข้าสู่การชำระเงินได้",
      );
    }

    return order;
  },

  async markPaid(
    orderId: string,
    paymentId: string,
  ) {
    const order =
      await Order.findOneAndUpdate(
        {
          orderId,
          status:
            "awaiting_payment",
          paymentId,
        },
        {
          $set: {
            status: "paid",
            paidAt:
              new Date(),
          },
        },
        {
          returnDocument:
            "after",
        },
      );

    if (!order) {
      const existing =
        await Order.findOne({
          orderId,
        });

      if (
        existing?.status ===
        "paid"
      ) {
        return existing;
      }

      throw new Error(
        "คำสั่งซื้อนี้ไม่สามารถเปลี่ยนเป็นชำระเงินแล้วได้",
      );
    }

    return order;
  },

  async markProcessing(
    orderId: string,
  ) {
    const order =
      await Order.findOneAndUpdate(
        {
          orderId,
          status: "paid",
        },
        {
          $set: {
            status:
              "processing",
            processingAt:
              new Date(),
          },
        },
        {
          returnDocument:
            "after",
        },
      );

    if (!order) {
      throw new Error(
        "คำสั่งซื้อต้องอยู่ในสถานะชำระเงินแล้วก่อน",
      );
    }

    return order;
  },

  async markCompleted(
    orderId: string,
  ) {
    const session =
      await mongoose.startSession();

    let completedOrder: any = null;

    try {
      await session.withTransaction(
        async () => {
          /*
           * เปลี่ยน Order เป็น completed
           * และเพิ่ม completedOrders ของร้าน
           * ภายใน transaction เดียวกัน
           */
          const order =
            await Order.findOneAndUpdate(
              {
                orderId,
                status: {
                  $in: [
                    "processing",
                    "paid",
                  ],
                },
              },
              {
                $set: {
                  status:
                    "completed",
                  completedAt:
                    new Date(),
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!order) {
            const existing =
              await Order.findOne({
                orderId,
              }).session(session);

            if (
              existing?.status ===
              "completed"
            ) {
              completedOrder =
                existing;
              return;
            }

            throw new Error(
              "คำสั่งซื้อนี้ไม่สามารถทำให้สำเร็จได้",
            );
          }

          const shop =
            await Shop.findOneAndUpdate(
              {
                shopId:
                  order.shopId,
              },
              {
                $inc: {
                  completedOrders: 1,
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!shop) {
            throw new Error(
              "ไม่พบร้านค้าของคำสั่งซื้อ",
            );
          }

          /*
           * Credit เงินให้ Seller ภายใน
           * transaction เดียวกับ:
           *
           * - Order -> completed
           * - Shop.completedOrders +1
           *
           * ถ้า Ledger เขียนไม่ได้
           * ทุกอย่างต้อง rollback
           */
          await sellerLedgerService
            .creditCompletedOrder(
              order,
              session,
            );

          completedOrder =
            order;

          console.log(
            `✅ Order completed: ${order.orderId} → Shop ${order.shopId} completedOrders = ${shop.completedOrders}`,
          );
        },
      );

      if (!completedOrder) {
        throw new Error(
          "ไม่สามารถทำคำสั่งซื้อให้เสร็จสิ้นได้",
        );
      }

      return completedOrder;
    } finally {
      await session.endSession();
    }
  },

  async cancelOrder(
    orderId: string,
    reason?: string,
  ) {
    const session =
      await mongoose.startSession();

    try {
      let cancelledOrder: any =
        null;

      await session.withTransaction(
        async () => {
          const current =
            await Order.findOne({
              orderId,
            }).session(session);

          if (!current) {
            throw new Error(
              "ไม่พบคำสั่งซื้อ",
            );
          }

          if (
            current.status ===
              "cancelled" &&
            current.metadata
              ?.stockReleased ===
              true
          ) {
            cancelledOrder =
              current;
            return;
          }

          if (
            current.status !==
              "pending" &&
            current.status !==
              "awaiting_payment"
          ) {
            throw new Error(
              `ไม่สามารถยกเลิกคำสั่งซื้อสถานะ ${current.status} ได้`,
            );
          }

          const stockReserved =
            current.metadata
              ?.stockReserved ===
            true;

          /*
           * กรณี Stock ถูกคืนไปแล้ว
           * ไม่ต้องคืนซ้ำ
           */
          if (!stockReserved) {
            const updated =
              await Order.findOneAndUpdate(
                {
                  orderId,
                  status: {
                    $in: [
                      "pending",
                      "awaiting_payment",
                    ],
                  },
                },
                {
                  $set: {
                    status:
                      "cancelled",
                    cancelledAt:
                      new Date(),
                    cancelReason:
                      reason?.trim() ||
                      null,
                    "metadata.stockReserved":
                      false,
                    "metadata.stockReleased":
                      true,
                  },
                },
                {
                  new: true,
                  session,
                },
              );

            if (!updated) {
              const latest =
                await Order.findOne({
                  orderId,
                }).session(session);

              if (
                latest?.status ===
                  "cancelled" &&
                latest.metadata
                  ?.stockReleased ===
                  true
              ) {
                cancelledOrder =
                  latest;
                return;
              }

              throw new Error(
                "ไม่สามารถยกเลิกคำสั่งซื้อได้",
              );
            }

            cancelledOrder =
              updated;
            return;
          }

          /*
           * Stock ยังถูก reserve อยู่
           *
           * เปลี่ยน Order + คืน Stock
           * ใน MongoDB transaction เดียวกัน
           */
          const updated =
            await Order.findOneAndUpdate(
              {
                orderId,
                status: {
                  $in: [
                    "pending",
                    "awaiting_payment",
                  ],
                },
                "metadata.stockReserved":
                  true,
                "metadata.stockReleased":
                  {
                    $ne: true,
                  },
              },
              {
                $set: {
                  status:
                    "cancelled",
                  cancelledAt:
                    new Date(),
                  cancelReason:
                    reason?.trim() ||
                    null,
                  "metadata.stockReserved":
                    false,
                  "metadata.stockReleased":
                    true,
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!updated) {
            const latest =
              await Order.findOne({
                orderId,
              }).session(session);

            if (
              latest?.status ===
                "cancelled" &&
              latest.metadata
                ?.stockReleased ===
                true
            ) {
              cancelledOrder =
                latest;
              return;
            }

            throw new Error(
              "ไม่สามารถยกเลิกคำสั่งซื้อได้",
            );
          }

          await releaseStock(
            updated.productId,
            updated.quantity,
            session,
          );

          cancelledOrder =
            updated;
        },
      );

      if (!cancelledOrder) {
        throw new Error(
          "Cancel Order ไม่ได้ผลลัพธ์",
        );
      }

      return cancelledOrder;
    } finally {
      await session.endSession();
    }
  },

  async expireOrder(
    orderId: string,
  ) {
    const session =
      await mongoose.startSession();

    let expiredOrder: any =
      null;

    try {
      await session.withTransaction(
        async () => {
          const current =
            await Order.findOne({
              orderId,
            }).session(session);

          if (!current) {
            throw new Error(
              "ไม่พบคำสั่งซื้อ",
            );
          }

          /*
           * Idempotent:
           * หมดอายุและคืน Stock ไปแล้ว
           */
          if (
            current.status ===
              "cancelled" &&
            current.metadata
              ?.stockReleased ===
              true
          ) {
            expiredOrder =
              current;
            return;
          }

          if (
            current.status !==
            "awaiting_payment"
          ) {
            throw new Error(
              `ไม่สามารถ expire Order สถานะ ${current.status} ได้`,
            );
          }

          const now =
            new Date();

          const updated =
            await Order.findOneAndUpdate(
              {
                orderId,
                status:
                  "awaiting_payment",
                "metadata.stockReserved":
                  true,
                "metadata.stockReleased":
                  {
                    $ne: true,
                  },
              },
              {
                $set: {
                  status:
                    "cancelled",
                  cancelledAt:
                    now,
                  cancelReason:
                    "หมดเวลาชำระเงิน",
                  "metadata.stockReserved":
                    false,
                  "metadata.stockReleased":
                    true,
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!updated) {
            const latest =
              await Order.findOne({
                orderId,
              }).session(session);

            if (
              latest?.metadata
                ?.stockReleased ===
              true
            ) {
              expiredOrder =
                latest;
              return;
            }

            throw new Error(
              "ไม่สามารถ expire Order ได้",
            );
          }

          await releaseStock(
            updated.productId,
            updated.quantity,
            session,
          );

          expiredOrder =
            updated;
        },
      );

      if (!expiredOrder) {
        throw new Error(
          "Expire Order ไม่ได้ผลลัพธ์",
        );
      }

      return expiredOrder;
    } finally {
      await session.endSession();
    }
  },


};
