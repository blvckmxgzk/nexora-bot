import sharp from "sharp";

import type {
  CreatePaymentInput,
  PaymentCreationResult,
  PaymentProvider,
  PaymentProviderName,
  PaymentVerificationResult,
} from "../paymentProvider.js";

interface OmiseCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paid_at?: string | null;
  expires_at?: string | null;
  authorize_uri?: string | null;
  source?: {
    id?: string;
    type?: string;
    scannable_code?: {
      image?: {
        download_uri?: string | null;
      } | null;
    } | null;
    provider_references?: {
      reference_number_1?: string | null;
      reference_number_2?: string | null;
    } | null;
  } | null;
}

interface OmiseErrorResponse {
  object?: string;
  location?: string;
  code?: string;
  message?: string;
}

interface OmiseChargeResponse
  extends OmiseCharge {
  object: "charge";
}

const OMISE_API_URL =
  "https://api.omise.co";

function getSecretKey(): string {
  const value =
    process.env.OMISE_SECRET_KEY;

  if (!value) {
    throw new Error(
      "Missing environment variable: OMISE_SECRET_KEY",
    );
  }

  if (
    !value.startsWith(
      "skey_test_",
    )
  ) {
    throw new Error(
      "Live Omise key ถูกบล็อก: NEXORA ยังอยู่ใน Pre-Live mode",
    );
  }

  return value;
}

function getProviderType(
  provider: PaymentProviderName,
): "promptpay" | "truemoney_qr" {
  if (provider === "promptpay") {
    return "promptpay";
  }

  return "truemoney_qr";
}

function toSatang(
  amount: number,
): number {
  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "จำนวนเงินต้องมากกว่า 0",
    );
  }

  const satang =
    Math.round(amount * 100);

  if (
    !Number.isSafeInteger(satang)
  ) {
    throw new Error(
      "จำนวนเงินสูงเกินกว่าที่รองรับ",
    );
  }

  return satang;
}

function fromSatang(
  amount: number,
): number {
  return amount / 100;
}

async function omiseRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: URLSearchParams;
  } = {},
): Promise<T> {
  const secretKey =
    getSecretKey();

  const auth =
    Buffer.from(
      `${secretKey}:`,
    ).toString("base64");

  const response =
    await fetch(
      `${OMISE_API_URL}${path}`,
      {
        method:
          options.method ?? "GET",
        headers: {
          Authorization:
            `Basic ${auth}`,
          Accept:
            "application/json",
          ...(options.body
            ? {
                "Content-Type":
                  "application/x-www-form-urlencoded",
              }
            : {}),
        },
        body:
          options.body,
        signal:
          AbortSignal.timeout(15_000),
      },
    );

  const text =
    await response.text();

  let data: unknown;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Omise returned invalid JSON (HTTP ${response.status})`,
    );
  }

  if (!response.ok) {
    const error =
      data as OmiseErrorResponse;

    throw new Error(
      error.message ??
        `Omise API request failed (HTTP ${response.status})`,
    );
  }

  return data as T;
}

export class OmiseProvider
  implements PaymentProvider
{
  readonly name: PaymentProviderName =
    "promptpay";

  async createPayment(
    input: CreatePaymentInput,
  ): Promise<PaymentCreationResult> {
    const amount =
      toSatang(input.amount);

    const sourceType =
      getProviderType(
        this.resolveProvider(
          input,
        ),
      );

    const body =
      new URLSearchParams();

    body.set(
      "amount",
      String(amount),
    );

    body.set(
      "currency",
      "THB",
    );

    body.set(
      "source[type]",
      sourceType,
    );

    if (
      sourceType ===
      "promptpay"
    ) {
      body.set(
        "expires_at",
        input.expiresAt.toISOString(),
      );
    }

    body.set(
      "return_uri",
      this.getReturnUri(
        input.orderId,
      ),
    );

    /*
     * Recovery identity:
     * ใช้ค้น Charge เดิมหาก process ตายหลัง Omise
     * สร้าง Charge แล้ว แต่ก่อน Mongo finalize
     */
    body.set(
      "metadata[nexora_payment_id]",
      input.paymentId,
    );

    body.set(
      "metadata[nexora_order_id]",
      input.orderId,
    );

    body.set(
      "metadata[nexora_provider]",
      this.resolveProvider(
        input,
      ),
    );

    body.set(
      "description",
      `NEXORA ${input.orderId}`,
    );

    const charge =
      await omiseRequest<OmiseChargeResponse>(
        "/charges",
        {
          method: "POST",
          body,
        },
      );

    const qrUrl =
      charge.source
        ?.scannable_code
        ?.image
        ?.download_uri ??
      null;

    const paymentUrl =
      charge.authorize_uri ??
      null;

    const reference =
      charge.source
        ?.provider_references
        ?.reference_number_1 ??
      charge.id;

    const providerExpiresAt =
      charge.expires_at
        ? new Date(
            charge.expires_at,
          )
        : null;

    return {
      provider:
        this.resolveProvider(
          input,
        ),
      providerPaymentId:
        charge.id,
      paymentReference:
        reference,
      paymentUrl,
      qrData: qrUrl,

      expiresAt:
        providerExpiresAt &&
        Number.isFinite(
          providerExpiresAt.getTime(),
        )
          ? providerExpiresAt
          : null,

      instructions:
        sourceType ===
        "promptpay"
          ? "เปิดแอปธนาคารและสแกน QR PromptPay เพื่อชำระเงิน"
          : "เปิดแอป TrueMoney และสแกน QR เพื่อชำระเงิน",
    };
  }

  async findExistingPayment(
    input: CreatePaymentInput,
  ): Promise<PaymentCreationResult | null> {
    const query =
      new URLSearchParams({
        scope:
          "charge",

        query:
          input.paymentId,

        page:
          "1",

        per_page:
          "100",
      });

    const search =
      await omiseRequest<{
        data?: Array<
          OmiseChargeResponse & {
            metadata?: Record<
              string,
              unknown
            >;
          }
        >;
      }>(
        `/search?${query.toString()}`,
      );

    const expectedAmount =
      toSatang(
        input.amount,
      );

    const expectedProvider =
      this.resolveProvider(
        input,
      );

    const charge =
      search.data?.find(
        (candidate) => {
          const metadata =
            candidate.metadata;

          return (
            metadata
              ?.nexora_payment_id ===
              input.paymentId &&
            metadata
              ?.nexora_order_id ===
              input.orderId &&
            metadata
              ?.nexora_provider ===
              expectedProvider &&
            candidate.amount ===
              expectedAmount &&
            candidate.currency
              ?.toUpperCase() ===
              "THB"
          );
        },
      );

    if (!charge) {
      return null;
    }

    const qrUrl =
      charge.source
        ?.scannable_code
        ?.image
        ?.download_uri ??
      null;

    const paymentUrl =
      charge.authorize_uri ??
      null;

    const reference =
      charge.source
        ?.provider_references
        ?.reference_number_1 ??
      charge.id;

    const providerExpiresAt =
      charge.expires_at
        ? new Date(
            charge.expires_at,
          )
        : null;

    return {
      provider:
        expectedProvider,

      providerPaymentId:
        charge.id,

      paymentReference:
        reference,

      paymentUrl,

      qrData:
        qrUrl,

      expiresAt:
        providerExpiresAt &&
        Number.isFinite(
          providerExpiresAt.getTime(),
        )
          ? providerExpiresAt
          : null,

      instructions:
        expectedProvider ===
          "promptpay"
          ? "เปิดแอปธนาคารและสแกน QR PromptPay เพื่อชำระเงิน"
          : "เปิดแอป TrueMoney และสแกน QR เพื่อชำระเงิน",
    };
  }

  async verifyPayment(
    providerPaymentId: string,
  ): Promise<PaymentVerificationResult> {
    const charge =
      await omiseRequest<OmiseChargeResponse>(
        `/charges/${encodeURIComponent(
          providerPaymentId,
        )}`,
      );

    const providerExpiresAt =
      charge.expires_at
        ? new Date(
            charge.expires_at,
          )
        : null;

    return {
      paid:
        charge.status ===
        "successful",

      status:
        charge.status,

      providerPaymentId:
        charge.id,

      paidAt:
        charge.paid_at
          ? new Date(
              charge.paid_at,
            )
          : null,

      amount:
        charge.amount / 100,

      currency:
        charge.currency,

      expiresAt:
        providerExpiresAt &&
        Number.isFinite(
          providerExpiresAt.getTime(),
        )
          ? providerExpiresAt
          : null,
    };
  }

  private resolveProvider(
    input: CreatePaymentInput,
  ): PaymentProviderName {
    const provider =
      input as CreatePaymentInput & {
        provider?: PaymentProviderName;
      };

    return (
      provider.provider ??
      "promptpay"
    );
  }

  private getReturnUri(
    orderId: string,
  ): string {
    const baseUrl =
      process.env.NEXORA_PAYMENT_RETURN_URL;

    if (!baseUrl) {
      return `https://nexora.local/payment/complete?orderId=${encodeURIComponent(
        orderId,
      )}`;
    }

    return `${baseUrl.replace(
      /\/$/,
      "",
    )}/payment/complete?orderId=${encodeURIComponent(
      orderId,
    )}`;
  }
}

export const omiseProvider =
  new OmiseProvider();


export async function downloadOmiseQrImage(
  downloadUri: string,
): Promise<Buffer> {
  const secretKey =
    getSecretKey();

  const auth =
    Buffer.from(
      `${secretKey}:`,
    ).toString("base64");

  const response =
    await fetch(
      downloadUri,
      {
        method: "GET",
        headers: {
          Authorization:
            `Basic ${auth}`,
          Accept:
            "image/*",
        },
        signal:
          AbortSignal.timeout(15_000),
      },
    );

  if (!response.ok) {
    throw new Error(
      `ไม่สามารถดาวน์โหลด QR จาก Omise ได้ (HTTP ${response.status})`,
    );
  }

  const contentType =
    response.headers.get(
      "content-type",
    );

  if (
    !contentType ||
    !contentType.startsWith(
      "image/",
    )
  ) {
    throw new Error(
      "Omise ไม่ได้ส่งไฟล์รูปภาพ QR กลับมา",
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  if (
    arrayBuffer.byteLength === 0
  ) {
    throw new Error(
      "ไฟล์ QR จาก Omise ว่างเปล่า",
    );
  }

  return sharp(
    Buffer.from(arrayBuffer),
  )
    .png()
    .toBuffer();
}
