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

import {
  Giveaway,
} from "../models/Giveaway.js";

import {
  AnalyticsSnapshot,
} from "../models/AnalyticsSnapshot.js";

import {
  MemberDailyActivity,
} from "../models/MemberDailyActivity.js";

import {
  Ticket,
} from "../models/Ticket.js";

import {
  DungeonRun,
} from "../models/DungeonRun.js";

import {
  DungeonProfile,
} from "../models/DungeonProfile.js";

import {
  DungeonItem,
} from "../models/DungeonItem.js";

import {
  DungeonMaterial,
} from "../models/DungeonMaterial.js";

import {
  CommunityLogRecord,
} from "../models/CommunityLogRecord.js";

import {
  DatingProfile,
} from "../models/DatingProfile.js";

import {
  DatingMatch,
} from "../models/DatingMatch.js";

import {
  MatchmakingProfile,
} from "../models/MatchmakingProfile.js";

import {
  MatchmakingQueue,
} from "../models/MatchmakingQueue.js";

import {
  MatchmakingSession,
} from "../models/MatchmakingSession.js";

import {
  CardGameSession,
} from "../models/CardGameSession.js";

import {
  CardGameStats,
} from "../models/CardGameStats.js";

import {
  PuzzleSession,
} from "../models/PuzzleSession.js";

import {
  PuzzleStats,
} from "../models/PuzzleStats.js";

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
      Giveaway.createIndexes(),
      AnalyticsSnapshot.createIndexes(),
      MemberDailyActivity.createIndexes(),
      Ticket.createIndexes(),
      DungeonRun.createIndexes(),
      DungeonProfile.createIndexes(),
      DungeonItem.createIndexes(),
      DungeonMaterial.createIndexes(),
      CommunityLogRecord.createIndexes(),
      DatingProfile.createIndexes(),
      DatingMatch.createIndexes(),
      MatchmakingProfile.createIndexes(),
      MatchmakingQueue.createIndexes(),
      MatchmakingSession.createIndexes(),
      CardGameSession.createIndexes(),
      CardGameStats.createIndexes(),
      PuzzleSession.createIndexes(),
      PuzzleStats.createIndexes(),
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
