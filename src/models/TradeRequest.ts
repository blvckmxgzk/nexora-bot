import {
  Schema,
  model,
} from "mongoose";

export const TRADE_REQUEST_STATUSES = [
  "waiting_seller",
  "contacted",
  "buyer_confirmed",
  "completed",
  "cancelled",
  "expired",
] as const;

export type TradeRequestStatus =
  typeof TRADE_REQUEST_STATUSES[number];

const tradeRequestSchema =
  new Schema(
    {
      requestId: {
        type:
          String,

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      /*
       * Exists only while the request is open.
       *
       * unique + sparse prevents Buyer + Product
       * from having multiple open Trade Requests.
       */
      openKey: {
        type:
          String,

        unique:
          true,

        sparse:
          true,

        index:
          true,
      },

      buyerId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      sellerId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      shopId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      productId: {
        type:
          String,

        required:
          true,

        index:
          true,
      },

      productName: {
        type:
          String,

        required:
          true,

        maxlength:
          100,
      },

      unitPriceSnapshot: {
        type:
          Number,

        required:
          true,

        min:
          0,
      },

      quantity: {
        type:
          Number,

        default:
          1,

        min:
          1,
      },

      status: {
        type:
          String,

        enum:
          TRADE_REQUEST_STATUSES,

        default:
          "waiting_seller",

        index:
          true,
      },

      contactedAt: {
        type:
          Date,

        default:
          null,
      },

      buyerConfirmedAt: {
        type:
          Date,

        default:
          null,
      },

      completedAt: {
        type:
          Date,

        default:
          null,

        index:
          true,
      },

      cancelledAt: {
        type:
          Date,

        default:
          null,
      },

      cancelledBy: {
        type:
          String,

        default:
          null,
      },

      cancelReason: {
        type:
          String,

        default:
          null,

        maxlength:
          500,
      },

      expiredAt: {
        type:
          Date,

        default:
          null,
      },

      expiresAt: {
        type:
          Date,

        required:
          true,

        index:
          true,
      },

      reviewedAt: {
        type:
          Date,

        default:
          null,
      },
    },
    {
      timestamps:
        true,

      versionKey:
        false,
    },
  );

tradeRequestSchema.index({
  buyerId:
    1,

  createdAt:
    -1,
});

tradeRequestSchema.index({
  sellerId:
    1,

  createdAt:
    -1,
});

tradeRequestSchema.index({
  shopId:
    1,

  status:
    1,

  createdAt:
    -1,
});

export const TradeRequest =
  model(
    "TradeRequest",
    tradeRequestSchema,
  );
