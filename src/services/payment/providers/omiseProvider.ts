import sharp from "sharp";

import type {
  CreatePaymentInput,
  PaymentCreationResult,
  PaymentProvider,
  PaymentProviderName,
  PaymentVerificationResult,
  PaymentAccountingSnapshot,
} from "../paymentProvider.js";

interface OmiseCharge {
  id: string;

  livemode?: boolean;

  amount: number;

  currency: string;

  status: string;

  fee?: number | null;

  fee_vat?: number | null;

  funding_amount?: number | null;

  funding_currency?: string | null;

  net?: number | null;

  transaction?:
    | string
    | {
        id?: string;
      }
    | null;
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

function assertTestCharge(
  charge:
    OmiseCharge,
): void {
  if (
    charge.livemode ===
    true
  ) {
    throw new Error(
      "Omise ส่ง Live Charge กลับมา แต่ NEXORA ยังอยู่ใน Pre-Live mode",
    );
  }
}

function nullableTransactionId(
  value:
    OmiseCharge[
      "transaction"
    ],
): string | null {
  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  return (
    value?.id ??
    null
  );
}

function normalizePaidAccounting(
  charge:
    OmiseCharge,
):
  | PaymentAccountingSnapshot
  | null {
  assertTestCharge(
    charge,
  );

  if (
    charge.status !==
    "successful"
  ) {
    return null;
  }

  /*
   * Legacy test fixtures อาจไม่มี
   * accounting fields
   *
   * production paymentService จะ
   * fail closed หาก paid Charge
   * ไม่มี accounting
   */
  if (
    charge.fee == null ||
    charge.fee_vat == null ||
    charge.net == null
  ) {
    return null;
  }

  const gross =
    charge.amount;

  const funding =
    charge.funding_amount ??
    gross;

  const fee =
    charge.fee;

  const feeVat =
    charge.fee_vat;

  const net =
    charge.net;

  for (
    const [
      name,
      value,
    ]
    of [
      [
        "amount",
        gross,
      ],
      [
        "funding_amount",
        funding,
      ],
      [
        "fee",
        fee,
      ],
      [
        "fee_vat",
        feeVat,
      ],
      [
        "net",
        net,
      ],
    ] as const
  ) {
    if (
      !Number.isSafeInteger(
        value,
      ) ||
      value < 0
    ) {
      throw new Error(
        `Omise Charge ${name} ไม่ถูกต้อง`,
      );
    }
  }

  const currency =
    charge.currency
      .toUpperCase();

  const fundingCurrency =
    (
      charge.funding_currency ??
      charge.currency
    ).toUpperCase();

  if (
    currency !==
      "THB" ||
    fundingCurrency !==
      "THB"
  ) {
    throw new Error(
      "Omise Charge accounting ต้องเป็น THB",
    );
  }

  if (
    funding !==
    gross
  ) {
    throw new Error(
      "NEXORA ยังไม่รองรับ multi-currency Payment accounting",
    );
  }

  if (
    net >
    funding
  ) {
    throw new Error(
      "Omise Charge net มากกว่า funding amount",
    );
  }

  const deductions =
    funding -
    net;

  if (
    fee + feeVat >
    deductions
  ) {
    throw new Error(
      "Omise Charge fee + VAT มากกว่า provider deductions",
    );
  }

  return {
    grossAmountSatang:
      gross,

    fundingAmountSatang:
      funding,

    providerFeeSatang:
      fee,

    providerFeeVatSatang:
      feeVat,

    providerDeductionsSatang:
      deductions,

    providerNetSatang:
      net,

    currency,

    fundingCurrency,

    providerTransactionId:
      nullableTransactionId(
        charge.transaction,
      ),
  };
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

    assertTestCharge(
      charge,
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

    assertTestCharge(
      charge,
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

    assertTestCharge(
      charge,
    );

    const providerExpiresAt =
      charge.expires_at
        ? new Date(
            charge.expires_at,
          )
        : null;

    const accounting =
      normalizePaidAccounting(
        charge,
      );

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

      accounting,
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
