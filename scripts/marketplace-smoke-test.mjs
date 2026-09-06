import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../dist/database/connection.js";

import { Shop } from "../dist/models/Shop.js";
import { Product } from "../dist/models/Product.js";
import { Order } from "../dist/models/Order.js";
import { Payment } from "../dist/models/Payment.js";

import { orderService } from "../dist/services/orderService.js";
import { paymentService } from "../dist/services/paymentService.js";
import { paymentExpirationService } from "../dist/services/paymentExpirationService.js";

const PREFIX = `SMOKE-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 8)
  .toUpperCase()}`;

const IDS = {
  buyerId: `${PREFIX}-BUYER`,
  sellerId: `${PREFIX}-SELLER`,
  shopId: `${PREFIX}-SHOP`,
  productCancelId: `${PREFIX}-PRODUCT-CANCEL`,
  productExpireId: `${PREFIX}-PRODUCT-EXPIRE`,
  orderCancelId: `${PREFIX}-ORDER-CANCEL`,
  orderExpireId: `${PREFIX}-ORDER-EXPIRE`,
  paymentCancelId: `${PREFIX}-PAYMENT-CANCEL`,
  paymentExpireId: `${PREFIX}-PAYMENT-EXPIRE`,
};

let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}

function fail(name, error) {
  failed++;
  console.log(`  ❌ ${name}`);
  console.error(
    `     ${error instanceof Error ? error.message : String(error)}`,
  );
}

async function test(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error);
    throw error;
  }
}

function requiredPaths(Model) {
  return Model.schema.requiredPaths();
}

function enumValue(Model, path, fallback) {
  const schemaType = Model.schema.path(path);
  const values = schemaType?.enumValues ?? [];
  return values.length > 0 ? values[0] : fallback;
}

function buildFixture(Model, overrides) {
  const required = requiredPaths(Model);
  const data = { ...overrides };

  for (const path of required) {
    if (data[path] !== undefined) continue;

    const schemaType = Model.schema.path(path);

    if (schemaType?.enumValues?.length) {
      data[path] = schemaType.enumValues[0];
      continue;
    }

    const instance = schemaType?.instance;

    if (instance === "String") {
      data[path] = `${PREFIX}-${path.replace(/\./g, "-")}`;
    } else if (instance === "Number") {
      data[path] = 0;
    } else if (instance === "Boolean") {
      data[path] = false;
    } else if (instance === "Date") {
      data[path] = new Date();
    } else if (instance === "Array") {
      data[path] = [];
    } else if (instance === "ObjectID") {
      data[path] = new mongoose.Types.ObjectId();
    } else if (instance === "Mixed") {
      data[path] = {};
    } else {
      data[path] = null;
    }
  }

  return data;
}

async function createShop() {
  const category = enumValue(
    Shop,
    "category",
    "other",
  );

  const shopData = buildFixture(Shop, {
    shopId: IDS.shopId,
    ownerId: IDS.sellerId,
    name: "NEXORA Smoke Test Shop",
    description: "Temporary smoke-test shop",
    category,
    status: "verified",
    verifiedAt: new Date(),
    verifiedBy: "NEXORA-SMOKE-TEST",
    rating: 5,
    reviewCount: 0,
    completedOrders: 0,
    totalOrders: 0,
    paymentMethods: ["promptpay"],
    paymentDetails: {
      promptpay: "SMOKE-TEST",
    },
  });

  return Shop.create(shopData);
}

async function createProduct(productId) {
  const productData = buildFixture(Product, {
    productId,
    shopId: IDS.shopId,
    ownerId: IDS.sellerId,
    name: `Smoke Test Product ${productId}`,
    description: "Temporary smoke-test product",
    price: 10,
    stock: 10,
    sold: 0,
    active: true,
  });

  return Product.create(productData);
}

async function createOrder(product, orderId) {
  const order = await orderService.createOrder({
    buyerId: IDS.buyerId,
    sellerId: IDS.sellerId,
    shopId: IDS.shopId,
    productId: product.productId,
    productName: product.name,
    quantity: 2,
    unitPrice: product.price,
  });

  await Order.updateOne(
    { orderId: order.orderId },
    {
      $set: {
        orderId,
      },
    },
  );

  return Order.findOne({ orderId });
}

async function createPendingPayment(orderId, paymentId, expiresAt) {
  return Payment.create({
    paymentId,
    orderId,
    buyerId: IDS.buyerId,
    sellerId: IDS.sellerId,
    shopId: IDS.shopId,
    provider: "promptpay",
    amount: 20,
    status: "pending",
    providerPaymentId: null,
    expiresAt,
    metadata: {
      smokeTest: true,
    },
  });
}

async function cleanup() {
  await Promise.all([
    Shop.deleteMany({ shopId: IDS.shopId }),
    Product.deleteMany({
      productId: {
        $in: [
          IDS.productCancelId,
          IDS.productExpireId,
        ],
      },
    }),
    Order.deleteMany({
      orderId: {
        $in: [
          IDS.orderCancelId,
          IDS.orderExpireId,
        ],
      },
    }),
    Payment.deleteMany({
      paymentId: {
        $in: [
          IDS.paymentCancelId,
          IDS.paymentExpireId,
        ],
      },
    }),
  ]);
}

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════╗");
  console.log("║       NEXORA MARKETPLACE SMOKE TEST      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  await connectDatabase();
  pass("MongoDB connection");

  try {
    await cleanup();

    await test("Create verified test shop", async () => {
      await createShop();
    });

    const cancelProduct = await createProduct(
      IDS.productCancelId,
    );

    const expireProduct = await createProduct(
      IDS.productExpireId,
    );

    await test("Create test products", async () => {
      if (!cancelProduct || !expireProduct) {
        throw new Error("ไม่สามารถสร้าง test products ได้");
      }
    });

    const initialCancelStock =
      cancelProduct.stock;

    const cancelOrder =
      await createOrder(
        cancelProduct,
        IDS.orderCancelId,
      );

    if (!cancelOrder) {
      throw new Error("ไม่สามารถสร้าง Cancel Order ได้");
    }

    await Order.updateOne(
      { orderId: cancelOrder.orderId },
      {
        $set: {
          orderId: IDS.orderCancelId,
          status: "awaiting_payment",
          paymentId: IDS.paymentCancelId,
          paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          "metadata.stockReserved": true,
          "metadata.stockReleased": false,
        },
      },
    );

    await test("Order creation + stock reservation", async () => {
      const currentProduct =
        await Product.findOne({
          productId: IDS.productCancelId,
        });

      if (!currentProduct) {
        throw new Error("ไม่พบ Cancel test product");
      }

      if (
        currentProduct.stock !==
        initialCancelStock - 2
      ) {
        throw new Error(
          `Stock ไม่ถูกหักถูกต้อง: expected ${
            initialCancelStock - 2
          }, got ${currentProduct.stock}`,
        );
      }

      const currentOrder =
        await Order.findOne({
          orderId: IDS.orderCancelId,
        });

      if (
        !currentOrder ||
        currentOrder.status !==
          "awaiting_payment"
      ) {
        throw new Error(
          "Order ไม่อยู่ในสถานะ awaiting_payment",
        );
      }
    });

    await createPendingPayment(
      IDS.orderCancelId,
      IDS.paymentCancelId,
      new Date(Date.now() + 15 * 60 * 1000),
    );

    await test("Payment cancellation", async () => {
      const payment =
        await paymentService.cancelPayment(
          IDS.paymentCancelId,
        );

      if (
        payment.status !==
        "cancelled"
      ) {
        throw new Error(
          `Payment status ไม่ถูกต้อง: ${payment.status}`,
        );
      }

      const order =
        await Order.findOne({
          orderId: IDS.orderCancelId,
        });

      if (
        !order ||
        order.status !==
          "cancelled"
      ) {
        throw new Error(
          "Order ไม่ถูก cancel",
        );
      }
    });

    await test("Stock release after cancellation", async () => {
      const product =
        await Product.findOne({
          productId: IDS.productCancelId,
        });

      if (!product) {
        throw new Error("ไม่พบ Product");
      }

      if (
        product.stock !==
        initialCancelStock
      ) {
        throw new Error(
          `Stock ไม่ถูกคืนครบ: expected ${initialCancelStock}, got ${product.stock}`,
        );
      }
    });

    await test("Cancellation is idempotent", async () => {
      const result =
        await paymentService.cancelPayment(
          IDS.paymentCancelId,
        );

      if (
        result.status !==
        "cancelled"
      ) {
        throw new Error(
          "Payment ถูกเปลี่ยนสถานะผิดหลัง cancel ซ้ำ",
        );
      }

      const product =
        await Product.findOne({
          productId: IDS.productCancelId,
        });

      if (!product) {
        throw new Error("ไม่พบ Product");
      }

      if (
        product.stock !==
        initialCancelStock
      ) {
        throw new Error(
          `Stock ถูกคืนซ้ำ: ${product.stock}`,
        );
      }
    });

    const initialExpireStock =
      expireProduct.stock;

    const expireOrder =
      await createOrder(
        expireProduct,
        IDS.orderExpireId,
      );

    if (!expireOrder) {
      throw new Error(
        "ไม่สามารถสร้าง Expiration Order ได้",
      );
    }

    await Order.updateOne(
      { orderId: expireOrder.orderId },
      {
        $set: {
          orderId: IDS.orderExpireId,
          status: "awaiting_payment",
          paymentId: IDS.paymentExpireId,
          paymentExpiresAt: new Date(Date.now() - 60 * 1000),
          "metadata.stockReserved": true,
          "metadata.stockReleased": false,
        },
      },
    );

    await createPendingPayment(
      IDS.orderExpireId,
      IDS.paymentExpireId,
      new Date(Date.now() - 60 * 1000),
    );

    await test("Payment expiration", async () => {
      const count =
        await paymentExpirationService.expirePayments();

      if (count < 1) {
        throw new Error(
          "Worker ไม่พบ Payment ที่หมดอายุ",
        );
      }

      const payment =
        await Payment.findOne({
          paymentId:
            IDS.paymentExpireId,
        });

      if (
        !payment ||
        payment.status !==
          "expired"
      ) {
        throw new Error(
          `Payment status ไม่ถูกต้อง: ${payment?.status}`,
        );
      }

      const order =
        await Order.findOne({
          orderId:
            IDS.orderExpireId,
        });

      if (
        !order ||
        order.status !==
          "cancelled"
      ) {
        throw new Error(
          "Order ไม่ถูก cancel หลัง Payment expiration",
        );
      }
    });

    await test("Stock release after expiration", async () => {
      const product =
        await Product.findOne({
          productId:
            IDS.productExpireId,
        });

      if (!product) {
        throw new Error("ไม่พบ Expiration Product");
      }

      if (
        product.stock !==
        initialExpireStock
      ) {
        throw new Error(
          `Stock ไม่ถูกคืนหลัง expiration: expected ${initialExpireStock}, got ${product.stock}`,
        );
      }
    });

    await test("Expiration is idempotent", async () => {
      await paymentExpirationService.expirePayments();

      const product =
        await Product.findOne({
          productId:
            IDS.productExpireId,
        });

      if (!product) {
        throw new Error("ไม่พบ Expiration Product");
      }

      if (
        product.stock !==
        initialExpireStock
      ) {
        throw new Error(
          `Stock ถูกคืนซ้ำหลัง expiration retry: ${product.stock}`,
        );
      }
    });

    console.log("");
    console.log("╔══════════════════════════════════════════╗");
    console.log("║              TEST RESULT                ║");
    console.log("╠══════════════════════════════════════════╣");
    console.log(
      `║ Passed: ${String(passed).padEnd(31)}║`,
    );
    console.log(
      `║ Failed: ${String(failed).padEnd(31)}║`,
    );
    console.log("╚══════════════════════════════════════════╝");
    console.log("");

    if (failed > 0) {
      process.exitCode = 1;
    } else {
      console.log("🎉 ALL MARKETPLACE SMOKE TESTS PASSED!");
    }
  } finally {
    await cleanup();
    await disconnectDatabase();
  }
}

main().catch(async (error) => {
  console.error("");
  console.error("💥 MARKETPLACE SMOKE TEST FAILED");
  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : error,
  );

  try {
    await cleanup();
  } catch {}

  try {
    await disconnectDatabase();
  } catch {}

  process.exit(1);
});
