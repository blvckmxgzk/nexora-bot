import {
  Schema,
  model,
} from "mongoose";

const minerTradeActionSchema =
  new Schema(
    {
      actionId: {
        type: String,
        required: true,
        unique: true,
        immutable: true,
      },

      tradeId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      actorId: {
        type: String,
        required: true,
        index: true,
        immutable: true,
      },

      action: {
        type: String,
        enum: [
          "create",
          "offer_nexo",
          "offer_item",
          "offer_ore",
          "offer_pickaxe",
          "clear",
          "confirm",
          "complete",
          "cancel",
          "expire",
        ],
        required: true,
        immutable: true,
      },

      details: {
        type:
          Schema.Types.Mixed,

        default: {},
        immutable: true,
      },

      occurredAt: {
        type: Date,
        default: Date.now,
        immutable: true,
        index: true,
      },
    },
    {
      timestamps: false,
      versionKey: false,
    },
  );

export const MinerTradeAction =
  model(
    "MinerTradeAction",
    minerTradeActionSchema,
  );
