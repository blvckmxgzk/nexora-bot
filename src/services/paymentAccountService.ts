import { PaymentAccount } from "../models/PaymentAccount.js";

export type PaymentAccountProvider =
  | "promptpay"
  | "truemoney";

function createAccountId(): string {
  return (
    `PAYACC-${Date.now()}-` +
    Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()
  );
}

export const paymentAccountService = {
  async getByShopId(
    shopId: string,
  ) {
    return PaymentAccount.findOne({
      shopId,
    });
  },

  async getByOwnerId(
    ownerId: string,
  ) {
    return PaymentAccount.findOne({
      ownerId,
    });
  },

  async upsert(
    data: {
      shopId: string;
      ownerId: string;
      promptpay?: {
        account: string;
        displayName?: string;
      } | null;
      truemoney?: {
        account: string;
        displayName?: string;
      } | null;
    },
  ) {
    let account =
      await PaymentAccount.findOne({
        shopId:
          data.shopId,
      });

    if (!account) {
      account =
        new PaymentAccount({
          accountId:
            createAccountId(),

          shopId:
            data.shopId,

          ownerId:
            data.ownerId,
        });
    }

    if (
      data.promptpay !==
      undefined
    ) {
      account.promptpay = {
        enabled:
          !!data.promptpay,

        account:
          data.promptpay
            ?.account ??
          null,

        displayName:
          data.promptpay
            ?.displayName ??
          null,
      };
    }

    if (
      data.truemoney !==
      undefined
    ) {
      account.truemoney = {
        enabled:
          !!data.truemoney,

        account:
          data.truemoney
            ?.account ??
          null,

        displayName:
          data.truemoney
            ?.displayName ??
          null,
      };
    }

    await account.save();

    return account;
  },

  async supports(
    shopId: string,
    provider:
      PaymentAccountProvider,
  ) {
    const account =
      await PaymentAccount.findOne({
        shopId,
      });

    if (!account) {
      return false;
    }

    if (
      provider ===
      "promptpay"
    ) {
      return (
        account.promptpay
          ?.enabled === true &&
        !!account.promptpay
          ?.account
      );
    }

    return (
      account.truemoney
        ?.enabled === true &&
      !!account.truemoney
        ?.account
    );
  },

  async getPaymentTarget(
    shopId: string,
    provider:
      PaymentAccountProvider,
  ) {
    const account =
      await PaymentAccount.findOne({
        shopId,
      });

    if (!account) {
      return null;
    }

    if (
      provider ===
      "promptpay"
    ) {
      if (
        !account.promptpay
          ?.enabled ||
        !account.promptpay
          ?.account
      ) {
        return null;
      }

      return {
        account:
          account.promptpay
            .account,

        displayName:
          account.promptpay
            .displayName,
      };
    }

    if (
      !account.truemoney
        ?.enabled ||
      !account.truemoney
        ?.account
    ) {
      return null;
    }

    return {
      account:
        account.truemoney
          .account,

      displayName:
        account.truemoney
          .displayName,
    };
  },
};
