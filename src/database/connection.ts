import mongoose from "mongoose";

import {
  env,
} from "../config/env.js";

import {
  Order,
} from "../models/Order.js";

import {
  Payment,
} from "../models/Payment.js";

import {
  Refund,
} from "../models/Refund.js";

import {
  Review,
} from "../models/Review.js";

import {
  Product,
} from "../models/Product.js";

import {
  Shop,
} from "../models/Shop.js";

import {
  WebhookEvent,
} from "../models/WebhookEvent.js";

import {
  SellerLedgerEntry,
} from "../models/SellerLedgerEntry.js";

import {
  SellerFinancialState,
} from "../models/SellerFinancialState.js";

import {
  SellerPayoutAccount,
} from "../models/SellerPayoutAccount.js";

import {
  Payout,
} from "../models/Payout.js";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(
      env.MONGODB_URI,
      {
        serverSelectionTimeoutMS:
          10_000,

        /*
         * Production จัดการ indexes
         * อย่าง explicit ด้านล่าง
         */
        autoIndex: false,
      },
    );

    console.log(
      "✅ MongoDB connected",
    );

    await Promise.all([
      Order.createIndexes(),
      Payment.createIndexes(),
      Refund.createIndexes(),
      Review.createIndexes(),
      Product.createIndexes(),
      Shop.createIndexes(),
      WebhookEvent.createIndexes(),
      SellerLedgerEntry.createIndexes(),
      SellerFinancialState.createIndexes(),
      SellerPayoutAccount.createIndexes(),
      Payout.createIndexes(),
    ]);

    console.log(
      "✅ MongoDB indexes verified",
    );
  } catch (error) {
    console.error(
      "❌ MongoDB initialization failed:",
      error,
    );

    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();

  console.log(
    "🔌 MongoDB disconnected",
  );
}
