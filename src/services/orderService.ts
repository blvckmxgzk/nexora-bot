import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Shop } from "../models/Shop.js";
import { isShopOpenAt } from "./shopHoursService.js";

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
    );

  return result.modifiedCount === 1;
}

async function releaseStock(
  productId: string,
  quantity: number,
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

    /*
     * ตรวจสอบร้านก่อนสร้าง Order
     */
    const shop =
      await Shop.findOne({
        shopId:
          data.shopId,
      });

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
     *
     * ใช้เวลาปัจจุบันตาม timezone
     * ที่เจ้าของร้านตั้งไว้
     */
    const shopStatus =
      isShopOpenAt(shop);

    if (!shopStatus.open) {
      throw new Error(
        `ร้านค้าปิดอยู่ในขณะนี้\n${shopStatus.reason}`,
      );
    }

    /*
     * ตรวจสอบสินค้าอีกครั้งที่ backend
     * ป้องกัน client ส่ง product/shop/seller
     * ที่ไม่ตรงกัน
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
      });

    if (!product) {
      throw new Error(
        "ไม่พบสินค้านี้ หรือสินค้าไม่ได้เปิดขาย",
      );
    }

    if (
      product.stock <
      data.quantity
    ) {
      throw new Error(
        "สินค้าเหลือไม่เพียงพอ",
      );
    }

    /*
     * ใช้ราคาจริงจาก Database
     * ไม่เชื่อราคาที่ส่งมาจาก client
     */
    if (
      product.price !==
      data.unitPrice
    ) {
      throw new Error(
        "ราคาสินค้ามีการเปลี่ยนแปลง กรุณาเปิดหน้าสินค้าใหม่แล้วลองอีกครั้ง",
      );
    }

    const reserved =
      await reserveStock(
        data.productId,
        data.quantity,
      );

    if (!reserved) {
      throw new Error(
        "สินค้าเหลือไม่เพียงพอ หรือสินค้าถูกปิดการขายแล้ว",
      );
    }

    const totalAmount =
      data.unitPrice *
      data.quantity;

    try {
      const order =
        new Order({
          orderId: createOrderId(),
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
          },
        });

      await order.save();

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
      );

      console.log(
        `🧾 Order created: ${order.orderId} → Shop ${data.shopId} totalOrders +1`,
      );

      return order;
    } catch (error) {
      await releaseStock(
        data.productId,
        data.quantity,
      );

      throw error;
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
    deliveryData: unknown = {},
  ) {
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
            status: "completed",
            completedAt:
              new Date(),
            deliveryData,
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
        "completed"
      ) {
        return existing;
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
          returnDocument:
            "after",
        },
      );

    if (!shop) {
      throw new Error(
        "ไม่พบร้านค้าของคำสั่งซื้อ",
      );
    }

    console.log(
      `✅ Order completed: ${order.orderId} → Shop ${order.shopId} completedOrders = ${shop.completedOrders}`,
    );

    return order;
  },

  async cancelOrder(
    orderId: string,
    reason?: string,
  ) {
    const order = await Order.findOne({
      orderId,
    });

    if (!order) {
      throw new Error("ไม่พบคำสั่งซื้อ");
    }

    if (
      order.status !== "pending" &&
      order.status !== "awaiting_payment"
    ) {
      throw new Error(
        `ไม่สามารถยกเลิกคำสั่งซื้อสถานะ ${order.status} ได้`,
      );
    }

    const stockReserved =
      order.metadata?.stockReserved === true;

    // Stock has already been released.
    // Only cancel the order without touching Product.stock.
    if (!stockReserved) {
      const updated = await Order.findOneAndUpdate(
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
            status: "cancelled",
            cancelledAt: new Date(),
            cancelReason: reason ?? null,
            "metadata.stockReserved": false,
            "metadata.stockReleased": true,
          },
        },
        {
          new: true,
        },
      );

      if (!updated) {
        const current = await Order.findOne({
          orderId,
        });

        if (!current) {
          throw new Error("ไม่พบคำสั่งซื้อ");
        }

        return current;
      }

      return updated;
    }

    // Atomically claim the stock-release operation.
    // Only one concurrent request can pass this condition.
    const updated = await Order.findOneAndUpdate(
      {
        orderId,
        status: {
          $in: [
            "pending",
            "awaiting_payment",
          ],
        },
        "metadata.stockReserved": true,
        "metadata.stockReleased": {
          $ne: true,
        },
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: reason ?? null,
          "metadata.stockReserved": false,
          "metadata.stockReleased": true,
        },
      },
      {
        new: true,
      },
    );

    if (!updated) {
      const current = await Order.findOne({
        orderId,
      });

      if (!current) {
        throw new Error("ไม่พบคำสั่งซื้อ");
      }

      // Another request already cancelled/released this order.
      return current;
    }

    try {
      await releaseStock(
        updated.productId,
        updated.quantity,
      );
    } catch (error) {
      console.error(
        `[OrderService] Failed to release stock for ${orderId}:`,
        error,
      );

      await Order.updateOne(
        {
          orderId,
          status: "cancelled",
        },
        {
          $set: {
            "metadata.stockReleaseFailed": true,
          },
        },
      );

      throw error;
    }

    return updated;
  },

  async expireOrder(
    orderId: string,
  ) {
    const session =
      await mongoose.startSession();

    let expiredOrder: any = null;

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

          // Idempotent: หมดอายุและคืน stock ไปแล้ว
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

          const stockResult =
            await Product.updateOne(
              {
                productId:
                  updated.productId,
              },
              {
                $inc: {
                  stock:
                    updated.quantity,
                },
              },
              {
                session,
              },
            );

          if (
            stockResult.matchedCount !==
            1
          ) {
            throw new Error(
              `ไม่พบ Product สำหรับคืน Stock: ${updated.productId}`,
            );
          }

          if (
            stockResult.modifiedCount !==
            1
          ) {
            throw new Error(
              `ไม่สามารถคืน Stock ของ Product: ${updated.productId}`,
            );
          }

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

  async refundOrder(
    orderId: string,
    reason: string,
  ) {
    const order =
      await Order.findOneAndUpdate(
        {
          orderId,
          status: {
            $in: [
              "paid",
              "processing",
              "completed",
            ],
          },
        },
        {
          $set: {
            status: "refunded",
            refundedAt:
              new Date(),
            refundReason:
              reason.trim(),
          },
        },
        {
          returnDocument:
            "after",
        },
      );

    if (!order) {
      throw new Error(
        "คำสั่งซื้อนี้ไม่สามารถคืนเงินได้",
      );
    }

    return order;
  },
};
