import {
  Schema,
  model,
} from "mongoose";

const financialRiskActionSchema =
  new Schema(
    {
      actionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      sourceKey: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      action: {
        type: String,
        enum: [
          "resolve_lost_dispute",
        ],
        required: true,
        index: true,
      },

      disputeId: {
        type: String,
        required: true,
        index: true,
      },

      providerDisputeId: {
        type: String,
        required: true,
        index: true,
      },

      sellerId: {
        type: String,
        required: true,
        index: true,
      },

      shopId: {
        type: String,
        required: true,
        index: true,
      },

      actorId: {
        type: String,
        required: true,
        index: true,
      },

      reason: {
        type: String,
        required: true,
        maxlength: 2000,
      },

      sellerBalanceSatang: {
        type: Number,
        required: true,
      },

      metadata: {
        type:
          Schema.Types.Mixed,
        default: {},
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

financialRiskActionSchema.index({
  sellerId: 1,
  createdAt: -1,
});

financialRiskActionSchema.index({
  disputeId: 1,
  createdAt: -1,
});

export const FinancialRiskAction =
  model(
    "FinancialRiskAction",
    financialRiskActionSchema,
  );
