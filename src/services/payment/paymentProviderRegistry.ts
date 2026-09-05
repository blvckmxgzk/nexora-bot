import type {
  PaymentProvider,
  PaymentProviderName,
} from "./paymentProvider.js";

import {
  omiseProvider,
} from "./providers/omiseProvider.js";

export const paymentProviderRegistry = {
  get(
    name: PaymentProviderName,
  ): PaymentProvider {
    switch (name) {
      case "promptpay":
      case "truemoney":
        return omiseProvider;

      default:
        throw new Error(
          `Unsupported payment provider: ${name}`,
        );
    }
  },
};
