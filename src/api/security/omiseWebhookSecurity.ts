import crypto from "node:crypto";

function getWebhookSecret(): string {
  const value =
    process.env.OMISE_WEBHOOK_SECRET;

  if (!value) {
    throw new Error(
      "Missing environment variable: OMISE_WEBHOOK_SECRET",
    );
  }

  return value;
}

export function verifyOmiseWebhookSignature(
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean {
  if (!timestamp || !signature) {
    return false;
  }

  const timestampNumber =
    Number(timestamp);

  if (
    !Number.isFinite(
      timestampNumber,
    )
  ) {
    return false;
  }

  const now =
    Math.floor(
      Date.now() / 1000,
    );

  const difference =
    Math.abs(
      now - timestampNumber,
    );

  if (difference > 300) {
    return false;
  }

  const secret =
    Buffer.from(
      getWebhookSecret(),
      "base64",
    );

  const signedPayload =
    `${timestamp}.${rawBody}`;

  const expected =
    crypto
      .createHmac(
        "sha256",
        secret,
      )
      .update(
        signedPayload,
        "utf8",
      )
      .digest();

  const signatures =
    signature
      .split(",")
      .map((value) =>
        value.trim(),
      )
      .filter(Boolean);

  for (const value of signatures) {
    try {
      const provided =
        Buffer.from(
          value,
          "hex",
        );

      if (
        provided.length !==
        expected.length
      ) {
        continue;
      }

      if (
        crypto.timingSafeEqual(
          provided,
          expected,
        )
      ) {
        return true;
      }
    } catch {
      // Ignore malformed signatures.
    }
  }

  return false;
}
