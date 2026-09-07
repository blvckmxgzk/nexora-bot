import type {
  PaymentProviderName,
} from "./paymentProvider.js";

import {
  omiseCapabilityProvider,
  type PlatformCapabilitySnapshot,
} from "./omiseCapabilityProvider.js";

export const MARKETPLACE_PRODUCT_CATEGORIES =
  [
    "game_topup",
    "game_keys",
    "gift_cards",
    "digital_services",
    "other",
  ] as const;

export type MarketplaceProductCategory =
  (typeof MARKETPLACE_PRODUCT_CATEGORIES)[number];

const PAYMENT_METHODS:
  readonly PaymentProviderName[] =
    [
      "promptpay",
      "truemoney",
    ];

const TRUE_MONEY_BLOCKED_CATEGORIES =
  new Set<MarketplaceProductCategory>([
    "game_topup",
    "game_keys",
    "gift_cards",
    "digital_services",
  ]);

export interface PaymentPolicyEvaluation {
  allowed:
    boolean;

  reason:
    string |
    null;
}

function isCategory(
  value:
    string,
): value is MarketplaceProductCategory {
  return (
    MARKETPLACE_PRODUCT_CATEGORIES as
      readonly string[]
  ).includes(
    value,
  );
}

function configuredMethods():
  PaymentProviderName[] {
  const raw =
    process.env
      .NEXORA_PAYMENT_METHODS
      ?.trim();

  /*
   * Test/development:
   * backward compatible
   *
   * Production:
   * fail closed
   */
  if (!raw) {
    return process.env.NODE_ENV ===
      "production"
      ? []
      : [
          "promptpay",
          "truemoney",
        ];
  }

  const result:
    PaymentProviderName[] =
      [];

  for (
    const value
    of raw
      .split(",")
      .map(
        (entry) =>
          entry
            .trim()
            .toLowerCase(),
      )
      .filter(Boolean)
  ) {
    if (
      value !==
        "promptpay" &&
      value !==
        "truemoney"
    ) {
      throw new Error(
        `NEXORA_PAYMENT_METHODS มีค่าที่ไม่รองรับ: ${value}`,
      );
    }

    if (
      !result.includes(
        value,
      )
    ) {
      result.push(
        value,
      );
    }
  }

  return result;
}

function approvedCategories():
  MarketplaceProductCategory[] {
  const raw =
    process.env
      .NEXORA_PAYMENT_APPROVED_CATEGORIES
      ?.trim();

  if (!raw) {
    return process.env.NODE_ENV ===
      "production"
      ? []
      : [
          ...MARKETPLACE_PRODUCT_CATEGORIES,
        ];
  }

  const result:
    MarketplaceProductCategory[] =
      [];

  for (
    const value
    of raw
      .split(",")
      .map(
        (entry) =>
          entry
            .trim()
            .toLowerCase(),
      )
      .filter(Boolean)
  ) {
    if (
      !isCategory(
        value,
      )
    ) {
      throw new Error(
        `NEXORA_PAYMENT_APPROVED_CATEGORIES มีค่าที่ไม่รองรับ: ${value}`,
      );
    }

    if (
      !result.includes(
        value,
      )
    ) {
      result.push(
        value,
      );
    }
  }

  return result;
}

function toSatang(
  amountBaht:
    number,
): number {
  if (
    !Number.isFinite(
      amountBaht,
    ) ||
    amountBaht <= 0
  ) {
    throw new Error(
      "จำนวนเงิน Payment ไม่ถูกต้อง",
    );
  }

  const scaled =
    amountBaht * 100;

  const satang =
    Math.round(
      scaled,
    );

  if (
    !Number.isSafeInteger(
      satang,
    ) ||
    Math.abs(
      scaled - satang,
    ) >
      1e-8
  ) {
    throw new Error(
      "จำนวนเงิน Payment ต้องมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    );
  }

  return satang;
}

export function evaluateStaticPaymentPolicy(
  input: {
    provider:
      PaymentProviderName;

    category:
      string;

    configuredMethods:
      readonly PaymentProviderName[];

    approvedCategories:
      readonly MarketplaceProductCategory[];
  },
): PaymentPolicyEvaluation {
  if (
    !isCategory(
      input.category,
    )
  ) {
    return {
      allowed:
        false,

      reason:
        `ไม่รู้จักหมวดหมู่สินค้า: ${input.category}`,
    };
  }

  if (
    !input.configuredMethods
      .includes(
        input.provider,
      )
  ) {
    return {
      allowed:
        false,

      reason:
        "ช่องทางชำระเงินนี้ถูกปิดใน Platform configuration",
    };
  }

  if (
    !input.approvedCategories
      .includes(
        input.category,
      )
  ) {
    return {
      allowed:
        false,

      reason:
        "หมวดหมู่สินค้านี้ยังไม่ได้รับอนุมัติให้รับชำระผ่าน Payment Provider ของ NEXORA",
    };
  }

  /*
   * Conservative TrueMoney policy
   * จนกว่าจะได้รับ provider approval
   * ที่ชัดเจนกว่าเดิม
   */
  if (
    input.provider ===
      "truemoney" &&
    TRUE_MONEY_BLOCKED_CATEGORIES
      .has(
        input.category,
      )
  ) {
    return {
      allowed:
        false,

      reason:
        "TrueMoney ไม่รองรับหมวดสินค้าดิจิทัล เกม หรือบัตรเติมเงินประเภทนี้ตาม Platform Payment Policy",
    };
  }

  return {
    allowed:
      true,

    reason:
      null,
  };
}

async function getCapability(
  methods:
    readonly PaymentProviderName[],
): Promise<PlatformCapabilitySnapshot> {
  /*
   * Tests ห้ามแตะ external API
   */
  if (
    process.env.NODE_ENV ===
    "test"
  ) {
    return {
      methods:
        new Set(
          methods,
        ),

      minChargeSatang:
        null,

      maxChargeSatang:
        null,
    };
  }

  /*
   * Development ที่ยังไม่ได้ใส่ pkey
   * ใช้ explicit local config
   *
   * Production runtime safety
   * จะบังคับ OMISE_PUBLIC_KEY
   */
  if (
    !process.env
      .OMISE_PUBLIC_KEY
      ?.trim()
  ) {
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      throw new Error(
        "Production ไม่มี OMISE_PUBLIC_KEY",
      );
    }

    return {
      methods:
        new Set(
          methods,
        ),

      minChargeSatang:
        null,

      maxChargeSatang:
        null,
    };
  }

  return omiseCapabilityProvider
    .retrieve(
      methods,
    );
}

async function evaluateMethod(
  input: {
    provider:
      PaymentProviderName;

    category:
      string;

    amountBaht:
      number;
  },
): Promise<PaymentPolicyEvaluation> {
  const methods =
    configuredMethods();

  const categories =
    approvedCategories();

  const staticPolicy =
    evaluateStaticPaymentPolicy({
      provider:
        input.provider,

      category:
        input.category,

      configuredMethods:
        methods,

      approvedCategories:
        categories,
    });

  if (
    !staticPolicy.allowed
  ) {
    return staticPolicy;
  }

  const capability =
    await getCapability(
      methods,
    );

  if (
    !capability.methods.has(
      input.provider,
    )
  ) {
    return {
      allowed:
        false,

      reason:
        "บัญชี Payment Provider ของ NEXORA ยังไม่ได้เปิดช่องทางชำระเงินนี้",
    };
  }

  const satang =
    toSatang(
      input.amountBaht,
    );

  if (
    capability.minChargeSatang !==
      null &&
    satang <
      capability.minChargeSatang
  ) {
    return {
      allowed:
        false,

      reason:
        "ยอดชำระต่ำกว่าขั้นต่ำที่ Payment Provider อนุญาต",
    };
  }

  if (
    capability.maxChargeSatang !==
      null &&
    satang >
      capability.maxChargeSatang
  ) {
    return {
      allowed:
        false,

      reason:
        "ยอดชำระสูงกว่าสูงสุดที่ Payment Provider อนุญาต",
    };
  }

  return {
    allowed:
      true,

    reason:
      null,
  };
}

export const platformPaymentCapabilityService = {
  evaluateMethod,

  async getAvailableMethods(
    input: {
      category:
        string;

      amountBaht:
        number;
    },
  ): Promise<
    PaymentProviderName[]
  > {
    const results =
      await Promise.all(
        PAYMENT_METHODS.map(
          async (
            provider,
          ) => ({
            provider,

            evaluation:
              await evaluateMethod({
                provider,

                category:
                  input.category,

                amountBaht:
                  input.amountBaht,
              }),
          }),
        ),
      );

    return results
      .filter(
        ({
          evaluation,
        }) =>
          evaluation.allowed,
      )
      .map(
        ({
          provider,
        }) =>
          provider,
      );
  },

  async assertMethodAllowed(
    input: {
      provider:
        PaymentProviderName;

      category:
        string;

      amountBaht:
        number;
    },
  ): Promise<void> {
    const evaluation =
      await evaluateMethod(
        input,
      );

    if (
      !evaluation.allowed
    ) {
      throw new Error(
        evaluation.reason ??
          "ช่องทางชำระเงินนี้ไม่พร้อมใช้งาน",
      );
    }
  },
};
