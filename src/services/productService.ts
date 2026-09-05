import { Product } from "../models/Product.js";

function createProductId(): string {
  return `PROD-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export const productService = {
  async getByProductId(productId: string) {
    return Product.findOne({ productId });
  },

  async getByShopId(shopId: string) {
    return Product.find({ shopId }).sort({ createdAt: -1 });
  },

  async getByOwnerId(ownerId: string) {
    return Product.find({ ownerId }).sort({ createdAt: -1 });
  },

  async createProduct(data: {
    shopId: string;
    ownerId: string;
    name: string;
    description: string;
    price: number;
    category:
      | "game_topup"
      | "game_keys"
      | "gift_cards"
      | "digital_services"
      | "other";
    stock: number;
    imageUrl?: string | null;
  }) {
    const product = new Product({
      productId: createProductId(),
      ...data,
      imageUrl: data.imageUrl ?? null,
      active: true,
    });

    await product.save();
    return product;
  },

  async updateProduct(
    productId: string,
    ownerId: string,
    data: {
      name?: string;
      description?: string;
      price?: number;
      stock?: number;
      imageUrl?: string | null;
      active?: boolean;
    },
  ) {
    return Product.findOneAndUpdate(
      { productId, ownerId },
      { $set: data },
      { new: true },
    );
  },

  async deleteProduct(productId: string, ownerId: string) {
    return Product.findOneAndDelete({
      productId,
      ownerId,
    });
  },
};
