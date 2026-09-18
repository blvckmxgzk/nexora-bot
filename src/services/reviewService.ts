import {
  Review,
} from "../models/Review.js";

export const reviewService = {
  async getByOrderId(
    orderId:
      string,
  ) {
    return Review.findOne({
      orderId,
    });
  },

  async getDisplayReviews(
    shopId:
      string,
  ) {
    const reviews =
      await Review.find({
        shopId,
      })
        .sort({
          createdAt:
            -1,
        })
        .limit(
          20,
        );

    return {
      positive:
        reviews.filter(
          (
            review,
          ) =>
            review.rating >=
            4,
        ),

      negative:
        reviews.filter(
          (
            review,
          ) =>
            review.rating <=
            2,
        ),

      neutral:
        reviews.filter(
          (
            review,
          ) =>
            review.rating ===
            3,
        ),

      display:
        reviews,
    };
  },

  async getShopReviewStats(
    shopId:
      string,
  ) {
    return Review.aggregate([
      {
        $match: {
          shopId,
        },
      },

      {
        $group: {
          _id:
            "$rating",

          count: {
            $sum:
              1,
          },
        },
      },

      {
        $sort: {
          _id:
            1,
        },
      },
    ]);
  },
};
