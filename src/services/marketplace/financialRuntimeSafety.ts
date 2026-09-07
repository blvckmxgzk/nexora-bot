export interface FinancialRuntimeEnvironment {
  NODE_ENV?: string;

  OMISE_SECRET_KEY?: string;
  OMISE_PUBLIC_KEY?: string;
  OMISE_WEBHOOK_SECRET?: string;

  NEXORA_PAYMENT_RETURN_URL?: string;
  NEXORA_PUBLIC_API_URL?: string;

  NEXORA_PAYMENT_METHODS?: string;
  NEXORA_PAYMENT_APPROVED_CATEGORIES?: string;
}

const PAYMENT_METHODS =
  new Set([
    "promptpay",
    "truemoney",
  ]);

const PRODUCT_CATEGORIES =
  new Set([
    "game_topup",
    "game_keys",
    "gift_cards",
    "digital_services",
    "other",
  ]);

function requireHttpsUrl(
  name: string,
  value:
    string |
    undefined,
): URL {
  const raw =
    value?.trim();

  if (!raw) {
    throw new Error(
      `Production requires ${name}`,
    );
  }

  let url:
    URL;

  try {
    url =
      new URL(
        raw,
      );
  } catch {
    throw new Error(
      `${name} ไม่ใช่ URL ที่ถูกต้อง`,
    );
  }

  if (
    url.protocol !==
    "https:"
  ) {
    throw new Error(
      `Production ${name} ต้องใช้ HTTPS`,
    );
  }

  return url;
}

function requireCsv(
  name:
    string,

  raw:
    string |
    undefined,

  allowed:
    ReadonlySet<string>,
): void {
  const value =
    raw?.trim();

  if (!value) {
    throw new Error(
      `Production requires ${name}`,
    );
  }

  const entries =
    value
      .split(",")
      .map(
        (entry) =>
          entry
            .trim()
            .toLowerCase(),
      )
      .filter(Boolean);

  if (
    entries.length ===
    0
  ) {
    throw new Error(
      `Production requires ${name}`,
    );
  }

  for (
    const entry
    of entries
  ) {
    if (
      !allowed.has(
        entry,
      )
    ) {
      throw new Error(
        `${name} contains unsupported value: ${entry}`,
      );
    }
  }
}

export function assertMarketplaceFinancialRuntimeSafety(
  runtime:
    FinancialRuntimeEnvironment =
      process.env,
): void {
  if (
    runtime.NODE_ENV !==
    "production"
  ) {
    return;
  }

  const secretKey =
    runtime
      .OMISE_SECRET_KEY
      ?.trim();

  if (!secretKey) {
    throw new Error(
      "Production requires OMISE_SECRET_KEY",
    );
  }

  if (
    !secretKey.startsWith(
      "skey_test_",
    )
  ) {
    throw new Error(
      "Live Omise key ถูกบล็อก: NEXORA ยังไม่อนุญาต Live financial mode",
    );
  }

  const publicKey =
    runtime
      .OMISE_PUBLIC_KEY
      ?.trim();

  if (!publicKey) {
    throw new Error(
      "Production requires OMISE_PUBLIC_KEY",
    );
  }

  if (
    !publicKey.startsWith(
      "pkey_test_",
    )
  ) {
    throw new Error(
      "Live Omise public key ถูกบล็อก: NEXORA ยังไม่อนุญาต Live financial mode",
    );
  }

  const webhookSecret =
    runtime
      .OMISE_WEBHOOK_SECRET
      ?.trim();

  if (
    !webhookSecret ||
    webhookSecret.length <
      16
  ) {
    throw new Error(
      "Production requires a valid OMISE_WEBHOOK_SECRET",
    );
  }

  requireCsv(
    "NEXORA_PAYMENT_METHODS",
    runtime
      .NEXORA_PAYMENT_METHODS,
    PAYMENT_METHODS,
  );

  requireCsv(
    "NEXORA_PAYMENT_APPROVED_CATEGORIES",
    runtime
      .NEXORA_PAYMENT_APPROVED_CATEGORIES,
    PRODUCT_CATEGORIES,
  );

  requireHttpsUrl(
    "NEXORA_PAYMENT_RETURN_URL",
    runtime
      .NEXORA_PAYMENT_RETURN_URL,
  );

  requireHttpsUrl(
    "NEXORA_PUBLIC_API_URL",
    runtime
      .NEXORA_PUBLIC_API_URL,
  );
}
