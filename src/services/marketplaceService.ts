import { Product } from "../models/Product.js";
import { Shop } from "../models/Shop.js";

export const MARKETPLACE_PAGE_SIZE = 6;

export type MarketplaceItemType =
  | "shops"
  | "products";

export interface MarketplaceSearchOptions {
  type: MarketplaceItemType;
  query?: string;
  category?: string;
  page?: number;
}

export async function searchMarketplace({
  type,
  query,
  category,
  page = 1,
}: MarketplaceSearchOptions) {
  const safePage =
    Math.max(
      1,
      Math.floor(page),
    );

  const skip =
    (safePage - 1) *
    MARKETPLACE_PAGE_SIZE;

  const search =
    query?.trim();

  if (type === "shops") {
    const filter: Record<
      string,
      unknown
    > = {
      status: "verified",
    };

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },
        {
          description: {
            $regex: escapeRegex(search),
            $options: "i",
          },
        },
      ];
    }

    if (category) {
      filter.category = category;
    }

    const [
      items,
      total,
    ] = await Promise.all([
      Shop.find(filter)
        .sort({
          rating: -1,
          completedOrders: -1,
          createdAt: -1,
        })
        .skip(skip)
        .limit(MARKETPLACE_PAGE_SIZE),

      Shop.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: safePage,
      totalPages:
        Math.max(
          1,
          Math.ceil(
            total /
              MARKETPLACE_PAGE_SIZE,
          ),
        ),
    };
  }

  const verifiedShopIds =
    await Shop.distinct(
      "shopId",
      {
        status: "verified",
      },
    );

  const filter: Record<
    string,
    unknown
  > = {
    active: true,
    stock: {
      $gt: 0,
    },
    shopId: {
      $in: verifiedShopIds,
    },
  };

  if (search) {
    filter.$or = [
      {
        name: {
          $regex: escapeRegex(search),
          $options: "i",
        },
      },
      {
        description: {
          $regex: escapeRegex(search),
          $options: "i",
        },
      },
    ];
  }

  if (category) {
    filter.category = category;
  }

  const [
    items,
    total,
  ] = await Promise.all([
    Product.find(filter)
      .sort({
        sold: -1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(MARKETPLACE_PAGE_SIZE),

    Product.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page: safePage,
    totalPages:
      Math.max(
        1,
        Math.ceil(
          total /
            MARKETPLACE_PAGE_SIZE,
        ),
      ),
  };
}

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}
