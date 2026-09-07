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

import {
  Dispute,
} from "../models/Dispute.js";

import {
  FinancialRiskAction,
} from "../models/FinancialRiskAction.js";

import {
  RiskEvent,
} from "../models/RiskEvent.js";

import {
  RiskVelocityBucket,
} from "../models/RiskVelocityBucket.js";

import {
  RiskReview,
} from "../models/RiskReview.js";

import {
  RiskReviewAction,
} from "../models/RiskReviewAction.js";

import {
  WorkerHeartbeat,
} from "../models/WorkerHeartbeat.js";

import {
  MarketplaceOpsAlert,
} from "../models/MarketplaceOpsAlert.js";

import {
  NotificationDelivery,
} from "../models/NotificationDelivery.js";

import {
  Economy,
} from "../models/Economy.js";

import {
  Transaction,
} from "../models/Transaction.js";

import {
  User,
} from "../models/User.js";

import {
  UserProfile,
} from "../models/UserProfile.js";

import {
  Guild,
} from "../models/Guild.js";

import {
  Item,
} from "../models/Item.js";

import {
  ModerationLog,
} from "../models/ModerationLog.js";

import {
  SystemState,
} from "../models/SystemState.js";

import {
  MinerProfile,
} from "../models/MinerProfile.js";

import {
  MinerPickaxe,
} from "../models/MinerPickaxe.js";

import {
  MinerOreStack,
} from "../models/MinerOreStack.js";


import {
  MinerInventoryItem,
} from "../models/MinerInventoryItem.js";

import {
  MinerActiveBoost,
} from "../models/MinerActiveBoost.js";

import {
  MinerRareDropEvent,
} from "../models/MinerRareDropEvent.js";


import {
  MinerTrade,
} from "../models/MinerTrade.js";

import {
  MinerTradeAction,
} from "../models/MinerTradeAction.js";

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
      Dispute.createIndexes(),
      FinancialRiskAction.createIndexes(),
      RiskEvent.createIndexes(),
      RiskVelocityBucket.createIndexes(),
      RiskReview.createIndexes(),
      RiskReviewAction.createIndexes(),
      WorkerHeartbeat.createIndexes(),
      MarketplaceOpsAlert.createIndexes(),
      NotificationDelivery.createIndexes(),
      Economy.createIndexes(),
      Transaction.createIndexes(),
      User.createIndexes(),
      UserProfile.createIndexes(),
      Guild.createIndexes(),
      Item.createIndexes(),
      ModerationLog.createIndexes(),
      SystemState.createIndexes(),
    
      MinerProfile.createIndexes(),
      MinerPickaxe.createIndexes(),
      MinerOreStack.createIndexes(),
      MinerInventoryItem.createIndexes(),
      MinerActiveBoost.createIndexes(),
      MinerRareDropEvent.createIndexes(),
      MinerTrade.createIndexes(),
      MinerTradeAction.createIndexes(),
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
