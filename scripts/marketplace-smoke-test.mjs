import {
  readFile,
} from "node:fs/promises";

const required = [
  "dist/models/TradeRequest.js",

  "dist/services/marketplace/marketplaceV2Service.js",
  "dist/services/marketplace/marketplaceV2Runtime.js",

  "dist/interactions/buttons/product-buy.js",
  "dist/interactions/buttons/product-confirm.js",
  "dist/interactions/buttons/product-cancel.js",

  "dist/interactions/buttons/shop-manage.js",
  "dist/interactions/buttons/shop-orders.js",

  "dist/interactions/buttons/trade-request.js",
  "dist/interactions/modals/trade-review.js",

  "dist/commands/marketplace/trade-admin.js",
];

for (
  const file of
    required
) {
  await readFile(
    file,
    "utf8",
  );
}

const tradeModule =
  await import(
    "../dist/models/TradeRequest.js"
  );

for (
  const status of [
    "waiting_seller",
    "contacted",
    "buyer_confirmed",
    "completed",
    "cancelled",
    "expired",
  ]
) {
  if (
    !tradeModule
      .TRADE_REQUEST_STATUSES
      .includes(
        status,
      )
  ) {
    throw new Error(
      `Missing trade status: ${status}`,
    );
  }
}

console.log(
  "✅ Marketplace v2 smoke passed",
);
