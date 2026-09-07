import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  readFileSync,
} from "node:fs";

import {
  evaluateStaticPaymentPolicy,
  platformPaymentCapabilityService,
} from "../src/services/payment/platformPaymentCapabilityService.ts";

import {
  assertMarketplaceFinancialRuntimeSafety,
} from "../src/services/marketplace/financialRuntimeSafety.ts";

const ENV_KEYS = [
  "NODE_ENV",
  "OMISE_PUBLIC_KEY",
  "NEXORA_PAYMENT_METHODS",
  "NEXORA_PAYMENT_APPROVED_CATEGORIES",
] as const;

const originalEnv:
  Record<
    string,
    string |
    undefined
  > =
    {};

beforeEach(() => {
  for (
    const key
    of ENV_KEYS
  ) {
    originalEnv[key] =
      process.env[key];
  }

  process.env.NODE_ENV =
    "test";

  delete process.env
    .OMISE_PUBLIC_KEY;

  delete process.env
    .NEXORA_PAYMENT_METHODS;

  delete process.env
    .NEXORA_PAYMENT_APPROVED_CATEGORIES;
});

afterEach(() => {
  for (
    const key
    of ENV_KEYS
  ) {
    const value =
      originalEnv[key];

    if (
      value ===
      undefined
    ) {
      delete process.env[
        key
      ];
    } else {
      process.env[key] =
        value;
    }
  }
});

describe(
  "NEXORA Marketplace Phase 5.6B checkout capability",
  () => {
    it(
      "allows PromptPay for an explicitly approved category",
      () => {
        expect(
          evaluateStaticPaymentPolicy({
            provider:
              "promptpay",

            category:
              "other",

            configuredMethods: [
              "promptpay",
            ],

            approvedCategories: [
              "other",
            ],
          }).allowed,
        ).toBe(
          true,
        );
      },
    );

    for (
      const category
      of [
        "game_topup",
        "game_keys",
        "gift_cards",
        "digital_services",
      ] as const
    ) {
      it(
        `blocks TrueMoney for ${category}`,
        () => {
          const result =
            evaluateStaticPaymentPolicy({
              provider:
                "truemoney",

              category,

              configuredMethods: [
                "truemoney",
              ],

              approvedCategories: [
                category,
              ],
            });

          expect(
            result.allowed,
          ).toBe(
            false,
          );

          expect(
            result.reason,
          ).toMatch(
            /TrueMoney/,
          );
        },
      );
    }

    it(
      "blocks a method disabled by platform configuration",
      () => {
        expect(
          evaluateStaticPaymentPolicy({
            provider:
              "truemoney",

            category:
              "other",

            configuredMethods: [
              "promptpay",
            ],

            approvedCategories: [
              "other",
            ],
          }).allowed,
        ).toBe(
          false,
        );
      },
    );

    it(
      "blocks a category that has not been approved",
      () => {
        const result =
          evaluateStaticPaymentPolicy({
            provider:
              "promptpay",

            category:
              "game_topup",

            configuredMethods: [
              "promptpay",
            ],

            approvedCategories: [
              "other",
            ],
          });

        expect(
          result.allowed,
        ).toBe(
          false,
        );

        expect(
          result.reason,
        ).toMatch(
          /อนุมัติ/,
        );
      },
    );

    it(
      "uses configured methods without external API during tests",
      async () => {
        const methods =
          await platformPaymentCapabilityService
            .getAvailableMethods({
              category:
                "other",

              amountBaht:
                100,
            });

        expect(
          methods,
        ).toEqual([
          "promptpay",
          "truemoney",
        ]);
      },
    );

    it(
      "removes Seller PaymentAccount from active checkout routing",
      () => {
        const files = [
          "src/services/paymentService.ts",
          "src/interactions/buttons/order-pay.ts",
          "src/interactions/buttons/payment-select.ts",
          "src/interactions/buttons/shop-manage.ts",
        ];

        for (
          const filename
          of files
        ) {
          const source =
            readFileSync(
              filename,
              "utf8",
            );

          expect(
            source,
          ).not.toContain(
            "paymentAccountService",
          );
        }
      },
    );

    it(
      "does not persist seller receiving account in new Payment metadata",
      () => {
        const source =
          readFileSync(
            "src/services/paymentService.ts",
            "utf8",
          );

        expect(
          source,
        ).not.toContain(
          '"metadata.account"',
        );

        expect(
          source,
        ).toContain(
          '"platform_merchant"',
        );

        expect(
          source,
        ).toContain(
          "platformPaymentCapabilityService",
        );
      },
    );

    it(
      "deprecates Seller Payment Settings writes",
      () => {
        const button =
          readFileSync(
            "src/interactions/buttons/shop-payment-settings.ts",
            "utf8",
          );

        const modal =
          readFileSync(
            "src/interactions/modals/shop-payment-settings.ts",
            "utf8",
          );

        expect(
          button,
        ).not.toContain(
          "paymentAccountService",
        );

        expect(
          button,
        ).not.toContain(
          "showModal",
        );

        expect(
          modal,
        ).not.toContain(
          "paymentAccountService",
        );

        expect(
          modal,
        ).not.toContain(
          ".upsert(",
        );
      },
    );

    it(
      "requires Omise public key in production",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_nexora",

              OMISE_WEBHOOK_SECRET:
                "abcdefghijklmnop",

              NEXORA_PAYMENT_METHODS:
                "promptpay",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "other",

              NEXORA_PAYMENT_RETURN_URL:
                "https://checkout.example.com",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",
            }),
        ).toThrow(
          /OMISE_PUBLIC_KEY/,
        );
      },
    );

    it(
      "accepts complete pre-live platform payment configuration",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_nexora",

              OMISE_PUBLIC_KEY:
                "pkey_test_nexora",

              OMISE_WEBHOOK_SECRET:
                "abcdefghijklmnop",

              NEXORA_PAYMENT_METHODS:
                "promptpay,truemoney",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "other",

              NEXORA_PAYMENT_RETURN_URL:
                "https://checkout.example.com",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",
            }),
        ).not.toThrow();
      },
    );

    it(
      "blocks live Omise public key before live launch",
      () => {
        expect(
          () =>
            assertMarketplaceFinancialRuntimeSafety({
              NODE_ENV:
                "production",

              OMISE_SECRET_KEY:
                "skey_test_nexora",

              OMISE_PUBLIC_KEY:
                "pkey_live_blocked",

              OMISE_WEBHOOK_SECRET:
                "abcdefghijklmnop",

              NEXORA_PAYMENT_METHODS:
                "promptpay",

              NEXORA_PAYMENT_APPROVED_CATEGORIES:
                "other",

              NEXORA_PAYMENT_RETURN_URL:
                "https://checkout.example.com",

              NEXORA_PUBLIC_API_URL:
                "https://api.example.com",
            }),
        ).toThrow(
          /Live Omise public key/,
        );
      },
    );
  },
);
