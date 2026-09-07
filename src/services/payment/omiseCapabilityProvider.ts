import type {
  PaymentProviderName,
} from "./paymentProvider.js";

interface OmiseCapabilityResponse {
  payment_methods?: Array<{
    name?: string;
    currencies?: string[];
  }>;

  limits?: {
    charge_amount?: {
      min?: number;
      max?: number;
    };
  };

  message?: string;
}

export interface PlatformCapabilitySnapshot {
  methods:
    Set<PaymentProviderName>;

  minChargeSatang:
    number |
    null;

  maxChargeSatang:
    number |
    null;
}

let cache:
  | {
      key: string;
      expiresAt: number;
      value:
        PlatformCapabilitySnapshot;
    }
  | null =
    null;

export const omiseCapabilityProvider = {
  async retrieve(
    configuredMethods:
      readonly PaymentProviderName[],
  ): Promise<PlatformCapabilitySnapshot> {
    const publicKey =
      process.env
        .OMISE_PUBLIC_KEY
        ?.trim();

    if (!publicKey) {
      throw new Error(
        "Missing OMISE_PUBLIC_KEY สำหรับ Omise Capability",
      );
    }

    /*
     * Pre-Live safety
     */
    if (
      !publicKey.startsWith(
        "pkey_test_",
      )
    ) {
      throw new Error(
        "Live Omise public key ถูกบล็อก: NEXORA ยังไม่อนุญาต Live financial mode",
      );
    }

    const cacheKey =
      `${publicKey}|${configuredMethods.join(",")}`;

    if (
      cache?.key ===
        cacheKey &&
      cache.expiresAt >
        Date.now()
    ) {
      return cache.value;
    }

    const auth =
      Buffer.from(
        `${publicKey}:`,
      ).toString(
        "base64",
      );

    const response =
      await fetch(
        "https://api.omise.co/capability",
        {
          method:
            "GET",

          headers: {
            Authorization:
              `Basic ${auth}`,

            Accept:
              "application/json",
          },

          signal:
            AbortSignal.timeout(
              15_000,
            ),
        },
      );

    const text =
      await response.text();

    let data:
      OmiseCapabilityResponse;

    try {
      data =
        JSON.parse(
          text,
        );
    } catch {
      throw new Error(
        `Omise Capability ส่ง JSON ไม่ถูกต้อง (HTTP ${response.status})`,
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message ??
          `Omise Capability request failed (HTTP ${response.status})`,
      );
    }

    const providerMethods =
      new Set<
        PaymentProviderName
      >();

    for (
      const method
      of data.payment_methods ??
        []
    ) {
      const name =
        method.name
          ?.trim()
          .toLowerCase();

      if (
        (
          name ===
            "promptpay" ||
          name ===
            "truemoney"
        ) &&
        method.currencies
          ?.some(
            (currency) =>
              currency
                .toUpperCase() ===
              "THB",
          )
      ) {
        providerMethods.add(
          name,
        );
      }
    }

    const value:
      PlatformCapabilitySnapshot =
      {
        methods:
          new Set(
            configuredMethods.filter(
              (method) =>
                providerMethods.has(
                  method,
                ),
            ),
          ),

        minChargeSatang:
          Number.isSafeInteger(
            data.limits
              ?.charge_amount
              ?.min,
          )
            ? data.limits!
                .charge_amount!
                .min!
            : null,

        maxChargeSatang:
          Number.isSafeInteger(
            data.limits
              ?.charge_amount
              ?.max,
          )
            ? data.limits!
                .charge_amount!
                .max!
            : null,
      };

    cache = {
      key:
        cacheKey,

      expiresAt:
        Date.now() +
        60_000,

      value,
    };

    return value;
  },
};
