import {
  Schema,
  model,
} from "mongoose";

const sellerFinancialStateSchema =
  new Schema(
    {
      sellerId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      shopId: {
        type: String,
        required: true,
        index: true,
      },

      /*
       * Financial Risk state
       *
       * payoutFrozen เป็น authoritative
       * server-side payout gate
       *
       * ห้ามใช้ UI เป็น risk control
       */
      payoutFrozen: {
        type: Boolean,
        default: false,
        index: true,
      },

      riskStatus: {
        type: String,
        enum: [
          "clear",
          "dispute_review",
          "dispute_lost",
        ],
        default: "clear",
        index: true,
      },

      riskReason: {
        type: String,
        default: null,
        maxlength: 2000,
      },

      riskDisputeId: {
        type: String,
        default: null,
        index: true,
      },

      riskUpdatedAt: {
        type: Date,
        default: null,
      },

      /*
       * ใช้เป็น serialization mutex
       * สำหรับ Ledger mutation เท่านั้น
       *
       * Balance จริงยังคำนวณจาก Ledger
       */
      revision: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const SellerFinancialState =
  model(
    "SellerFinancialState",
    sellerFinancialStateSchema,
  );
