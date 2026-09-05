import {
  ShopVerificationRequest,
} from "../models/ShopVerificationRequest.js";

function createRequestId(): string {
  return `VER-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()}`;
}

export const shopVerificationService = {
  async getPendingByShopId(
    shopId: string,
  ) {
    return ShopVerificationRequest.findOne({
      shopId,
      status: "pending",
    });
  },

  async createRequest(data: {
    shopId: string;
    ownerId: string;
    rulesVersion: string;
  }) {
    const existing =
      await ShopVerificationRequest.findOne({
        shopId: data.shopId,
        status: "pending",
      });

    if (existing) {
      throw new Error(
        "ร้านนี้มีคำขอยืนยันที่กำลังรอตรวจสอบอยู่แล้ว",
      );
    }

    const request =
      new ShopVerificationRequest({
        requestId: createRequestId(),
        shopId: data.shopId,
        ownerId: data.ownerId,
        status: "pending",
        rulesVersion:
          data.rulesVersion,
        acceptedAt: new Date(),
      });

    await request.save();

    return request;
  },
};
