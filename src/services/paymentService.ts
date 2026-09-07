import mongoose from "mongoose";

import { Payment } from "../models/Payment.js";
import { Order } from "../models/Order.js";
import { Shop } from "../models/Shop.js";
import { Product } from "../models/Product.js";

import {
  platformPaymentCapabilityService,
} from "./payment/platformPaymentCapabilityService.js";

import {
  paymentProviderRegistry,
} from "./payment/paymentProviderRegistry.js";

import {
  getMarketplaceDiscordClient,
} from "./marketplace/marketplaceNotificationService.js";

import {
  sendBuyerOrderPaidDM,
} from "./marketplace/buyerOrderNotificationService.js";

import {
  sendSellerOrderPaidDM,
} from "./marketplace/sellerOrderNotificationService.js";

async function finalizeFailedPayment(
  paymentId: string,
) {
  const session =
    await mongoose.startSession();

  let failedPayment: any =
    null;

  try {
    await session.withTransaction(
      async () => {
        const payment =
          await Payment.findOne({
            paymentId,
          }).session(session);

        if (!payment) {
          throw new Error(
            "ไม่พบ Payment",
          );
        }

        if (
          payment.status ===
          "failed"
        ) {
          failedPayment =
            payment;
          return;
        }

        if (
          payment.status !==
          "pending"
        ) {
          throw new Error(
            `ไม่สามารถเปลี่ยน Payment สถานะ ${payment.status} เป็น failed ได้`,
          );
        }

        const order =
          await Order.findOne({
            orderId:
              payment.orderId,
          }).session(session);

        if (!order) {
          throw new Error(
            "ไม่พบ Order ที่ผูกกับ Payment",
          );
        }

        if (
          order.status !==
            "awaiting_payment" ||
          order.paymentId !==
            payment.paymentId
        ) {
          throw new Error(
            `Order ${order.orderId} ไม่อยู่ในสถานะ awaiting_payment`,
          );
        }

        const now =
          new Date();

        const updatedPayment =
          await Payment
            .findOneAndUpdate(
              {
                paymentId,
                status:
                  "pending",
              },
              {
                $set: {
                  status:
                    "failed",
                },
              },
              {
                new: true,
                session,
              },
            );

        if (!updatedPayment) {
          throw new Error(
            "Payment ถูกเปลี่ยนสถานะก่อน finalize failed",
          );
        }

        const updatedOrder =
          await Order
            .findOneAndUpdate(
              {
                orderId:
                  order.orderId,

                status:
                  "awaiting_payment",

                paymentId:
                  payment.paymentId,

                "metadata.stockReserved":
                  true,

                "metadata.stockReleased":
                  {
                    $ne: true,
                  },
              },
              {
                $set: {
                  status:
                    "cancelled",

                  cancelledAt:
                    now,

                  cancelReason:
                    "Payment Provider แจ้งว่าการชำระเงินล้มเหลว",

                  "metadata.stockReserved":
                    false,

                  "metadata.stockReleased":
                    true,
                },
              },
              {
                new: true,
                session,
              },
            );

        if (!updatedOrder) {
          throw new Error(
            "ไม่สามารถปิด Order หลัง Payment failed ได้",
          );
        }

        const stockResult =
          await Product.updateOne(
            {
              productId:
                updatedOrder.productId,
            },
            {
              $inc: {
                stock:
                  updatedOrder.quantity,
              },
            },
            {
              session,
            },
          );

        if (
          stockResult.matchedCount !==
          1
        ) {
          throw new Error(
            `ไม่พบ Product สำหรับคืน Stock: ${updatedOrder.productId}`,
          );
        }

        failedPayment =
          updatedPayment;
      },
    );

    if (!failedPayment) {
      throw new Error(
        "Payment failed finalization ไม่ได้ผลลัพธ์",
      );
    }

    return failedPayment;
  } finally {
    await session.endSession();
  }
}

export const paymentService = {
  async getByPaymentId(
    paymentId: string,
  ) {
    return Payment.findOne({
      paymentId,
    });
  },

  async findByProviderPaymentId(
    providerPaymentId: string,
  ) {
    return Payment.findOne({
      providerPaymentId,
    });
  },

  async getByOrderId(
    orderId: string,
  ) {
    return Payment.findOne({
      orderId,
    });
  },

  async createPayment(data: {
    orderId: string;
    buyerId: string;
    provider:
      | "promptpay"
      | "truemoney";
  }) {
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

    const paymentOrder =
      order;

    if (
      paymentOrder.buyerId !==
      data.buyerId
    ) {
      throw new Error(
        "คุณไม่มีสิทธิ์ชำระคำสั่งซื้อนี้",
      );
    }

    const shop =
      await Shop.findOne({
        shopId:
          order.shopId,
      });

    if (!shop) {
      throw new Error(
        "ไม่พบร้านค้า",
      );
    }

    if (
      shop.status !==
      "verified"
    ) {
      throw new Error(
        "ร้านค้านี้ยังไม่พร้อมรับคำสั่งซื้อ",
      );
    }

    const provider =
      paymentProviderRegistry.get(
        data.provider,
      );

    let paymentPolicyCategory:
      string |
      null =
        null;

    async function resolveExisting(
      payment: any,
    ) {
      if (
        payment.provider !==
        data.provider
      ) {
        throw new Error(
          `คำสั่งซื้อนี้มี Payment ช่องทาง ${payment.provider} อยู่แล้ว`,
        );
      }

      if (
        payment.status ===
        "pending"
      ) {
        return payment;
      }

      if (
        payment.status !==
        "creating"
      ) {
        throw new Error(
          `Payment นี้อยู่ในสถานะ ${payment.status} และไม่สามารถสร้างใหม่ได้`,
        );
      }

      const hasCreationError =
        typeof payment.metadata
          ?.creationLastError ===
          "string" &&
        payment.metadata
          .creationLastError
          .trim()
          .length > 0;

      /*
       * ถ้า owner request ยังไม่มี error:
       * อาจกำลังคุยกับ Provider อยู่จริง
       * จึงรอ local finalize ก่อนเล็กน้อย
       *
       * แต่ถ้ามี creationLastError แล้ว
       * แปลว่า request ก่อนหน้าจบแบบ ambiguous
       * จึงเข้า recovery search ได้ทันที
       */
      if (!hasCreationError) {
        for (
          let attempt = 0;
          attempt < 25;
          attempt++
        ) {
          await new Promise<void>(
            (resolve) => {
              setTimeout(
                resolve,
                200,
              );
            },
          );

          const current =
            await Payment.findOne({
              paymentId:
                payment.paymentId,
            });

          if (!current) {
            throw new Error(
              "Payment ที่กำลังสร้างหายไปจากระบบ",
            );
          }

          if (
            current.status ===
            "pending"
          ) {
            return current;
          }

          if (
            current.status !==
            "creating"
          ) {
            throw new Error(
              `Payment ถูกเปลี่ยนเป็นสถานะ ${current.status}`,
            );
          }

          payment =
            current;
        }
      }

      /*
       * ถ้า request owner ตายหลัง Omise สร้าง Charge
       * แต่ก่อน local finalize:
       * ค้น Charge เดิมจาก metadata
       *
       * สำคัญ: ถ้าหาไม่เจอ ห้ามสร้าง Charge ใหม่
       */
      if (
        !provider.findExistingPayment
      ) {
        throw new Error(
          "Payment กำลังอยู่ระหว่างการตรวจสอบ กรุณาลองใหม่ภายหลัง",
        );
      }

      const recovered =
        await provider
          .findExistingPayment({
            paymentId:
              payment.paymentId,

            orderId:
              paymentOrder.orderId,

            amount:
              paymentOrder.totalAmount,

            provider:
              data.provider,

            expiresAt:
              payment.expiresAt,
          });

      if (!recovered) {
        throw new Error(
          "Payment อยู่ระหว่างการตรวจสอบกับ Payment Provider ระบบจะไม่สร้าง QR ซ้ำเพื่อป้องกันการชำระเงินซ้ำ",
        );
      }

      return finalizeCreation(
        payment.paymentId,
        recovered,
      );
    }

    async function finalizeCreation(
      paymentId: string,
      providerPayment: {
        provider:
          | "promptpay"
          | "truemoney";
        providerPaymentId: string;
        paymentReference: string;
        paymentUrl?: string | null;
        qrData?: string | null;
        instructions?: string | null;
        expiresAt?: Date | null;
      },
    ) {
      if (
        !providerPayment
          .providerPaymentId
      ) {
        throw new Error(
          "Payment Provider ไม่ได้ส่ง Payment ID กลับมา",
        );
      }

      if (
        providerPayment.provider !==
        data.provider
      ) {
        throw new Error(
          "Payment Provider ที่ตอบกลับมาไม่ตรงกับช่องทางที่เลือก",
        );
      }

      const session =
        await mongoose.startSession();

      let finalized: any =
        null;

      try {
        await session.withTransaction(
          async () => {
            const current =
              await Payment.findOne({
                paymentId,
              }).session(session);

            if (!current) {
              throw new Error(
                "ไม่พบ Payment สำหรับ finalize",
              );
            }

            if (
              current.status ===
              "pending"
            ) {
              if (
                current.providerPaymentId !==
                providerPayment
                  .providerPaymentId
              ) {
                throw new Error(
                  "Payment ถูกผูกกับ Provider Charge อื่นแล้ว",
                );
              }

              finalized =
                current;

              return;
            }

            if (
              current.status !==
              "creating"
            ) {
              throw new Error(
                `Payment สถานะ ${current.status} ไม่สามารถ finalize การสร้างได้`,
              );
            }

            const currentOrder =
              await Order.findOne({
                orderId:
                  current.orderId,
              }).session(session);

            if (!currentOrder) {
              throw new Error(
                "ไม่พบ Order สำหรับ Payment",
              );
            }

            if (
              currentOrder.status !==
                "awaiting_payment" ||
              currentOrder.paymentId !==
                current.paymentId
            ) {
              throw new Error(
                "Order ไม่ได้ถือ Payment creation claim นี้แล้ว",
              );
            }

            const providerExpiresAt =
              providerPayment
                  .expiresAt
                instanceof Date &&
              Number.isFinite(
                providerPayment
                  .expiresAt
                  .getTime(),
              )
                ? providerPayment
                    .expiresAt
                : current.expiresAt;

            const updatedPayment =
              await Payment
                .findOneAndUpdate(
                  {
                    paymentId,
                    status:
                      "creating",
                  },
                  {
                    $set: {
                      status:
                        "pending",

                      providerPaymentId:
                        providerPayment
                          .providerPaymentId,

                      expiresAt:
                        providerExpiresAt,

                      "metadata.paymentReference":
                        providerPayment
                          .paymentReference,

                      "metadata.paymentUrl":
                        providerPayment
                          .paymentUrl ??
                        null,

                      "metadata.qrData":
                        providerPayment
                          .qrData ??
                        null,

                      "metadata.instructions":
                        providerPayment
                          .instructions ??
                        null,

                      "metadata.collectionRouting":
                        "platform_merchant",

                      "metadata.creationLastError":
                        null,
                    },
                  },
                  {
                    new: true,
                    session,
                  },
                );

            if (!updatedPayment) {
              throw new Error(
                "ไม่สามารถ finalize Payment creation ได้",
              );
            }

            const updatedOrder =
              await Order
                .findOneAndUpdate(
                  {
                    orderId:
                      currentOrder
                        .orderId,

                    status:
                      "awaiting_payment",

                    paymentId:
                      current.paymentId,
                  },
                  {
                    $set: {
                      paymentMethod:
                        data.provider,

                      paymentExpiresAt:
                        providerExpiresAt,
                    },
                  },
                  {
                    new: true,
                    session,
                  },
                );

            if (!updatedOrder) {
              throw new Error(
                "ไม่สามารถ finalize Order payment state ได้",
              );
            }

            finalized =
              updatedPayment;
          },
        );

        if (!finalized) {
          throw new Error(
            "Payment creation finalization ไม่ได้ผลลัพธ์",
          );
        }

        return finalized;
      } finally {
        await session.endSession();
      }
    }

    const existingBeforeClaim =
      await Payment.findOne({
        orderId:
          order.orderId,
      });

    if (existingBeforeClaim) {
      return resolveExisting(
        existingBeforeClaim,
      );
    }

    if (
      order.status !==
      "pending"
    ) {
      throw new Error(
        "คำสั่งซื้อนี้ไม่พร้อมสำหรับการชำระเงิน",
      );
    }

    /*
     * Payment policy ใช้ snapshot จาก Order
     *
     * ห้ามอ่าน category จาก Product ปัจจุบัน
     * เพราะ Seller อาจแก้ Product หลังสร้าง Order
     */
    paymentPolicyCategory =
      typeof order.productCategory ===
        "string"
        ? order.productCategory
        : "other";

    await platformPaymentCapabilityService
      .assertMethodAllowed({
        provider:
          data.provider,

        category:
          paymentPolicyCategory,

        amountBaht:
          order.totalAmount,
      });

    const paymentId =
      `PAY-${Date.now()}-` +
      Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase();

    const expiresAt =
      new Date(
        Date.now() +
          15 * 60 * 1000,
      );

    const session =
      await mongoose.startSession();

    let claimedPayment: any =
      null;

    let ownsClaim =
      false;

    try {
      try {
        await session.withTransaction(
          async () => {
            const currentOrder =
              await Order.findOne({
                orderId:
                  order.orderId,
              }).session(session);

            if (!currentOrder) {
              throw new Error(
                "ไม่พบคำสั่งซื้อ",
              );
            }

            if (
              currentOrder.buyerId !==
              data.buyerId
            ) {
              throw new Error(
                "คุณไม่มีสิทธิ์ชำระคำสั่งซื้อนี้",
              );
            }

            const existing =
              await Payment.findOne({
                orderId:
                  currentOrder.orderId,
              }).session(session);

            if (existing) {
              claimedPayment =
                existing;

              return;
            }

            if (
              currentOrder.status !==
              "pending"
            ) {
              throw new Error(
                "คำสั่งซื้อนี้ไม่พร้อมสำหรับการชำระเงิน",
              );
            }

            /*
             * Re-read snapshot ภายใน transaction
             * เพื่อป้องกัน Order ถูกเปลี่ยนระหว่าง
             * policy evaluation กับ payment claim
             */
            const currentCategory =
              typeof currentOrder
                .productCategory ===
                "string"
                ? currentOrder
                    .productCategory
                : "other";

            if (
              currentCategory !==
              paymentPolicyCategory
            ) {
              throw new Error(
                "Payment policy snapshot ของ Order ถูกเปลี่ยนระหว่างสร้าง Payment",
              );
            }

            const payment =
              new Payment({
                paymentId,

                orderId:
                  currentOrder.orderId,

                buyerId:
                  currentOrder.buyerId,

                sellerId:
                  currentOrder.sellerId,

                shopId:
                  currentOrder.shopId,

                provider:
                  data.provider,

                amount:
                  currentOrder.totalAmount,

                status:
                  "creating",

                providerPaymentId:
                  null,

                expiresAt,

                metadata: {
                  collectionRouting:
                    "platform_merchant",

                  productCategory:
                    paymentPolicyCategory,

                  paymentPolicy:
                    "platform_capability_v1",

                  creationClaimedAt:
                    new Date(),

                  creationLastError:
                    null,
                },
              });

            await payment.save({
              session,
            });

            const updatedOrder =
              await Order
                .findOneAndUpdate(
                  {
                    orderId:
                      currentOrder
                        .orderId,

                    status:
                      "pending",
                  },
                  {
                    $set: {
                      status:
                        "awaiting_payment",

                      paymentMethod:
                        data.provider,

                      paymentId:
                        payment.paymentId,

                      paymentExpiresAt:
                        expiresAt,
                    },
                  },
                  {
                    new: true,
                    session,
                  },
                );

            if (!updatedOrder) {
              throw new Error(
                "Order ถูกเปลี่ยนสถานะก่อน claim Payment",
              );
            }

            claimedPayment =
              payment;

            ownsClaim =
              true;
          },
        );
      } catch (error: any) {
        if (
          error?.code !==
          11000
        ) {
          throw error;
        }

        claimedPayment =
          await Payment.findOne({
            orderId:
              order.orderId,
          });

        if (!claimedPayment) {
          throw error;
        }

        ownsClaim =
          false;
      }

      if (!claimedPayment) {
        throw new Error(
          "ไม่สามารถ claim Payment creation ได้",
        );
      }

      if (!ownsClaim) {
        return resolveExisting(
          claimedPayment,
        );
      }

      let providerPayment;

      try {
        providerPayment =
          await provider
            .createPayment({
              paymentId:
                claimedPayment
                  .paymentId,

              orderId:
                order.orderId,

              amount:
                order.totalAmount,

              provider:
                data.provider,

              expiresAt:
                claimedPayment
                  .expiresAt,
            });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Payment Provider creation failed";

        /*
         * ห้าม rollback claim แล้วสร้าง Charge ใหม่ทันที
         *
         * network error อาจเกิดหลัง Provider
         * สร้าง Charge สำเร็จแล้ว
         */
        await Payment.updateOne(
          {
            paymentId:
              claimedPayment
                .paymentId,

            status:
              "creating",
          },
          {
            $set: {
              "metadata.creationLastError":
                message.slice(
                  0,
                  2000,
                ),

              "metadata.creationLastAttemptAt":
                new Date(),
            },
          },
        );

        throw error;
      }

      return finalizeCreation(
        claimedPayment.paymentId,
        providerPayment,
      );
    } finally {
      await session.endSession();
    }
  },

  async cancelPayment(
    paymentId: string,
  ) {
    const session =
      await mongoose.startSession();

    let cancelledPayment: any = null;

    try {
      await session.withTransaction(
        async () => {
          const payment =
            await Payment.findOne({
              paymentId,
            }).session(session);

          if (!payment) {
            throw new Error(
              "ไม่พบ Payment",
            );
          }

          // Idempotent: ถ้ายกเลิกไปแล้ว ไม่คืน stock ซ้ำ
          if (
            payment.status ===
            "cancelled"
          ) {
            cancelledPayment =
              payment;
            return;
          }

          if (
            payment.status !==
            "pending"
          ) {
            throw new Error(
              `ไม่สามารถยกเลิก Payment สถานะ ${payment.status} ได้`,
            );
          }

          const now =
            new Date();

          const updatedPayment =
            await Payment.findOneAndUpdate(
              {
                paymentId,
                status: "pending",
              },
              {
                $set: {
                  status:
                    "cancelled",
                  cancelledAt:
                    now,
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!updatedPayment) {
            const current =
              await Payment.findOne({
                paymentId,
              }).session(session);

            if (
              current?.status ===
              "cancelled"
            ) {
              cancelledPayment =
                current;
              return;
            }

            throw new Error(
              "Payment ถูกเปลี่ยนสถานะก่อนยกเลิก",
            );
          }

          const order =
            await Order.findOne({
              orderId:
                updatedPayment.orderId,
            }).session(session);

          if (!order) {
            throw new Error(
              "ไม่พบ Order ที่ผูกกับ Payment",
            );
          }

          // ถ้า Order ถูกยกเลิกและ release stock ไปแล้ว
          // ไม่ต้องคืน stock ซ้ำ
          if (
            order.status ===
              "cancelled" &&
            order.metadata
              ?.stockReleased ===
              true
          ) {
            cancelledPayment =
              updatedPayment;
            return;
          }

          if (
            order.status !==
              "awaiting_payment" ||
            order.paymentId !==
              updatedPayment.paymentId
          ) {
            throw new Error(
              `Order ${order.orderId} ไม่อยู่ในสถานะ awaiting_payment`,
            );
          }

          const updatedOrder =
            await Order.findOneAndUpdate(
              {
                orderId:
                  order.orderId,
                status:
                  "awaiting_payment",
                paymentId:
                  updatedPayment.paymentId,
                "metadata.stockReserved":
                  true,
                "metadata.stockReleased":
                  {
                    $ne: true,
                  },
              },
              {
                $set: {
                  status:
                    "cancelled",
                  cancelledAt:
                    now,
                  cancelReason:
                    "ยกเลิกการชำระเงิน",
                  "metadata.stockReserved":
                    false,
                  "metadata.stockReleased":
                    true,
                },
              },
              {
                new: true,
                session,
              },
            );

          if (!updatedOrder) {
            const currentOrder =
              await Order.findOne({
                orderId:
                  order.orderId,
              }).session(session);

            if (
              currentOrder?.metadata
                ?.stockReleased ===
              true
            ) {
              cancelledPayment =
                updatedPayment;
              return;
            }

            throw new Error(
              "ไม่สามารถยกเลิก Order ได้",
            );
          }

          const stockResult =
            await Product.updateOne(
              {
                productId:
                  updatedOrder.productId,
              },
              {
                $inc: {
                  stock:
                    updatedOrder.quantity,
                },
              },
              {
                session,
              },
            );

          if (
            stockResult.matchedCount !==
            1
          ) {
            throw new Error(
              `ไม่พบ Product สำหรับคืน Stock: ${updatedOrder.productId}`,
            );
          }

          if (
            stockResult.modifiedCount !==
            1
          ) {
            throw new Error(
              `ไม่สามารถคืน Stock ของ Product: ${updatedOrder.productId}`,
            );
          }

          cancelledPayment =
            updatedPayment;
        },
      );

      if (!cancelledPayment) {
        throw new Error(
          "Stock release ไม่ได้ผลลัพธ์",
        );
      }

      return cancelledPayment;
    } finally {
      await session.endSession();
    }
  },

  async markPaid(
    paymentId: string,
    providerPaymentId: string,
    providerPaidAt?: Date | null,
  ) {
    const session = await mongoose.startSession();

    let paidPayment: any = null;
    let shouldNotify = false;

    try {
      await session.withTransaction(async () => {
        const payment = await Payment.findOne({
          paymentId,
        }).session(session);

        if (!payment) {
          throw new Error(
            "ไม่พบ Payment",
          );
        }

        // Idempotent:
        // ถ้า webhook/request ซ้ำหลังจากจ่ายสำเร็จแล้ว
        // ห้ามเพิ่ม Product.sold หรือส่ง DM ซ้ำ
        if (payment.status === "paid") {
          paidPayment = payment;
          return;
        }

        if (payment.status !== "pending") {
          throw new Error(
            "Payment นี้ไม่สามารถเปลี่ยนเป็นชำระเงินแล้วได้",
          );
        }

        const now =
          new Date();

        /*
         * ห้าม reject Payment จากเวลาปัจจุบัน
         *
         * Provider อาจยืนยัน successful หลังจาก
         * webhook มาถึงช้า ทั้งที่ลูกค้าจ่ายทันเวลา
         */
        const paidAt =
          providerPaidAt instanceof
              Date &&
          Number.isFinite(
            providerPaidAt.getTime(),
          )
            ? providerPaidAt
            : now;

        const order = await Order.findOne({
          orderId: payment.orderId,
        }).session(session);

        if (!order) {
          throw new Error(
            "ไม่พบ Order ที่ผูกกับ Payment",
          );
        }

        // Payment ต้องมาจาก order ที่กำลังรอการชำระเงินเท่านั้น
        if (
          order.status !== "awaiting_payment" ||
          order.paymentId !== payment.paymentId
        ) {
          throw new Error(
            `Order ${order.orderId} ไม่อยู่ในสถานะ awaiting_payment`,
          );
        }

        // ----------------------------------------------------
        // Payment: pending -> paid
        // ----------------------------------------------------
        const updatedPayment =
          await Payment.findOneAndUpdate(
            {
              paymentId,
              status: "pending",
            },
            {
              $set: {
                status: "paid",
                providerPaymentId,
                paidAt,
              },
            },
            {
              new: true,
              session,
            },
          );

        if (!updatedPayment) {
          // Concurrent webhook/request อาจเป็นตัวที่จ่ายไปก่อน
          const current =
            await Payment.findOne({
              paymentId,
            }).session(session);

          if (current?.status === "paid") {
            paidPayment = current;
            return;
          }

          throw new Error(
            "Payment ถูกเปลี่ยนสถานะก่อนยืนยันการชำระเงิน",
          );
        }

        // ----------------------------------------------------
        // Product: เพิ่ม sold ใน transaction เดียวกัน
        // ----------------------------------------------------
        if (
          order.productId &&
          order.quantity > 0
        ) {
          const soldResult =
            await Product.updateOne(
              {
                productId:
                  order.productId,
              },
              {
                $inc: {
                  sold: order.quantity,
                },
              },
              {
                session,
              },
            );

          if (soldResult.matchedCount !== 1) {
            throw new Error(
              "ไม่พบสินค้าเพื่ออัปเดตยอดขาย",
            );
          }
        }

        // ----------------------------------------------------
        // Order: awaiting_payment -> paid
        // ----------------------------------------------------
        const updatedOrder =
          await Order.findOneAndUpdate(
            {
              orderId:
                updatedPayment.orderId,
              status:
                "awaiting_payment",
              paymentId:
                updatedPayment.paymentId,
            },
            {
              $set: {
                status: "paid",
                paidAt:
                  updatedPayment.paidAt ??
                  now,
              },
            },
            {
              new: true,
              session,
            },
          );

        if (!updatedOrder) {
          throw new Error(
            "ไม่สามารถเปลี่ยน Order เป็น PAID ได้",
          );
        }

        paidPayment =
          updatedPayment;

        shouldNotify = true;
      });

      if (!paidPayment) {
        throw new Error(
          "Payment finalization ไม่ได้ผลลัพธ์",
        );
      }

      // ------------------------------------------------------
      // Discord DM ต้องอยู่นอก MongoDB transaction
      // ------------------------------------------------------
      if (shouldNotify) {
        try {
          const discordClient =
            getMarketplaceDiscordClient();

          const dmSent =
            await sendBuyerOrderPaidDM(
              discordClient,
              paidPayment.orderId,
            );

          if (!dmSent) {
            console.warn(
              `⚠️ Buyer DM was not sent: Order ${paidPayment.orderId}`,
            );
          }
        } catch (error) {
          console.error(
            `⚠️ Failed to send buyer paid DM for Order ${paidPayment.orderId}:`,
            error,
          );
        }

        try {
          const discordClient =
            getMarketplaceDiscordClient();

          await sendSellerOrderPaidDM(
            discordClient,
            paidPayment.orderId,
          );
        } catch (error) {
          console.error(
            `⚠️ Failed to send seller paid DM for Order ${paidPayment.orderId}:`,
            error,
          );
        }
      }

      return paidPayment;
    } finally {
      await session.endSession();
    }
  },
  async expirePayment(
    paymentId: string,
  ) {
    const session =
      await mongoose.startSession();

    let expiredPayment: any =
      null;

    try {
      await session.withTransaction(
        async () => {
          const payment =
            await Payment.findOne({
              paymentId,
            }).session(session);

          if (!payment) {
            throw new Error(
              "ไม่พบ Payment",
            );
          }

          /*
           * Concurrent paid / failed / cancelled
           * อาจชนะ transaction นี้ไปแล้ว
           */
          if (
            payment.status !==
              "pending" &&
            payment.status !==
              "expired"
          ) {
            expiredPayment =
              payment;

            return;
          }

          const order =
            await Order.findOne({
              orderId:
                payment.orderId,
            }).session(session);

          if (!order) {
            throw new Error(
              "ไม่พบ Order ที่ผูกกับ Payment",
            );
          }

          /*
           * รองรับ repair จาก state รุ่นเก่า:
           * Order ถูก cancel + คืน Stock แล้ว
           * แต่ Payment ยัง pending
           */
          if (
            order.status ===
              "cancelled" &&
            order.metadata
              ?.stockReleased ===
              true
          ) {
            if (
              payment.status ===
              "pending"
            ) {
              const repaired =
                await Payment
                  .findOneAndUpdate(
                    {
                      paymentId,
                      status:
                        "pending",
                    },
                    {
                      $set: {
                        status:
                          "expired",
                      },
                    },
                    {
                      new: true,
                      session,
                    },
                  );

              expiredPayment =
                repaired ??
                payment;
            } else {
              expiredPayment =
                payment;
            }

            return;
          }

          if (
            order.status !==
              "awaiting_payment" ||
            order.paymentId !==
              payment.paymentId
          ) {
            throw new Error(
              `Order ${order.orderId} ไม่อยู่ในสถานะ awaiting_payment`,
            );
          }

          let finalPayment =
            payment;

          if (
            payment.status ===
            "pending"
          ) {
            const updatedPayment =
              await Payment
                .findOneAndUpdate(
                  {
                    paymentId,
                    status:
                      "pending",
                  },
                  {
                    $set: {
                      status:
                        "expired",
                    },
                  },
                  {
                    new: true,
                    session,
                  },
                );

            if (!updatedPayment) {
              const latest =
                await Payment.findOne({
                  paymentId,
                }).session(session);

              if (
                latest &&
                latest.status !==
                  "pending"
              ) {
                expiredPayment =
                  latest;

                return;
              }

              throw new Error(
                "Payment ถูกเปลี่ยนสถานะก่อน expire",
              );
            }

            finalPayment =
              updatedPayment;
          }

          const now =
            new Date();

          const updatedOrder =
            await Order
              .findOneAndUpdate(
                {
                  orderId:
                    order.orderId,

                  status:
                    "awaiting_payment",

                  paymentId:
                    payment.paymentId,

                  "metadata.stockReserved":
                    true,

                  "metadata.stockReleased":
                    {
                      $ne: true,
                    },
                },
                {
                  $set: {
                    status:
                      "cancelled",

                    cancelledAt:
                      now,

                    cancelReason:
                      "Payment Provider ยืนยันว่ารายการหมดอายุแล้ว",

                    "metadata.stockReserved":
                      false,

                    "metadata.stockReleased":
                      true,
                  },
                },
                {
                  new: true,
                  session,
                },
              );

          if (!updatedOrder) {
            const latestOrder =
              await Order.findOne({
                orderId:
                  order.orderId,
              }).session(session);

            if (
              latestOrder?.status ===
                "cancelled" &&
              latestOrder.metadata
                ?.stockReleased ===
                true
            ) {
              expiredPayment =
                finalPayment;

              return;
            }

            throw new Error(
              "ไม่สามารถ expire Order ได้",
            );
          }

          const stockResult =
            await Product.updateOne(
              {
                productId:
                  updatedOrder.productId,
              },
              {
                $inc: {
                  stock:
                    updatedOrder.quantity,
                },
              },
              {
                session,
              },
            );

          if (
            stockResult.matchedCount !==
            1
          ) {
            throw new Error(
              `ไม่พบ Product สำหรับคืน Stock: ${updatedOrder.productId}`,
            );
          }

          if (
            stockResult.modifiedCount !==
            1
          ) {
            throw new Error(
              `ไม่สามารถคืน Stock ของ Product: ${updatedOrder.productId}`,
            );
          }

          expiredPayment =
            finalPayment;
        },
      );

      if (!expiredPayment) {
        throw new Error(
          "Payment expiration ไม่ได้ผลลัพธ์",
        );
      }

      return expiredPayment;
    } finally {
      await session.endSession();
    }
  },

  async verifyPayment(
    paymentId: string,
  ) {
    const payment =
      await Payment.findOne({
        paymentId,
      });

    if (!payment) {
      throw new Error(
        "ไม่พบ Payment",
      );
    }

    if (
      payment.status !==
      "pending"
    ) {
      return payment;
    }

    if (
      !payment.providerPaymentId
    ) {
      throw new Error(
        "Payment ยังไม่มี Provider Payment ID",
      );
    }

    const provider =
      paymentProviderRegistry.get(
        payment.provider,
      );

    /*
     * Provider เป็น source of truth
     *
     * ห้าม expire จาก local clock
     * ก่อนถาม Omise
     */
    const result =
      await provider.verifyPayment(
        payment.providerPaymentId,
      );

    const providerStatus =
      result.status
        ?.trim()
        .toLowerCase() ??
      null;

    if (
      result.providerPaymentId &&
      result.providerPaymentId !==
        payment.providerPaymentId
    ) {
      throw new Error(
        "Provider Payment ID ไม่ตรงกับ Payment",
      );
    }

    if (result.paid) {
      if (
        result.providerPaymentId !==
        payment.providerPaymentId
      ) {
        throw new Error(
          "Provider Payment ID ไม่ตรงกับ Payment",
        );
      }

      if (
        result.amount == null ||
        !Number.isFinite(
          result.amount,
        )
      ) {
        throw new Error(
          "Payment Provider ไม่ได้ส่งยอดเงินที่ถูกต้อง",
        );
      }

      const providerSatang =
        Math.round(
          result.amount * 100,
        );

      const expectedSatang =
        Math.round(
          payment.amount * 100,
        );

      if (
        providerSatang !==
        expectedSatang
      ) {
        throw new Error(
          "ยอดเงินจาก Payment Provider ไม่ตรงกับยอดคำสั่งซื้อ",
        );
      }

      if (
        typeof result.currency !==
          "string" ||
        result.currency
          .toUpperCase() !==
          "THB"
      ) {
        throw new Error(
          "สกุลเงินของ Payment Provider ไม่ถูกต้อง",
        );
      }

      return this.markPaid(
        payment.paymentId,
        payment.providerPaymentId,
        result.paidAt,
      );
    }

    if (
      providerStatus ===
      "expired"
    ) {
      return this.expirePayment(
        payment.paymentId,
      );
    }

    if (
      providerStatus ===
      "failed"
    ) {
      return finalizeFailedPayment(
        payment.paymentId,
      );
    }

    if (
      providerStatus ===
        "pending" ||
      providerStatus ===
        null
    ) {
      return payment;
    }

    throw new Error(
      `สถานะ Payment Provider ไม่รองรับ: ${providerStatus}`,
    );
  },

};
