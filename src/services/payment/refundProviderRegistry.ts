import type {
  RefundProvider,
} from "./refundProvider.js";

import {
  omiseRefundProvider,
} from "./providers/omiseRefundProvider.js";

export type RefundProviderName =
  | "omise";

export function resolveRefundProviderName(
  paymentProvider:
    string,
): RefundProviderName {
  switch (
    paymentProvider
  ) {
    case "promptpay":
    case "truemoney":
      return "omise";

    default:
      throw new Error(
        `ไม่พบ Refund Provider สำหรับ Payment Provider: ${paymentProvider}`,
      );
  }
}

export const refundProviderRegistry = {
  get(
    name: string,
  ): RefundProvider {
    switch (name) {
      case "omise":
        return omiseRefundProvider;

      default:
        throw new Error(
          `Unsupported refund provider: ${name}`,
        );
    }
  },
};
