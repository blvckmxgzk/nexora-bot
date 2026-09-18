import mongoose from "mongoose";

import {
  env,
} from "../config/env.js";

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
  TradeRequest,
} from "../models/TradeRequest.js";

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

export async function connectDatabase():
  Promise<void> {
  try {
    await mongoose.connect(
      env.MONGODB_URI,
      {
        serverSelectionTimeoutMS:
          10_000,

        autoIndex:
          false,
      },
    );

    console.log(
      "✅ MongoDB connected",
    );

    await Promise.all([
      Review.createIndexes(),
      Product.createIndexes(),
      Shop.createIndexes(),
      TradeRequest.createIndexes(),
      Economy.createIndexes(),
      Transaction.createIndexes(),
      User.createIndexes(),
      UserProfile.createIndexes(),
      Guild.createIndexes(),
      Item.createIndexes(),
      ModerationLog.createIndexes(),
      SystemState.createIndexes(),
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

export async function disconnectDatabase():
  Promise<void> {
  await mongoose.disconnect();

  console.log(
    "🔌 MongoDB disconnected",
  );
}
