import {
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

import {
  paymentProviderRegistry,
} from "../src/services/payment/paymentProviderRegistry.ts";

import {
  payoutProviderRegistry,
} from "../src/services/payment/payoutProviderRegistry.ts";

import {
  refundProviderRegistry,
  resolveRefundProviderName,
} from "../src/services/payment/refundProviderRegistry.ts";

import {
  assertMarketplaceFinancialRuntimeSafety,
} from "../src/services/marketplace/financialRuntimeSafety.ts";

describe(
  "NEXORA Marketplace Phase 5.6 provider/deployment boundaries",
  () => {
    it(
      "maps current payment rails to Omise through registries",
      () => {
        expect(
          paymentProviderRegistry
            .get(
              "promptpay",
            ),
        ).toBeDefined();

        expect(
          paymentProviderRegistry
            .get(
              "truemoney",
            ),
        ).toBeDefined();

        expect(
          resolveRefundProviderName(
            "promptpay",
          ),
        ).toBe(
          "omise",
        );

        expect(
          resolveRefundProviderName(
            "truemoney",
          ),
        ).toBe(
          "omise",
        );

        expect(
          refundProviderRegistry
            .get(
              "omise",
            ),
        ).toBeDefined();
      },
    );

    it(
      "resolves payout provider through registry",
      () => {
        const provider =
          payoutProviderRegistry
            .get(
              "omise",
            );

        expect(
          provider.name,
        ).toBe(
          "omise",
        );

        expect(
          typeof provider
            .createTransfer,
        ).toBe(
          "function",
        );

        expect(
          typeof provider
            .retrieveTransfer,
        ).toBe(
          "function",
        );
      },
    );

    it(
      "rejects unknown financial providers",
      () => {
        expect(
          () =>
            refundProviderRegistry
              .get(
                "unknown",
              ),
        ).toThrow(
          /Unsupported refund provider/,
        );

        expect(
          () =>
            payoutProviderRegistry
              .get(
                "unknown",
              ),
        ).toThrow(
          /Unsupported payout provider/,
        );
      },
    );

    it(
      "requires an HTTPS public API URL in production",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_phase56",

              OMISE_PUBLIC_KEY:
                "pkey_test_nexora",

              NEXORA_PAYMENT_METHODS:
                "promptpay,truemoney",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "other",

              OMISE_WEBHOOK_SECRET:
                "abcdefghijklmnop",

              NEXORA_PAYMENT_RETURN_URL:
                "https://checkout.example.com",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",
            }),
        ).not.toThrow();
      },
    );

    it(
      "rejects an insecure public API URL in production",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_phase56",

              OMISE_PUBLIC_KEY:
                "pkey_test_nexora",

              NEXORA_PAYMENT_METHODS:
                "promptpay,truemoney",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "other",

              OMISE_WEBHOOK_SECRET:
                "abcdefghijklmnop",

              NEXORA_PAYMENT_RETURN_URL:
                "https://checkout.example.com",

              NEXORA_PUBLIC_API_URL:
                "http://api.example.com",
            }),
        ).toThrow(
          /HTTPS/,
        );
      },
    );

    it(
      "keeps financial services independent from direct Omise adapters",
      () => {
        const payoutService =
          readFileSync(
            "src/services/payoutService.ts",
            "utf8",
          );

        const refundService =
          readFileSync(
            "src/services/refundService.ts",
            "utf8",
          );

        expect(
          payoutService,
        ).not.toContain(
          "omisePayoutProvider",
        );

        expect(
          refundService,
        ).not.toContain(
          "omiseRefundProvider",
        );

        expect(
          payoutService,
        ).toContain(
          "payoutProviderRegistry",
        );

        expect(
          refundService,
        ).toContain(
          "refundProviderRegistry",
        );
      },
    );

    it(
      "has a long-running container runtime and clean worker shutdown",
      () => {
        const dockerfile =
          readFileSync(
            "Dockerfile",
            "utf8",
          );

        const index =
          readFileSync(
            "src/index.ts",
            "utf8",
          );

        const paymentWorker =
          readFileSync(
            "src/services/paymentExpirationWorker.ts",
            "utf8",
          );

        expect(
          dockerfile,
        ).toContain(
          'CMD ["node", "dist/index.js"]',
        );

        expect(
          dockerfile,
        ).toContain(
          "HEALTHCHECK",
        );

        expect(
          index,
        ).toContain(
          "paymentExpirationWorker.stop()",
        );

        expect(
          index,
        ).toContain(
          "payoutReconciliationWorker.stop()",
        );

        expect(
          paymentWorker,
        ).toContain(
          "cycleRunning",
        );

        expect(
          paymentWorker,
        ).toContain(
          "clearInterval",
        );
      },
    );
  },
);
