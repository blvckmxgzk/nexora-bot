import { Shop } from "../models/Shop.js";

function createShopId(): string {
  return `SHOP-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export const shopService = {
  async getByOwnerId(ownerId: string) {
    return Shop.findOne({
      ownerId,
    });
  },

  async getByShopId(shopId: string) {
    return Shop.findOne({
      shopId,
    });
  },

  async createShop(data: {
    ownerId: string;
    name: string;
    description: string;
    category:
      | "game_topup"
      | "game_keys"
      | "gift_cards"
      | "digital_services"
      | "other";
  }) {
    const existing =
      await Shop.findOne({
        ownerId: data.ownerId,
      });

    if (existing) {
      throw new Error(
        "คุณมีร้านค้าอยู่แล้ว",
      );
    }

    const shop =
      new Shop({
        shopId: createShopId(),
        ownerId: data.ownerId,
        name: data.name,
        description: data.description,
        category: data.category,
        status: "pending",
      });

    await shop.save();

    return shop;
  },
};
