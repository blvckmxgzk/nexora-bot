import { Review } from "../models/Review.js";
import { Order } from "../models/Order.js";
import { Shop } from "../models/Shop.js";

function generateReviewId(): string {
  return (
    `REV-${Date.now().toString(36).toUpperCase()}-` +
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );
}

export interface CreateReviewInput {
  orderId: string;
  buyerId: string;
  rating: number;
  comment?: string;
}

export const reviewService = {
  async createReview(
    data: CreateReviewInput,
  ) {
    const order =
      await Order.findOne({
        orderId:
          data.orderId,
      });

    if (!order) {
      throw new Error(
        "ไม่พบคำสั่งซื้อ",
      );
    }

    if (
      order.buyerId !==
      data.buyerId
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์รีวิวคำสั่งซื้อนี้",
      );
    }

    if (
      order.status !==
      "completed"
    ) {
      throw new Error(
        "สามารถรีวิวได้เฉพาะคำสั่งซื้อที่เสร็จสิ้นแล้ว",
      );
    }

    const existing =
      await Review.findOne({
        orderId:
          order.orderId,
      });

    if (existing) {
      throw new Error(
        "คำสั่งซื้อนี้ถูกรีวิวไปแล้ว",
      );
    }

    const rating =
      Number(data.rating);

    if (
      !Number.isInteger(
        rating,
      ) ||
      rating < 1 ||
      rating > 5
    ) {
      throw new Error(
        "คะแนนรีวิวต้องอยู่ระหว่าง 1 ถึง 5 ดาว",
      );
    }

    const comment =
      data.comment?.trim() ??
      "";

    if (
      comment.length >
      1000
    ) {
      throw new Error(
        "ข้อความรีวิวยาวเกิน 1,000 ตัวอักษร",
      );
    }

    const review =
      await Review.create({
        reviewId:
          generateReviewId(),

        orderId:
          order.orderId,

        shopId:
          order.shopId,

        productId:
          order.productId,

        buyerId:
          order.buyerId,

        sellerId:
          order.sellerId,

        rating,

        comment,
      });

    /*
     * Rating คำนวณจากรีวิวทั้งหมด
     * ไม่ใช่แค่ 20 รีวิวที่แสดงบนหน้า Shop
     */
    const stats =
      await Review.aggregate([
        {
          $match: {
            shopId:
              order.shopId,
          },
        },
        {
          $group: {
            _id: null,
            averageRating: {
              $avg: "$rating",
            },
            reviewCount: {
              $sum: 1,
            },
          },
        },
      ]);

    const averageRating =
      stats[0]
        ?.averageRating ?? 0;

    const reviewCount =
      stats[0]
        ?.reviewCount ?? 0;

    await Shop.findOneAndUpdate(
      {
        shopId:
          order.shopId,
      },
      {
        $set: {
          rating:
            Math.round(
              averageRating * 100,
            ) / 100,

          reviewCount,
        },
      },
    );

    console.log(
      `⭐ Review created: ${review.reviewId} → ${order.shopId}`,
    );

    return review;
  },

  async getByOrderId(
    orderId: string,
  ) {
    return Review.findOne({
      orderId,
    });
  },

  /*
   * แสดงรีวิวสูงสุด 20 รายการ
   *
   * Positive:
   *   4-5 ดาว → สูงสุด 10
   *
   * Negative:
   *   1-2 ดาว → สูงสุด 10
   *
   * Neutral:
   *   3 ดาว → ใช้เติมกรณีข้อมูลไม่ครบ
   */
  async getDisplayReviews(
    shopId: string,
  ) {
    const result =
      await Review.aggregate([
        {
          $match: {
            shopId,
          },
        },

        {
          $facet: {
            positive: [
              {
                $match: {
                  rating: {
                    $gte: 4,
                  },
                },
              },
              {
                $sort: {
                  createdAt: -1,
                },
              },
              {
                $limit: 10,
              },
            ],

            negative: [
              {
                $match: {
                  rating: {
                    $lte: 2,
                  },
                },
              },
              {
                $sort: {
                  createdAt: -1,
                },
              },
              {
                $limit: 10,
              },
            ],

            neutral: [
              {
                $match: {
                  rating: 3,
                },
              },
              {
                $sort: {
                  createdAt: -1,
                },
              },
              {
                $limit: 20,
              },
            ],
          },
        },
      ]);

    const data =
      result[0] ?? {
        positive: [],
        negative: [],
        neutral: [],
      };

    const positive =
      data.positive ?? [];

    const negative =
      data.negative ?? [];

    const neutral =
      data.neutral ?? [];

    /*
     * ถ้า positive/negative ไม่ครบ
     * ให้ Neutral เติมช่องว่าง
     */
    const display =
      [
        ...positive,
        ...negative,
        ...neutral,
      ].slice(0, 20);

    return {
      positive,
      negative,
      neutral,
      display,
    };
  },

  async getShopReviewStats(
    shopId: string,
  ) {
    const result =
      await Review.aggregate([
        {
          $match: {
            shopId,
          },
        },
        {
          $group: {
            _id: "$rating",
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            _id: 1,
          },
        },
      ]);

    return result;
  },
};
