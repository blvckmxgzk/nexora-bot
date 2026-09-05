import crypto from "node:crypto";

function getSecret(
  name: string,
): string {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}`,
    );
  }

  return value;
}

export function verifyApiSecret(
  provided: string | undefined,
): boolean {
  if (!provided) {
    return false;
  }

  const expected =
    getSecret(
      "NEXORA_API_SECRET",
    );

  const providedBuffer =
    Buffer.from(provided);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer,
  );
}

export function createWebhookSignature(
  rawBody: string,
  timestamp: string,
): string {
  const secret =
    getSecret(
      "NEXORA_WEBHOOK_SECRET",
    );

  return crypto
    .createHmac(
      "sha256",
      secret,
    )
    .update(
      `${timestamp}.${rawBody}`,
    )
    .digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined,
): boolean {
  if (
    !timestamp ||
    !signature
  ) {
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

  const expected =
    createWebhookSignature(
      rawBody,
      timestamp,
    );

  const providedBuffer =
    Buffer.from(signature);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer,
  );
}
