import { Product } from "../models/Product.js";
import { Shop } from "../models/Shop.js";

export const orderValidationService = {
  async validateProductForPurchase(
    productId: string,
    buyerId: string,
    quantity: number,
  ) {
    if (
      !Number.isInteger(
        quantity,
      ) ||
      quantity < 1
    ) {
      throw new Error(
        "จำนวนสินค้าต้องเป็นจำนวนเต็มอย่างน้อย 1",
      );
    }

    const product =
      await Product.findOne({
        productId,
      });

    if (!product) {
      throw new Error(
        "ไม่พบสินค้านี้",
      );
    }

    if (!product.active) {
      throw new Error(
        "สินค้านี้ปิดการขายอยู่",
      );
    }

    if (
      product.stock <
      quantity
    ) {
      throw new Error(
        `สินค้าเหลือเพียง ${product.stock} ชิ้น`,
      );
    }

    if (
      product.ownerId ===
      buyerId
    ) {
      throw new Error(
        "คุณไม่สามารถซื้อสินค้าของตัวเองได้",
      );
    }

    const shop =
      await Shop.findOne({
        shopId:
          product.shopId,
      });

    if (!shop) {
      throw new Error(
        "ไม่พบร้านค้าของสินค้า",
      );
    }

    if (
      shop.status !==
      "verified"
    ) {
      throw new Error(
        "ร้านค้านี้ยังไม่พร้อมจำหน่ายสินค้า",
      );
    }

    return {
      product,
      shop,
    };
  },
};
