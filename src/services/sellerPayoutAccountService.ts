import crypto from "node:crypto";

import {
  SellerPayoutAccount,
} from "../models/SellerPayoutAccount.js";

import {
  omisePayoutProvider,
  type OmiseRecipientSnapshot,
} from "./payment/providers/omisePayoutProvider.js";

function generatePayoutAccountId():
  string {
  return (
    "PACC-" +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

async function finalizeRecipient(
  payoutAccountId:
    string,

  recipient:
    OmiseRecipientSnapshot,
) {
  const ready =
    recipient.deleted !==
      true &&
    recipient.active &&
    recipient.verified &&
    !recipient.failureCode;

  const account =
    await SellerPayoutAccount
      .findOneAndUpdate(
        {
          payoutAccountId,
        },
        {
          $set: {
            recipientId:
              recipient.recipientId,

            recipientActive:
              recipient.active,

            recipientVerified:
              recipient.verified,

            recipientFailureCode:
              recipient.deleted ===
                true
                ? "recipient_deleted"
                : recipient.failureCode,

            bankCode:
              recipient.bankCode,

            bankBrand:
              recipient.bankBrand,

            bankLastDigits:
              recipient.bankLastDigits,

            accountHolderName:
              recipient.accountHolderName,

            status:
              ready
                ? "ready"
                : "pending_verification",

            "metadata.creationLastError":
              null,

            "metadata.recipientDeleted":
              recipient.deleted ===
              true,

            "metadata.recipientLastReconciledAt":
              new Date(),
          },
        },
        {
          new: true,
        },
      );

  if (!account) {
    throw new Error(
      "ไม่พบ Seller Payout Account สำหรับ finalize",
    );
  }

  return account;
}

async function verifyTestRecipient(
  recipient:
    OmiseRecipientSnapshot,
): Promise<OmiseRecipientSnapshot> {
  if (
    recipient.deleted ===
      true ||
    recipient.verified
  ) {
    return recipient;
  }

  try {
    return await omisePayoutProvider
      .verifyRecipientForTest(
        recipient.recipientId,
      );
  } catch (error) {
    console.warn(
      "⚠️ Unable to auto-verify Omise Test Recipient:",
      error,
    );

    return recipient;
  }
}

export const sellerPayoutAccountService = {
  async getBySellerId(
    sellerId:
      string,
  ) {
    return SellerPayoutAccount
      .findOne({
        sellerId,
      });
  },

  async setup(
    data: {
      sellerId:
        string;

      shopId:
        string;

      accountHolderName:
        string;

      bankCode:
        string;

      accountNumber:
        string;
    },
  ) {
    const accountHolderName =
      data.accountHolderName
        .trim();

    const bankCode =
      data.bankCode
        .trim()
        .toLowerCase();

    const accountNumber =
      data.accountNumber
        .trim();

    if (
      accountHolderName.length <
        2 ||
      accountHolderName.length >
        100
    ) {
      throw new Error(
        "ชื่อเจ้าของบัญชีไม่ถูกต้อง",
      );
    }

    /*
     * Phase 5.3 Test Mode:
     * รับ Test Bank เท่านั้น
     */
    if (
      bankCode !==
      "test"
    ) {
      throw new Error(
        "Phase 5.3 ต้องใช้ Bank Code: test เท่านั้น",
      );
    }

    if (
      accountNumber.length <
        4 ||
      accountNumber.length >
        50
    ) {
      throw new Error(
        "เลขบัญชีทดสอบไม่ถูกต้อง",
      );
    }

    let account =
      await SellerPayoutAccount
        .findOne({
          sellerId:
            data.sellerId,
        });

    let ownsClaim =
      false;

    if (!account) {
      const payoutAccountId =
        generatePayoutAccountId();

      try {
        account =
          await SellerPayoutAccount
            .create({
              payoutAccountId,

              sellerId:
                data.sellerId,

              shopId:
                data.shopId,

              provider:
                "omise",

              status:
                "creating",

              metadata: {
                creationClaimedAt:
                  new Date(),

                creationLastError:
                  null,
              },
            });

        ownsClaim =
          true;
      } catch (
        error: any
      ) {
        if (
          error?.code !==
          11000
        ) {
          throw error;
        }

        account =
          await SellerPayoutAccount
            .findOne({
              sellerId:
                data.sellerId,
            });
      }
    }

    if (!account) {
      throw new Error(
        "ไม่สามารถ claim Seller Payout Account ได้",
      );
    }

    if (
      account.status ===
        "ready" ||
      account.status ===
        "pending_verification"
    ) {
      return account;
    }

    if (!ownsClaim) {
      const recovered =
        await omisePayoutProvider
          .findExistingRecipient({
            payoutAccountId:
              account.payoutAccountId,

            sellerId:
              account.sellerId,

            shopId:
              account.shopId,
          });

      if (!recovered) {
        throw new Error(
          "Recipient เดิมกำลังถูกตรวจสอบ ระบบจะไม่สร้าง Recipient ซ้ำ",
        );
      }

      const verified =
        await verifyTestRecipient(
          recovered,
        );

      return finalizeRecipient(
        account.payoutAccountId,
        verified,
      );
    }

    try {
      let recipient =
        await omisePayoutProvider
          .createRecipient({
            payoutAccountId:
              account.payoutAccountId,

            sellerId:
              account.sellerId,

            shopId:
              account.shopId,

            accountHolderName,

            bankCode,

            accountNumber,
          });

      /*
       * Test Mode เท่านั้น:
       * verify อัตโนมัติเพื่อทดสอบ lifecycle
       */
      recipient =
        await verifyTestRecipient(
          recipient,
        );

      return finalizeRecipient(
        account.payoutAccountId,
        recipient,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Recipient creation failed";

      await SellerPayoutAccount
        .updateOne(
          {
            payoutAccountId:
              account.payoutAccountId,

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

      /*
       * ห้ามลบ claim:
       * provider อาจสร้าง Recipient
       * สำเร็จแล้วก่อน network timeout
       */
      throw error;
    }
  },

  async refresh(
    sellerId:
      string,
  ) {
    const account =
      await SellerPayoutAccount
        .findOne({
          sellerId,
        });

    if (
      !account ||
      !account.recipientId
    ) {
      return account;
    }

    let recipient =
      await omisePayoutProvider
        .retrieveRecipient(
          account.recipientId,
        );

    recipient =
      await verifyTestRecipient(
        recipient,
      );

    return finalizeRecipient(
      account.payoutAccountId,
      recipient,
    );
  },

  /*
   * Webhook reconciliation:
   *
   * - ไม่เชื่อ embedded Recipient state
   * - retrieve Recipient จาก provider ใหม่
   * - รองรับ webhook ที่มาถึงก่อน local
   *   recipientId finalize
   */
  async reconcileProviderRecipient(
    payoutAccountId:
      string,

    providerRecipientId:
      string,
  ) {
    const account =
      await SellerPayoutAccount
        .findOne({
          payoutAccountId,
        });

    if (!account) {
      throw new Error(
        "ไม่พบ Seller Payout Account สำหรับ Recipient reconciliation",
      );
    }

    if (
      account.recipientId &&
      account.recipientId !==
        providerRecipientId
    ) {
      throw new Error(
        "Omise Recipient ID ไม่ตรงกับ Seller Payout Account",
      );
    }

    const recipient =
      await omisePayoutProvider
        .retrieveRecipient(
          providerRecipientId,
        );

    return finalizeRecipient(
      account.payoutAccountId,
      recipient,
    );
  },
};
