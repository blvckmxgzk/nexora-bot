import type {
  CreateRefundInput,
  RefundCreationResult,
  RefundProvider,
} from "../refundProvider.js";

const OMISE_API_URL =
  "https://api.omise.co";

const REFUND_CURRENCY =
  "THB";

function getSecretKey(): string {
  const key =
    process.env.OMISE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "Missing environment variable: OMISE_SECRET_KEY",
    );
  }

  if (
    !key.startsWith(
      "skey_test_",
    )
  ) {
    throw new Error(
      "Live Omise key ถูกบล็อก: NEXORA ยังอยู่ใน Pre-Live mode",
    );
  }

  return key;
}

function createAuthHeader(): string {
  const auth =
    Buffer.from(
      `${getSecretKey()}:`,
    ).toString("base64");

  return `Basic ${auth}`;
}

function getExpectedAmount(
  amount: number,
): number {
  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error(
      "จำนวนเงิน Refund ไม่ถูกต้อง",
    );
  }

  return Math.round(
    amount * 100,
  );
}

function normalizeCurrency(
  currency: string | undefined,
): string {
  return (
    currency ??
    REFUND_CURRENCY
  ).toUpperCase();
}

export const omiseRefundProvider:
  RefundProvider = {
  async createRefund(
    input: CreateRefundInput,
  ): Promise<RefundCreationResult> {
    const expectedAmount =
      getExpectedAmount(
        input.amount,
      );

    const body =
      new URLSearchParams();

    body.set(
      "amount",
      String(
        expectedAmount,
      ),
    );

    body.set(
      "metadata[order_id]",
      input.orderId,
    );

    body.set(
      "metadata[refund_id]",
      input.refundId,
    );

    const response =
      await fetch(
        `${OMISE_API_URL}/charges/${encodeURIComponent(
          input.providerPaymentId,
        )}/refunds`,
        {
          method: "POST",

          headers: {
            Authorization:
              createAuthHeader(),

            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body,

          signal:
            AbortSignal.timeout(
              15_000,
            ),
        },
      );

    let data:
      | {
          id?: string;
          status?: string;
          amount?: number;
          currency?: string;
          voided?: boolean;
          message?: string;
          code?: string;
        }
      | null = null;

    try {
      data =
        (await response.json()) as {
          id?: string;
          status?: string;
          amount?: number;
          currency?: string;
          voided?: boolean;
          message?: string;
          code?: string;
        };
    } catch {
      data = null;
    }

    if (
      !response.ok ||
      !data?.id
    ) {
      throw new Error(
        data?.message ??
          `Omise refund failed (${response.status})`,
      );
    }

    const amount =
      Number(
        data.amount ?? 0,
      ) / 100;

    const currency =
      normalizeCurrency(
        data.currency,
      );

    if (
      Math.round(
        amount * 100,
      ) !== expectedAmount
    ) {
      throw new Error(
        "จำนวนเงิน Refund ที่ได้รับจาก Omise ไม่ตรงกับจำนวนที่ร้องขอ",
      );
    }

    if (
      currency !==
      REFUND_CURRENCY
    ) {
      throw new Error(
        `Omise Refund ใช้ Currency ${currency} ซึ่งไม่รองรับ`,
      );
    }

    return {
      providerRefundId:
        data.id,

      status:
        data.status ??
        "unknown",

      amount,

      currency,

      voided:
        Boolean(
          data.voided,
        ),
    };
  },

  async findExistingRefund(
    input: CreateRefundInput,
  ): Promise<RefundCreationResult | null> {
    const expectedAmount =
      getExpectedAmount(
        input.amount,
      );

    const response =
      await fetch(
        `${OMISE_API_URL}/charges/${encodeURIComponent(
          input.providerPaymentId,
        )}/refunds?order=reverse_chronological&limit=100`,
        {
          method: "GET",

          headers: {
            Authorization:
              createAuthHeader(),
          },

          signal:
            AbortSignal.timeout(
              15_000,
            ),
        },
      );

    let data:
      | {
          object?: string;
          data?: Array<{
            id?: string;
            status?: string;
            amount?: number;
            currency?: string;
            voided?: boolean;
            metadata?: Record<
              string,
              unknown
            >;
          }>;
          message?: string;
        }
      | null = null;

    try {
      data =
        (await response.json()) as {
          object?: string;
          data?: Array<{
            id?: string;
            status?: string;
            amount?: number;
            currency?: string;
            voided?: boolean;
            metadata?: Record<
              string,
              unknown
            >;
          }>;
          message?: string;
        };
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ??
          `Omise refund lookup failed (${response.status})`,
      );
    }

    const existing =
      data?.data?.find(
        (item) => {
          if (
            item.metadata
              ?.refund_id !==
            input.refundId
          ) {
            return false;
          }

          if (!item.id) {
            return false;
          }

          if (
            Number(
              item.amount,
            ) !==
            expectedAmount
          ) {
            return false;
          }

          const currency =
            normalizeCurrency(
              item.currency,
            );

          if (
            currency !==
            REFUND_CURRENCY
          ) {
            return false;
          }

          return true;
        },
      );

    if (!existing?.id) {
      return null;
    }

    const amount =
      Number(
        existing.amount ?? 0,
      ) / 100;

    const currency =
      normalizeCurrency(
        existing.currency,
      );

    return {
      providerRefundId:
        existing.id,

      status:
        existing.status ??
        "unknown",

      amount,

      currency,

      voided:
        Boolean(
          existing.voided,
        ),
    };
  },
};
