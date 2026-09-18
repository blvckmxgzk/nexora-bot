import mongoose from "mongoose";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

const replset =
  await MongoMemoryReplSet
    .create({
      replSet: {
        count:
          1,

        storageEngine:
          "wiredTiger",
      },
    });

try {
  await mongoose.connect(
    replset.getUri(),
  );

  const {
    Shop,
  } =
    await import(
      "../dist/models/Shop.js"
    );

  const {
    Product,
  } =
    await import(
      "../dist/models/Product.js"
    );

  const {
    TradeRequest,
  } =
    await import(
      "../dist/models/TradeRequest.js"
    );

  const {
    Review,
  } =
    await import(
      "../dist/models/Review.js"
    );

  const {
    marketplaceV2Service,
  } =
    await import(
      "../dist/services/marketplace/marketplaceV2Service.js"
    );

  await Promise.all([
    Shop.createIndexes(),
    Product.createIndexes(),
    TradeRequest.createIndexes(),
    Review.createIndexes(),
  ]);

  const dmLog =
    [];

  const fakeClient = {
    users: {
      fetch:
        async (
          userId,
        ) => ({
          send:
            async (
              payload,
            ) => {
              dmLog.push({
                userId,
                payload,
              });

              return {
                id:
                  `dm-${dmLog.length}`,
              };
            },
        }),
    },

    guilds: {
      cache: {
        first:
          () =>
            null,
      },
    },
  };

  const sellerId =
    "seller-001";

  await Shop.create({
    shopId:
      "SHOP-E2E",

    ownerId:
      sellerId,

    name:
      "Marketplace E2E Shop",

    description:
      "Automated test",

    category:
      "other",

    status:
      "verified",

    autoOpenClose:
      false,

    totalOrders:
      0,

    completedOrders:
      0,
  });

  /*
   * FINAL STOCK RACE
   */

  await Product.create({
    productId:
      "PROD-RACE",

    shopId:
      "SHOP-E2E",

    ownerId:
      sellerId,

    name:
      "Final Stock Race",

    description:
      "Race test",

    price:
      100,

    category:
      "other",

    stock:
      1,

    sold:
      0,

    active:
      true,
  });

  const tradeA =
    await marketplaceV2Service
      .createTradeRequest(
        fakeClient,
        "buyer-A",
        "PROD-RACE",
      );

  const tradeB =
    await marketplaceV2Service
      .createTradeRequest(
        fakeClient,
        "buyer-B",
        "PROD-RACE",
      );

  await marketplaceV2Service
    .sellerContacted(
      fakeClient,
      tradeA.requestId,
      sellerId,
    );

  await marketplaceV2Service
    .sellerContacted(
      fakeClient,
      tradeB.requestId,
      sellerId,
    );

  await marketplaceV2Service
    .buyerConfirm(
      fakeClient,
      tradeA.requestId,
      "buyer-A",
    );

  await marketplaceV2Service
    .buyerConfirm(
      fakeClient,
      tradeB.requestId,
      "buyer-B",
    );

  const settlementRace =
    await Promise.allSettled([
      marketplaceV2Service
        .sellerComplete(
          fakeClient,
          tradeA.requestId,
          sellerId,
        ),

      marketplaceV2Service
        .sellerComplete(
          fakeClient,
          tradeB.requestId,
          sellerId,
        ),
    ]);

  assert(
    settlementRace.filter(
      (
        result,
      ) =>
        result.status ===
        "fulfilled",
    ).length ===
      1,
    "Exactly one final-stock Trade must complete",
  );

  assert(
    settlementRace.filter(
      (
        result,
      ) =>
        result.status ===
        "rejected",
    ).length ===
      1,
    "Exactly one final-stock Trade must reject",
  );

  const raceProduct =
    await Product.findOne({
      productId:
        "PROD-RACE",
    });

  assert(
    raceProduct.stock ===
      0,
    `Stock must be 0, got ${raceProduct.stock}`,
  );

  assert(
    raceProduct.sold ===
      1,
    `Sold must be 1, got ${raceProduct.sold}`,
  );

  assert(
    raceProduct.active ===
      false,
    "Out-of-stock Product must be inactive",
  );

  const completedRaceTrades =
    await TradeRequest
      .find({
        productId:
          "PROD-RACE",

        status:
          "completed",
      });

  assert(
    completedRaceTrades.length ===
      1,
    "Exactly one Trade must complete",
  );

  const buyerConfirmedRaceTrades =
    await TradeRequest
      .find({
        productId:
          "PROD-RACE",

        status:
          "buyer_confirmed",
      });

  assert(
    buyerConfirmedRaceTrades.length ===
      1,
    "Losing race Trade must remain buyer_confirmed",
  );

  const shopAfterRace =
    await Shop.findOne({
      shopId:
        "SHOP-E2E",
    });

  assert(
    shopAfterRace.completedOrders ===
      1,
    "completedOrders must increment exactly once",
  );

  console.log(
    "✅ Atomic final-stock race: PASS",
  );

  /*
   * DOUBLE CLICK TRANSITIONS
   */

  await Product.create({
    productId:
      "PROD-DOUBLE",

    shopId:
      "SHOP-E2E",

    ownerId:
      sellerId,

    name:
      "Double Click Test",

    price:
      50,

    category:
      "other",

    stock:
      5,

    sold:
      0,

    active:
      true,
  });

  const doubleTrade =
    await marketplaceV2Service
      .createTradeRequest(
        fakeClient,
        "buyer-double",
        "PROD-DOUBLE",
      );

  const sellerClicks =
    await Promise.allSettled([
      marketplaceV2Service
        .sellerContacted(
          fakeClient,
          doubleTrade.requestId,
          sellerId,
        ),

      marketplaceV2Service
        .sellerContacted(
          fakeClient,
          doubleTrade.requestId,
          sellerId,
        ),
    ]);

  assert(
    sellerClicks.filter(
      (
        result,
      ) =>
        result.status ===
        "fulfilled",
    ).length ===
      1,
    "Seller Contacted must succeed exactly once",
  );

  const buyerClicks =
    await Promise.allSettled([
      marketplaceV2Service
        .buyerConfirm(
          fakeClient,
          doubleTrade.requestId,
          "buyer-double",
        ),

      marketplaceV2Service
        .buyerConfirm(
          fakeClient,
          doubleTrade.requestId,
          "buyer-double",
        ),
    ]);

  assert(
    buyerClicks.filter(
      (
        result,
      ) =>
        result.status ===
        "fulfilled",
    ).length ===
      1,
    "Buyer Confirm must succeed exactly once",
  );

  console.log(
    "✅ Double-click transition guards: PASS",
  );

  /*
   * REVIEW RACE
   */

  const completed =
    completedRaceTrades[
      0
    ];

  const reviewRace =
    await Promise.allSettled([
      marketplaceV2Service
        .createReview(
          fakeClient,
          completed.requestId,
          completed.buyerId,
          5,
          "ยอดเยี่ยม",
        ),

      marketplaceV2Service
        .createReview(
          fakeClient,
          completed.requestId,
          completed.buyerId,
          4,
          "ส่งพร้อมกัน",
        ),
    ]);

  assert(
    reviewRace.filter(
      (
        result,
      ) =>
        result.status ===
        "fulfilled",
    ).length ===
      1,
    "Concurrent Review must succeed exactly once",
  );

  assert(
    await Review.countDocuments({
      tradeRequestId:
        completed.requestId,
    }) ===
      1,
    "Trade must contain exactly one Review",
  );

  const reviewedTrade =
    await TradeRequest
      .findOne({
        requestId:
          completed.requestId,
      });

  assert(
    Boolean(
      reviewedTrade.reviewedAt,
    ),
    "reviewedAt must be persisted",
  );

  console.log(
    "✅ Review race protection: PASS",
  );

  /*
   * EXPIRATION VS SELLER CLICK
   */

  await Product.create({
    productId:
      "PROD-EXPIRY",

    shopId:
      "SHOP-E2E",

    ownerId:
      sellerId,

    name:
      "Expiry Race",

    price:
      10,

    category:
      "other",

    stock:
      2,

    active:
      true,
  });

  const expiryTrade =
    await marketplaceV2Service
      .createTradeRequest(
        fakeClient,
        "buyer-expiry",
        "PROD-EXPIRY",
      );

  await TradeRequest
    .updateOne(
      {
        requestId:
          expiryTrade.requestId,
      },
      {
        $set: {
          expiresAt:
            new Date(
              Date.now() -
              1000,
            ),
        },
      },
    );

  await Promise.allSettled([
    marketplaceV2Service
      .expireRequests(
        fakeClient,
      ),

    marketplaceV2Service
      .sellerContacted(
        fakeClient,
        expiryTrade.requestId,
        sellerId,
      ),
  ]);

  const expiryResult =
    await TradeRequest
      .findOne({
        requestId:
          expiryTrade.requestId,
      });

  assert(
    [
      "expired",
      "contacted",
    ].includes(
      expiryResult.status,
    ),
    `Invalid expiry race status: ${expiryResult.status}`,
  );

  console.log(
    `✅ Expiry race protection: PASS (${expiryResult.status})`,
  );

  /*
   * CANCEL RACE
   */

  await Product.create({
    productId:
      "PROD-CANCEL",

    shopId:
      "SHOP-E2E",

    ownerId:
      sellerId,

    name:
      "Cancel Race",

    price:
      20,

    category:
      "other",

    stock:
      2,

    active:
      true,
  });

  const cancelTrade =
    await marketplaceV2Service
      .createTradeRequest(
        fakeClient,
        "buyer-cancel",
        "PROD-CANCEL",
      );

  const cancelRace =
    await Promise.allSettled([
      marketplaceV2Service
        .cancel(
          fakeClient,
          cancelTrade.requestId,
          "buyer-cancel",
        ),

      marketplaceV2Service
        .cancel(
          fakeClient,
          cancelTrade.requestId,
          "buyer-cancel",
        ),
    ]);

  assert(
    cancelRace.filter(
      (
        result,
      ) =>
        result.status ===
        "fulfilled",
    ).length ===
      1,
    "Cancel must succeed exactly once",
  );

  const cancelled =
    await TradeRequest
      .findOne({
        requestId:
          cancelTrade.requestId,
      });

  assert(
    cancelled.status ===
      "cancelled",
    "Trade must become cancelled",
  );

  assert(
    !cancelled.openKey,
    "Cancelled Trade must release openKey",
  );

  console.log(
    "✅ Cancel race protection: PASS",
  );

  /*
   * CONSISTENCY
   */

  assert(
    await Product.countDocuments({
      stock: {
        $lt:
          0,
      },
    }) ===
      0,
    "Negative stock detected",
  );

  const duplicateReviews =
    await Review.aggregate([
      {
        $group: {
          _id:
            "$tradeRequestId",

          count: {
            $sum:
              1,
          },
        },
      },

      {
        $match: {
          count: {
            $gt:
              1,
          },
        },
      },
    ]);

  assert(
    duplicateReviews.length ===
      0,
    "Duplicate Trade review detected",
  );

  assert(
    dmLog.length >
      0,
    "DM handoff was not exercised",
  );

  console.log(
    "✅ No negative stock: PASS",
  );

  console.log(
    "✅ No duplicate reviews: PASS",
  );

  console.log(
    `✅ DM handoff: PASS (${dmLog.length} sends)`,
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );

  console.log(
    "✅ MARKETPLACE PRODUCTION E2E — PASSED",
  );

  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
} finally {
  await mongoose
    .disconnect()
    .catch(
      () =>
        undefined,
    );

  await replset
    .stop();
}
