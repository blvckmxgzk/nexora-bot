import crypto from "node:crypto";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
} from "discord.js";

import {
  Product,
} from "../../models/Product.js";

import {
  Review,
} from "../../models/Review.js";

import {
  Shop,
} from "../../models/Shop.js";

import {
  TradeRequest,
} from "../../models/TradeRequest.js";

import {
  isShopOpenAt,
} from "../shopHoursService.js";

import {
  communityLoggingService,
} from "../logging/communityLoggingService.js";

const REQUEST_TTL_MS =
  48 *
  60 *
  60 *
  1000;

const OPEN_STATUSES = [
  "waiting_seller",
  "contacted",
  "buyer_confirmed",
];

function generateId(
  prefix:
    string,
): string {
  return (
    `${prefix}-` +
    Date.now()
      .toString(36)
      .toUpperCase() +
    "-" +
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()
  );
}

function openKey(
  buyerId:
    string,

  productId:
    string,
): string {
  return (
    `${buyerId}:` +
    productId
  );
}

function formatPrice(
  value:
    number,
): string {
  return (
    "฿" +
    Number(
      value,
    ).toLocaleString(
      "th-TH",
    )
  );
}

function sellerWaitingRow(
  requestId:
    string,
) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_trade:seller_contacted:${requestId}`,
        )
        .setLabel(
          "ติดต่อแล้ว",
        )
        .setEmoji(
          "💬",
        )
        .setStyle(
          ButtonStyle.Success,
        ),

      new ButtonBuilder()
        .setCustomId(
          `nexora_trade:cancel:${requestId}`,
        )
        .setLabel(
          "ปฏิเสธ / ยกเลิก",
        )
        .setEmoji(
          "❌",
        )
        .setStyle(
          ButtonStyle.Danger,
        ),
    );
}

function buyerContactedRow(
  requestId:
    string,
) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_trade:buyer_confirm:${requestId}`,
        )
        .setLabel(
          "ซื้อขายสำเร็จ",
        )
        .setEmoji(
          "✅",
        )
        .setStyle(
          ButtonStyle.Success,
        ),

      new ButtonBuilder()
        .setCustomId(
          `nexora_trade:cancel:${requestId}`,
        )
        .setLabel(
          "ยกเลิก",
        )
        .setEmoji(
          "❌",
        )
        .setStyle(
          ButtonStyle.Danger,
        ),
    );
}

function sellerCompleteRow(
  requestId:
    string,
) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_trade:seller_complete:${requestId}`,
        )
        .setLabel(
          "ยืนยันสำเร็จ",
        )
        .setEmoji(
          "✅",
        )
        .setStyle(
          ButtonStyle.Success,
        ),

      new ButtonBuilder()
        .setCustomId(
          `nexora_trade:issue:${requestId}`,
        )
        .setLabel(
          "มีปัญหา",
        )
        .setEmoji(
          "⚠️",
        )
        .setStyle(
          ButtonStyle.Danger,
        ),
    );
}

function reviewRow(
  requestId:
    string,
) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_trade:review:${requestId}`,
        )
        .setLabel(
          "รีวิวร้านค้า",
        )
        .setEmoji(
          "⭐",
        )
        .setStyle(
          ButtonStyle.Primary,
        ),
    );
}

async function getUser(
  client:
    Client,

  userId:
    string,
) {
  return client.users
    .fetch(
      userId,
    )
    .catch(
      () =>
        null,
    );
}

async function dm(
  client:
    Client,

  userId:
    string,

  data:
    Parameters<
      NonNullable<
        Awaited<
          ReturnType<
            typeof getUser
          >
        >
      >["send"]
    >[0],
): Promise<boolean> {
  const user =
    await getUser(
      client,
      userId,
    );

  if (!user) {
    return false;
  }

  try {
    await user.send(
      data,
    );

    return true;
  } catch {
    return false;
  }
}

async function logMarketplace(
  client:
    Client,

  payload:
    Parameters<
      typeof communityLoggingService.marketplace
    >[1],
): Promise<void> {
  const guild =
    client.guilds.cache
      .first();

  if (!guild) {
    return;
  }

  await communityLoggingService
    .marketplace(
      guild,
      payload,
    )
    .catch(
      () =>
        undefined,
    );
}

async function recalculateRating(
  shopId:
    string,
): Promise<void> {
  const result =
    await Review.aggregate([
      {
        $match: {
          shopId,
        },
      },

      {
        $group: {
          _id:
            null,

          rating: {
            $avg:
              "$rating",
          },

          count: {
            $sum:
              1,
          },
        },
      },
    ]);

  const rating =
    result[0]
      ?.rating ??
    0;

  const count =
    result[0]
      ?.count ??
    0;

  await Shop.findOneAndUpdate(
    {
      shopId,
    },
    {
      $set: {
        rating:
          Math.round(
            rating *
            100,
          ) /
          100,

        reviewCount:
          count,
      },
    },
  );
}

async function requireRequest(
  requestId:
    string,
) {
  const request =
    await TradeRequest
      .findOne({
        requestId,
      });

  if (!request) {
    throw new Error(
      "ไม่พบ Trade Request นี้",
    );
  }

  return request;
}

async function closeOpenKey(
  request:
    any,
): Promise<void> {
  request.openKey =
    undefined;

  request.markModified(
    "openKey",
  );
}

export const marketplaceV2Service = {
  async createTradeRequest(
    client:
      Client,

    buyerId:
      string,

    productId:
      string,
  ) {
    const product =
      await Product.findOne({
        productId,

        active:
          true,

        stock: {
          $gt:
            0,
        },
      });

    if (!product) {
      throw new Error(
        "สินค้านี้ไม่มีอยู่แล้วหรือสินค้าหมด",
      );
    }

    const shop =
      await Shop.findOne({
        shopId:
          product.shopId,

        deletedAt:
          null,

        status: {
          $in: [
            "pending",
            "verified",
          ],
        },
      });

    if (!shop) {
      throw new Error(
        "ร้านค้านี้ไม่พร้อมให้บริการ",
      );
    }

    if (
      shop.ownerId ===
      buyerId
    ) {
      throw new Error(
        "ไม่สามารถติดต่อซื้อสินค้าจากร้านของตัวเองได้",
      );
    }

    const shopStatus =
      isShopOpenAt(
        shop,
      );

    if (
      !shopStatus.open
    ) {
      throw new Error(
        "ร้านปิดอยู่ในขณะนี้ กรุณาติดต่อในเวลาทำการ",
      );
    }

    const duplicate =
      await TradeRequest
        .findOne({
          openKey:
            openKey(
              buyerId,
              productId,
            ),

          status: {
            $in:
              OPEN_STATUSES,
          },
        });

    if (duplicate) {
      throw new Error(
        `คุณมี Trade Request สำหรับสินค้านี้อยู่แล้ว: ${duplicate.requestId}`,
      );
    }

    let request:
      any;

    try {
      request =
        await TradeRequest
          .create({
            requestId:
              generateId(
                "TRD",
              ),

            openKey:
              openKey(
                buyerId,
                productId,
              ),

            buyerId,

            sellerId:
              shop.ownerId,

            shopId:
              shop.shopId,

            productId:
              product.productId,

            productName:
              product.name,

            unitPriceSnapshot:
              product.price,

            quantity:
              1,

            status:
              "waiting_seller",

            expiresAt:
              new Date(
                Date.now() +
                REQUEST_TTL_MS,
              ),
          });
    } catch (
      error:
        any
    ) {
      if (
        error?.code ===
        11000
      ) {
        throw new Error(
          "คุณมี Trade Request สำหรับสินค้านี้อยู่แล้ว",
        );
      }

      throw error;
    }

    const sellerDm =
      await dm(
        client,
        request.sellerId,
        {
          content: [
            "🛒 **NEXORA Marketplace • มีลูกค้าสนใจสินค้า**",
            "",
            `📦 **สินค้า:** ${request.productName}`,
            `💰 **ราคาที่แสดง:** ${formatPrice(request.unitPriceSnapshot)}`,
            `👤 **ลูกค้า:** <@${request.buyerId}>`,
            `🆔 **User ID:** \`${request.buyerId}\``,
            `🔖 **Trade ID:** \`${request.requestId}\``,
            "",
            "หากคุณพร้อมติดต่อ Buyer ให้กด **ติดต่อแล้ว**",
            "",
            "ℹ️ NEXORA ไม่รับ ถือ หรือประมวลผลเงินจริงในการซื้อขายนี้",
          ].join(
            "\n",
          ),

          components: [
            sellerWaitingRow(
              request.requestId,
            ),
          ],

          allowedMentions: {
            parse:
              [],
          },
        },
      );

    if (!sellerDm) {
      await TradeRequest
        .deleteOne({
          _id:
            request._id,
        });

      throw new Error(
        "ไม่สามารถส่ง DM หาเจ้าของร้านได้ กรุณาลองใหม่ภายหลัง",
      );
    }

    await dm(
      client,
      request.buyerId,
      {
        content: [
          "📨 **สร้าง Trade Request แล้ว**",
          "",
          `📦 **สินค้า:** ${request.productName}`,
          `🏪 **ร้าน:** ${shop.name}`,
          `💰 **ราคาที่แสดง:** ${formatPrice(request.unitPriceSnapshot)}`,
          `🔖 **Trade ID:** \`${request.requestId}\``,
          "",
          "กำลังรอเจ้าของร้านตอบรับ",
          "NEXORA จะแจ้งคุณอีกครั้งเมื่อ Seller ติดต่อแล้ว",
        ].join(
          "\n",
        ),
      },
    );

    await Shop.findOneAndUpdate(
      {
        shopId:
          request.shopId,
      },
      {
        $inc: {
          totalOrders:
            1,
        },
      },
    );

    await logMarketplace(
      client,
      {
        event:
          "trade_created",

        title:
          "Trade Request Created",

        severity:
          "info",

        userId:
          buyerId,

        fields: [
          {
            name:
              "Trade",

            value:
              `\`${request.requestId}\``,

            inline:
              true,
          },

          {
            name:
              "Product",

            value:
              request.productName,

            inline:
              true,
          },

          {
            name:
              "Seller",

            value:
              `<@${request.sellerId}>`,

            inline:
              true,
          },
        ],

        metadata: {
          requestId:
            request.requestId,

          shopId:
            request.shopId,

          productId:
            request.productId,
        },
      },
    );

    return request;
  },

  async sellerContacted(
    client:
      Client,

    requestId:
      string,

    actorId:
      string,
  ) {
    const request =
      await requireRequest(
        requestId,
      );

    if (
      request.sellerId !==
      actorId
    ) {
      throw new Error(
        "เฉพาะ Seller ของ Trade นี้เท่านั้นที่กดได้",
      );
    }

    if (
      request.status !==
      "waiting_seller"
    ) {
      throw new Error(
        "Trade Request นี้ไม่ได้อยู่ในสถานะรอ Seller แล้ว",
      );
    }

    request.status =
      "contacted";

    request.contactedAt =
      new Date();

    await request.save();

    await dm(
      client,
      request.buyerId,
      {
        content: [
          "💬 **Seller ตอบรับ Trade Request แล้ว**",
          "",
          `📦 **สินค้า:** ${request.productName}`,
          `👤 **Seller:** <@${request.sellerId}>`,
          `🆔 **Seller ID:** \`${request.sellerId}\``,
          `🔖 **Trade ID:** \`${request.requestId}\``,
          "",
          "คุณและ Seller สามารถติดต่อและตกลงซื้อขายกันโดยตรงได้แล้ว",
          "",
          "⚠️ NEXORA ไม่รับเงิน ไม่ถือเงิน และไม่ทำ Escrow",
          "เมื่อซื้อขายกันเรียบร้อยแล้ว ให้ Buyer กด **ซื้อขายสำเร็จ**",
        ].join(
          "\n",
        ),

        components: [
          buyerContactedRow(
            request.requestId,
          ),
        ],

        allowedMentions: {
          parse:
            [],
        },
      },
    );

    await dm(
      client,
      request.sellerId,
      {
        content: [
          "✅ **บันทึกว่าคุณติดต่อ Buyer แล้ว**",
          "",
          `👤 Buyer: <@${request.buyerId}>`,
          `🔖 Trade: \`${request.requestId}\``,
          "",
          "รอ Buyer ยืนยันว่าการซื้อขายเสร็จสมบูรณ์",
        ].join(
          "\n",
        ),

        allowedMentions: {
          parse:
            [],
        },
      },
    );

    await logMarketplace(
      client,
      {
        event:
          "trade_contacted",

        title:
          "Seller Contacted Buyer",

        severity:
          "info",

        userId:
          request.buyerId,

        actorId:
          actorId,

        metadata: {
          requestId,
        },
      },
    );

    return request;
  },

  async buyerConfirm(
    client:
      Client,

    requestId:
      string,

    actorId:
      string,
  ) {
    const request =
      await requireRequest(
        requestId,
      );

    if (
      request.buyerId !==
      actorId
    ) {
      throw new Error(
        "เฉพาะ Buyer ของ Trade นี้เท่านั้นที่ยืนยันได้",
      );
    }

    if (
      request.status !==
      "contacted"
    ) {
      throw new Error(
        "Trade นี้ยังไม่พร้อมให้ Buyer ยืนยัน",
      );
    }

    request.status =
      "buyer_confirmed";

    request.buyerConfirmedAt =
      new Date();

    await request.save();

    await dm(
      client,
      request.sellerId,
      {
        content: [
          "✅ **Buyer ยืนยันว่าการซื้อขายสำเร็จแล้ว**",
          "",
          `📦 **สินค้า:** ${request.productName}`,
          `👤 **Buyer:** <@${request.buyerId}>`,
          `🔖 **Trade ID:** \`${request.requestId}\``,
          "",
          "หากทุกอย่างเรียบร้อย ให้กด **ยืนยันสำเร็จ**",
          "หากมีปัญหา ให้กด **มีปัญหา** และเปิด Ticket เพื่อให้ Staff ตรวจสอบ",
        ].join(
          "\n",
        ),

        components: [
          sellerCompleteRow(
            request.requestId,
          ),
        ],

        allowedMentions: {
          parse:
            [],
        },
      },
    );

    await dm(
      client,
      request.buyerId,
      {
        content:
          `✅ บันทึกการยืนยันของคุณแล้ว • รอ Seller ยืนยัน Trade \`${request.requestId}\``,
      },
    );

    return request;
  },

  async sellerComplete(
    client:
      Client,

    requestId:
      string,

    actorId:
      string,
  ) {
    const request =
      await requireRequest(
        requestId,
      );

    if (
      request.sellerId !==
      actorId
    ) {
      throw new Error(
        "เฉพาะ Seller ของ Trade นี้เท่านั้นที่ยืนยันได้",
      );
    }

    if (
      request.status !==
      "buyer_confirmed"
    ) {
      throw new Error(
        "Trade นี้ยังไม่พร้อมให้ Seller ยืนยัน",
      );
    }

    request.status =
      "completed";

    request.completedAt =
      new Date();

    await closeOpenKey(
      request,
    );

    await request.save();

    const product =
      await Product.findOne({
        productId:
          request.productId,
      });

    if (product) {
      const quantity =
        Math.max(
          1,
          Number(
            request.quantity ??
            1,
          ),
        );

      const stockDecrease =
        Math.min(
          Number(
            product.stock ??
            0,
          ),
          quantity,
        );

      product.stock =
        Math.max(
          0,
          Number(
            product.stock ??
            0,
          ) -
          stockDecrease,
        );

      product.sold =
        Number(
          product.sold ??
          0,
        ) +
        quantity;

      if (
        product.stock <=
        0
      ) {
        product.active =
          false;
      }

      await product.save();
    }

    await Shop.findOneAndUpdate(
      {
        shopId:
          request.shopId,
      },
      {
        $inc: {
          completedOrders:
            1,
        },
      },
    );

    await dm(
      client,
      request.buyerId,
      {
        content: [
          "🎉 **Trade Completed**",
          "",
          `📦 **สินค้า:** ${request.productName}`,
          `🔖 **Trade ID:** \`${request.requestId}\``,
          "",
          "ทั้ง Buyer และ Seller ยืนยันการซื้อขายแล้ว",
          "ตอนนี้คุณสามารถรีวิวร้านค้าได้",
        ].join(
          "\n",
        ),

        components: [
          reviewRow(
            request.requestId,
          ),
        ],
      },
    );

    await dm(
      client,
      request.sellerId,
      {
        content:
          `🎉 Trade \`${request.requestId}\` เสร็จสมบูรณ์แล้ว`,
      },
    );

    await logMarketplace(
      client,
      {
        event:
          "trade_completed",

        title:
          "Trade Completed",

        severity:
          "success",

        userId:
          request.buyerId,

        actorId:
          request.sellerId,

        fields: [
          {
            name:
              "Trade",

            value:
              `\`${request.requestId}\``,

            inline:
              true,
          },

          {
            name:
              "Product",

            value:
              request.productName,

            inline:
              true,
          },
        ],

        metadata: {
          requestId,
          shopId:
            request.shopId,
          productId:
            request.productId,
        },
      },
    );

    return request;
  },

  async cancel(
    client:
      Client,

    requestId:
      string,

    actorId:
      string,

    reason =
      "ยกเลิกโดยผู้เข้าร่วม Trade",
  ) {
    const request =
      await requireRequest(
        requestId,
      );

    if (
      request.buyerId !==
        actorId &&
      request.sellerId !==
        actorId
    ) {
      throw new Error(
        "คุณไม่ใช่ผู้เข้าร่วม Trade นี้",
      );
    }

    if (
      !OPEN_STATUSES.includes(
        request.status,
      )
    ) {
      throw new Error(
        "Trade นี้ไม่สามารถยกเลิกได้แล้ว",
      );
    }

    request.status =
      "cancelled";

    request.cancelledAt =
      new Date();

    request.cancelledBy =
      actorId;

    request.cancelReason =
      reason
        .trim()
        .slice(
          0,
          500,
        );

    await closeOpenKey(
      request,
    );

    await request.save();

    const message = [
      "❌ **Trade Request ถูกยกเลิก**",
      "",
      `📦 **สินค้า:** ${request.productName}`,
      `🔖 **Trade ID:** \`${request.requestId}\``,
      `📝 **เหตุผล:** ${request.cancelReason}`,
    ].join(
      "\n",
    );

    await Promise.all([
      dm(
        client,
        request.buyerId,
        {
          content:
            message,
        },
      ),

      dm(
        client,
        request.sellerId,
        {
          content:
            message,
        },
      ),
    ]);

    await logMarketplace(
      client,
      {
        event:
          "trade_cancelled",

        title:
          "Trade Cancelled",

        severity:
          "warning",

        userId:
          request.buyerId,

        actorId,

        description:
          request.cancelReason,

        metadata: {
          requestId,
        },
      },
    );

    return request;
  },

  async reportIssue(
    client:
      Client,

    requestId:
      string,

    actorId:
      string,
  ) {
    const request =
      await requireRequest(
        requestId,
      );

    if (
      request.sellerId !==
      actorId
    ) {
      throw new Error(
        "เฉพาะ Seller ของ Trade นี้เท่านั้นที่ใช้ปุ่มนี้ได้",
      );
    }

    if (
      request.status !==
      "buyer_confirmed"
    ) {
      throw new Error(
        "Trade นี้ไม่ได้อยู่ในขั้นตอน Seller confirmation",
      );
    }

    return this.cancel(
      client,
      requestId,
      actorId,
      "Seller แจ้งว่าการซื้อขายมีปัญหา — กรุณาเปิด Ticket เพื่อให้ Staff ตรวจสอบ",
    );
  },

  async createReview(
    client:
      Client,

    requestId:
      string,

    buyerId:
      string,

    rating:
      number,

    comment:
      string,
  ) {
    const request =
      await requireRequest(
        requestId,
      );

    if (
      request.buyerId !==
      buyerId
    ) {
      throw new Error(
        "เฉพาะ Buyer ของ Trade นี้เท่านั้นที่รีวิวได้",
      );
    }

    if (
      request.status !==
      "completed"
    ) {
      throw new Error(
        "รีวิวได้เฉพาะ Trade ที่เสร็จสมบูรณ์แล้ว",
      );
    }

    if (
      request.reviewedAt
    ) {
      throw new Error(
        "Trade นี้ถูกรีวิวไปแล้ว",
      );
    }

    if (
      !Number.isInteger(
        rating,
      ) ||
      rating <
        1 ||
      rating >
        5
    ) {
      throw new Error(
        "คะแนนต้องเป็นจำนวนเต็ม 1–5 ดาว",
      );
    }

    const cleanComment =
      comment
        .trim()
        .slice(
          0,
          1000,
        );

    const syntheticOrderId =
      `TRADE:${request.requestId}`;

    const existing =
      await Review.findOne({
        $or: [
          {
            tradeRequestId:
              request.requestId,
          },

          {
            orderId:
              syntheticOrderId,
          },
        ],
      });

    if (existing) {
      request.reviewedAt =
        request.reviewedAt ??
        new Date();

      await request.save();

      throw new Error(
        "Trade นี้ถูกรีวิวไปแล้ว",
      );
    }

    const review =
      await Review.create({
        reviewId:
          generateId(
            "REV",
          ),

        orderId:
          syntheticOrderId,

        tradeRequestId:
          request.requestId,

        shopId:
          request.shopId,

        productId:
          request.productId,

        buyerId:
          request.buyerId,

        sellerId:
          request.sellerId,

        rating,

        comment:
          cleanComment,
      });

    request.reviewedAt =
      new Date();

    await request.save();

    await recalculateRating(
      request.shopId,
    );

    await logMarketplace(
      client,
      {
        event:
          "review_created",

        title:
          "Marketplace Review Created",

        severity:
          "success",

        userId:
          buyerId,

        fields: [
          {
            name:
              "Rating",

            value:
              "⭐".repeat(
                rating,
              ),

            inline:
              true,
          },

          {
            name:
              "Trade",

            value:
              `\`${request.requestId}\``,

            inline:
              true,
          },
        ],

        metadata: {
          reviewId:
            review.reviewId,

          requestId:
            request.requestId,

          shopId:
            request.shopId,
        },
      },
    );

    return review;
  },

  async expireRequests(
    client:
      Client,
  ) {
    const requests =
      await TradeRequest
        .find({
          status:
            "waiting_seller",

          expiresAt: {
            $lte:
              new Date(),
          },
        })
        .limit(
          100,
        );

    let expired =
      0;

    for (
      const request of
        requests
    ) {
      request.status =
        "expired";

      request.expiredAt =
        new Date();

      await closeOpenKey(
        request,
      );

      await request.save();

      expired +=
        1;

      const message = [
        "⌛ **Trade Request หมดอายุ**",
        "",
        `📦 ${request.productName}`,
        `🔖 \`${request.requestId}\``,
        "",
        "Seller ไม่ตอบรับภายในเวลาที่กำหนด",
      ].join(
        "\n",
      );

      await Promise.all([
        dm(
          client,
          request.buyerId,
          {
            content:
              message,
          },
        ),

        dm(
          client,
          request.sellerId,
          {
            content:
              message,
          },
        ),
      ]);
    }

    return expired;
  },

  async adminCancel(
    client:
      Client,

    requestId:
      string,

    actorId:
      string,

    reason:
      string,
  ) {
    const request =
      await requireRequest(
        requestId,
      );

    if (
      !OPEN_STATUSES.includes(
        request.status,
      )
    ) {
      throw new Error(
        "Trade นี้ปิดไปแล้ว",
      );
    }

    request.status =
      "cancelled";

    request.cancelledAt =
      new Date();

    request.cancelledBy =
      actorId;

    request.cancelReason =
      `Staff: ${reason}`
        .slice(
          0,
          500,
        );

    await closeOpenKey(
      request,
    );

    await request.save();

    await Promise.all([
      dm(
        client,
        request.buyerId,
        {
          content:
            `🛡️ Staff ยกเลิก Trade \`${request.requestId}\`\nเหตุผล: ${reason}`,
        },
      ),

      dm(
        client,
        request.sellerId,
        {
          content:
            `🛡️ Staff ยกเลิก Trade \`${request.requestId}\`\nเหตุผล: ${reason}`,
        },
      ),
    ]);

    await logMarketplace(
      client,
      {
        event:
          "trade_admin_cancelled",

        title:
          "Trade Cancelled by Staff",

        severity:
          "warning",

        actorId,

        userId:
          request.buyerId,

        description:
          reason,

        metadata: {
          requestId,
        },
      },
    );

    return request;
  },

  async deleteReview(
    client:
      Client,

    reviewId:
      string,

    actorId:
      string,

    reason:
      string,
  ) {
    const review =
      await Review.findOne({
        reviewId,
      });

    if (!review) {
      throw new Error(
        "ไม่พบ Review นี้",
      );
    }

    const shopId =
      review.shopId;

    const tradeRequestId =
      review.tradeRequestId;

    await Review.deleteOne({
      _id:
        review._id,
    });

    if (
      tradeRequestId
    ) {
      await TradeRequest
        .findOneAndUpdate(
          {
            requestId:
              tradeRequestId,
          },
          {
            $set: {
              reviewedAt:
                null,
            },
          },
        );
    }

    await recalculateRating(
      shopId,
    );

    await logMarketplace(
      client,
      {
        event:
          "review_deleted",

        title:
          "Marketplace Review Removed",

        severity:
          "warning",

        actorId,

        description:
          reason,

        metadata: {
          reviewId,
          shopId,
        },
      },
    );

    return review;
  },

  getOpenTrades() {
    return TradeRequest
      .find({
        status: {
          $in:
            OPEN_STATUSES,
        },
      })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        20,
      );
  },

  getHistory(
    userId?:
      string,
  ) {
    const filter =
      userId
        ? {
            $or: [
              {
                buyerId:
                  userId,
              },

              {
                sellerId:
                  userId,
              },
            ],
          }
        : {};

    return TradeRequest
      .find(
        filter,
      )
      .sort({
        createdAt:
          -1,
      })
      .limit(
        20,
      );
  },
};
