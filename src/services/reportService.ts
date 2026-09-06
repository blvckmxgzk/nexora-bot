import crypto from "node:crypto";

import {
  Report,
} from "../models/Report.js";

import {
  Order,
} from "../models/Order.js";

function generateReportId(): string {
  return `RPT-${crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}

export const reportService = {
  async createScamReport(
    orderId: string,
    buyerId: string,
    reason: string,
  ) {
    const order =
      await Order.findOne({
        orderId,
      });

    if (!order) {
      throw new Error(
        "ไม่พบคำสั่งซื้อ",
      );
    }

    if (
      order.buyerId !==
      buyerId
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์รายงานคำสั่งซื้อนี้",
      );
    }

    const existing =
      await Report.findOne({
        orderId,
        buyerId,
        status: {
          $in: [
            "open",
            "investigating",
          ],
        },
      });

    if (existing) {
      throw new Error(
        "คุณมีรายงานสำหรับคำสั่งซื้อนี้อยู่แล้ว",
      );
    }

    const report =
      await Report.create({
        reportId:
          generateReportId(),

        orderId:
          order.orderId,

        buyerId:
          order.buyerId,

        sellerId:
          order.sellerId,

        shopId:
          order.shopId,

        productId:
          order.productId ??
          null,

        type:
          "scam",

        reason,

        status:
          "open",
      });

    console.log(
      `🚨 Scam report created: ${report.reportId} → Order ${orderId}`,
    );

    return report;
  },

  async getByReportId(
    reportId: string,
  ) {
    return Report.findOne({
      reportId,
    });
  },
};
