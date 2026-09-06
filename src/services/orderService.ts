import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
import { Shop } from "../models/Shop.js";

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
          buyerId: data.buyerId,
          sellerId: data.sellerId,
          shopId: data.shopId,
          productId: data.productId,
          productName:
            data.productName,
          quantity: data.quantity,
          unitPrice:
            data.unitPrice,
          totalAmount,
          status: "pending",
          paymentMethod: "none",
          metadata: {
            stockReserved: true,
          },
        });

      await order.save();

      /*
       * Order ถูกสร้างสำเร็จแล้ว
       * เพิ่ม totalOrders เพียงครั้งเดียว
       */
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
          status: "pending",
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
            paidAt: new Date(),
          },
        },
        {
          returnDocument: "after",
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
            status: "processing",
            processingAt:
              new Date(),
          },
        },
        {
          returnDocument: "after",
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
    /*
     * เปลี่ยนสถานะเป็น completed แบบ atomic
     *
     * เพราะ query รับเฉพาะ paid / processing
     * การกด Complete ซ้ำจะไม่ผ่าน query นี้
     * และจะไม่เพิ่ม completedOrders ซ้ำ
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
            status: "completed",
            completedAt:
              new Date(),
            deliveryData,
          },
        },
        {
          returnDocument: "after",
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

    /*
     * Order เพิ่งเปลี่ยนเป็น completed สำเร็จ
     * เพิ่ม completedOrders เพียงครั้งเดียว
     */
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
    reason: string,
  ) {
    const order =
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
            status: "cancelled",
            cancelledAt:
              new Date(),
            cancelReason:
              reason.trim(),
            "metadata.stockReserved":
              false,
            "metadata.stockReleased":
              true,
          },
        },
        {
          returnDocument: "after",
        },
      );

    if (!order) {
      const existing =
        await Order.findOne({
          orderId,
        });

      if (
        existing?.status ===
        "cancelled"
      ) {
        throw new Error(
          "คำสั่งซื้อนี้ถูกยกเลิกแล้ว",
        );
      }

      throw new Error(
        "คำสั่งซื้อนี้ไม่สามารถยกเลิกได้",
      );
    }

    await releaseStock(
      order.productId,
      order.quantity,
    );

    return order;
  },

  async expireOrder(
    orderId: string,
  ) {
    const order =
      await Order.findOneAndUpdate(
        {
          orderId,
          status:
            "awaiting_payment",
          "metadata.stockReserved":
            true,
        },
        {
          $set: {
            status: "cancelled",
            cancelledAt:
              new Date(),
            cancelReason:
              "หมดเวลาชำระเงิน",
            "metadata.stockReserved":
              false,
            "metadata.stockReleased":
              true,
          },
        },
        {
          returnDocument: "after",
        },
      );

    if (!order) {
      return Order.findOne({
        orderId,
      });
    }

    await releaseStock(
      order.productId,
      order.quantity,
    );

    return order;
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
          returnDocument: "after",
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
