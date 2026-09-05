import { Schema, model } from "mongoose";

const productSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    shopId: { type: String, required: true, index: true },
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 100, trim: true },
    description: { type: String, default: "", maxlength: 1000, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: {
      type: String,
      enum: ["game_topup", "game_keys", "gift_cards", "digital_services", "other"],
      default: "other",
    },
    stock: { type: Number, default: 0, min: 0 },
    sold: { type: Number, default: 0, min: 0 },
    imageUrl: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

export const Product = model("Product", productSchema);
