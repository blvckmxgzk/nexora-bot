import {
  Schema,
  model,
} from "mongoose";

const itemOfferSchema =
  new Schema(
    {
      itemId: {
        type: String,
        required: true,
      },

      quantity: {
        type: Number,
        required: true,
        min: 1,
      },

      netWorth: {
        type: String,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const oreOfferSchema =
  new Schema(
    {
      definitionId: {
        type: String,
        required: true,
      },

      totalWeight: {
        type: String,
        required: true,
      },

      totalNetWorth: {
        type: String,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const pickaxeOfferSchema =
  new Schema(
    {
      pickaxeInstanceId: {
        type: String,
        required: true,
      },

      definitionId: {
        type: String,
        required: true,
      },

      netWorth: {
        type: String,
        required: true,
      },
    },
    {
      _id: false,
    },
  );

const tradeSideSchema =
  new Schema(
    {
      userId: {
        type: String,
        required: true,
      },

      nexo: {
        type: String,
        default: "0",
        required: true,
      },

      items: {
        type: [
          itemOfferSchema,
        ],

        default: [],
      },

      ores: {
        type: [
          oreOfferSchema,
        ],

        default: [],
      },

      pickaxes: {
        type: [
          pickaxeOfferSchema,
        ],

        default: [],
      },

      confirmedAt: {
        type: Date,
        default: null,
      },
    },
    {
      _id: false,
    },
  );

const minerTradeSchema =
  new Schema(
    {
      tradeId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true,
      },

      guildId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      initiatorId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      partnerId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      status: {
        type: String,
        enum: [
          "open",
          "completed",
          "cancelled",
          "expired",
        ],
        default: "open",
        required: true,
        index: true,
      },

      sideA: {
        type: tradeSideSchema,
        required: true,
      },

      sideB: {
        type: tradeSideSchema,
        required: true,
      },

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      cancelledAt: {
        type: Date,
        default: null,
      },

      cancelReason: {
        type: String,
        default: null,
        maxlength: 1000,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

minerTradeSchema.index({
  status: 1,
  expiresAt: 1,
});

minerTradeSchema.index({
  initiatorId: 1,
  status: 1,
});

minerTradeSchema.index({
  partnerId: 1,
  status: 1,
});

export const MinerTrade =
  model(
    "MinerTrade",
    minerTradeSchema,
  );
