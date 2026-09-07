import type {
  PayoutProvider,
} from "./payoutProvider.js";

import {
  omisePayoutProvider,
} from "./providers/omisePayoutProvider.js";

export const payoutProviderRegistry = {
  get(
    name: string,
  ): PayoutProvider {
    switch (name) {
      case "omise":
        return omisePayoutProvider;

      default:
        throw new Error(
          `Unsupported payout provider: ${name}`,
        );
    }
  },
};
