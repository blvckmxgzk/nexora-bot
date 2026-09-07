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
