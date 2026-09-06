import {
  Schema,
  model,
} from "mongoose";

const reviewSchema =
  new Schema(
    {
      reviewId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      orderId: {
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

      productId: {
        type: String,
        required: true,
        index: true,
      },

      buyerId: {
        type: String,
        required: true,
        index: true,
      },

      sellerId: {
        type: String,
        required: true,
        index: true,
      },

      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },

      comment: {
        type: String,
        default: "",
        maxlength: 1000,
        trim: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const Review =
  model(
    "Review",
    reviewSchema,
  );
