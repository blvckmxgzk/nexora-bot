export type ProviderDisputeStatus =
  | "open"
  | "pending"
  | "won"
  | "lost";

export type ProviderDisputeListState =
  | "open"
  | "pending"
  | "closed";

export interface ProviderDisputeTransactionSnapshot {
  providerTransactionId:
    string;

  direction:
    "debit" |
    "credit";

  key:
    string |
    null;

  amountSatang:
    number;

  currency:
    string;

  createdAt:
    Date |
    null;
}

export interface ProviderDisputeSnapshot {
  providerDisputeId:
    string;

  providerChargeId:
    string;

  status:
    ProviderDisputeStatus;

  amountSatang:
    number;

  fundingAmountSatang:
    number;

  currency:
    string;

  fundingCurrency:
    string;

  providerDebitSatang:
    number;

  providerCreditSatang:
    number;

  transactions:
    ProviderDisputeTransactionSnapshot[];

  reasonCode:
    string |
    null;

  reasonMessage:
    string |
    null;

  message:
    string |
    null;

  adminMessage:
    string |
    null;

  createdAt:
    Date |
    null;

  closedAt:
    Date |
    null;
}

interface OmiseTransaction {
  id?: string;

  amount?: number;

  currency?: string;

  direction?:
    string;

  type?:
    string;

  key?:
    string;

  origin?:
    string;

  source?:
    string;

  created_at?:
    string;

  created?:
    string;
}

interface OmiseDisputeResponse {
  object?: string;

  id?: string;

  livemode?: boolean;

  amount?: number;

  funding_amount?: number;

  currency?: string;

  funding_currency?: string;

  charge?:
    | string
    | {
        id?: string;
      };

  status?: string;

  transactions?:
    OmiseTransaction[];

  reason_code?:
    string |
    null;

  reason_message?:
    string |
    null;

  message?:
    string |
    null;

  admin_message?:
    string |
    null;

  created_at?:
    string;

  created?:
    string;

  closed_at?:
    string |
    null;
}

interface OmiseDisputeListResponse {
  object?: string;

  data?: OmiseDisputeResponse[];

  total?: number;

  limit?: number;

  offset?: number;
}

interface OmiseErrorResponse {
  message?: string;
}

const OMISE_API_URL =
  "https://api.omise.co";

function getTestSecretKey():
  string {
  const value =
    process.env
      .OMISE_SECRET_KEY;

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

function safeInteger(
  name:
    string,

  value:
    unknown,

  positive = false,
): number {
  if (
    typeof value !==
      "number" ||
    !Number.isSafeInteger(
      value,
    ) ||
    value <
      (
        positive
          ? 1
          : 0
      )
  ) {
    throw new Error(
      `Omise Dispute ${name} ไม่ถูกต้อง`,
    );
  }

  return value;
}

function safeAdd(
  left:
    number,

  right:
    number,
): number {
  const result =
    left +
    right;

  if (
    !Number.isSafeInteger(
      result,
    )
  ) {
    throw new Error(
      "Omise Dispute transaction total เกิน safe integer",
    );
  }

  return result;
}

function parseDate(
  value:
    unknown,
): Date |
  null {
  if (
    typeof value !==
      "string"
  ) {
    return null;
  }

  const date =
    new Date(
      value,
    );

  return Number.isFinite(
    date.getTime(),
  )
    ? date
    : null;
}

function chargeId(
  charge:
    OmiseDisputeResponse[
      "charge"
    ],
): string {
  if (
    typeof charge ===
      "string" &&
    charge
  ) {
    return charge;
  }

  if (
    typeof charge ===
      "object" &&
    charge !==
      null
  ) {
    const id =
      charge.id;

    if (
      typeof id ===
        "string" &&
      id
    ) {
      return id;
    }
  }

  throw new Error(
    "Omise Dispute ไม่มี Charge ID",
  );
}

function normalize(
  dispute:
    OmiseDisputeResponse,
): ProviderDisputeSnapshot {
  if (
    dispute.livemode ===
    true
  ) {
    throw new Error(
      "Omise ส่ง Live Dispute กลับมา แต่ NEXORA ยังอยู่ใน Pre-Live mode",
    );
  }

  if (
    dispute.object &&
    dispute.object !==
      "dispute"
  ) {
    throw new Error(
      "Omise response ไม่ใช่ Dispute",
    );
  }

  if (
    typeof dispute.id !==
      "string" ||
    !dispute.id
  ) {
    throw new Error(
      "Omise Dispute ID ไม่ถูกต้อง",
    );
  }

  const statuses =
    new Set([
      "open",
      "pending",
      "won",
      "lost",
    ]);

  if (
    typeof dispute.status !==
      "string" ||
    !statuses.has(
      dispute.status,
    )
  ) {
    throw new Error(
      `Omise Dispute status ไม่รองรับ: ${dispute.status}`,
    );
  }

  const amount =
    safeInteger(
      "amount",
      dispute.amount,
      true,
    );

  const fundingAmount =
    safeInteger(
      "funding_amount",
      dispute
        .funding_amount ??
        dispute.amount,
      true,
    );

  const currency =
    (
      dispute.currency ??
      ""
    ).toUpperCase();

  const fundingCurrency =
    (
      dispute
        .funding_currency ??
      dispute.currency ??
      ""
    ).toUpperCase();

  if (
    currency !==
      "THB" ||
    fundingCurrency !==
      "THB"
  ) {
    throw new Error(
      "NEXORA Dispute รองรับเฉพาะ THB",
    );
  }

  if (
    fundingAmount !==
    amount
  ) {
    throw new Error(
      "NEXORA ยังไม่รองรับ multi-currency Dispute",
    );
  }

  const transactions:
    ProviderDisputeTransactionSnapshot[] =
      [];

  let debit =
    0;

  let credit =
    0;

  for (
    const transaction
    of dispute.transactions ??
      []
  ) {
    if (
      typeof transaction.id !==
        "string" ||
      !transaction.id
    ) {
      throw new Error(
        "Omise Dispute transaction ไม่มี ID",
      );
    }

    const direction =
      transaction.direction ??
      transaction.type;

    if (
      direction !==
        "debit" &&
      direction !==
        "credit"
    ) {
      throw new Error(
        `Omise Dispute transaction direction ไม่รองรับ: ${direction}`,
      );
    }

    const transactionAmount =
      safeInteger(
        "transaction amount",
        transaction.amount,
        true,
      );

    const transactionCurrency =
      (
        transaction.currency ??
        ""
      ).toUpperCase();

    if (
      transactionCurrency !==
      "THB"
    ) {
      throw new Error(
        "Omise Dispute transaction ต้องเป็น THB",
      );
    }

    const origin =
      transaction.origin ??
      transaction.source ??
      null;

    if (
      origin &&
      origin !==
        dispute.id
    ) {
      throw new Error(
        "Omise Dispute transaction origin ไม่ตรงกับ Dispute",
      );
    }

    if (
      direction ===
      "debit"
    ) {
      debit =
        safeAdd(
          debit,
          transactionAmount,
        );
    } else {
      credit =
        safeAdd(
          credit,
          transactionAmount,
        );
    }

    transactions.push({
      providerTransactionId:
        transaction.id,

      direction,

      key:
        transaction.key ??
        null,

      amountSatang:
        transactionAmount,

      currency:
        transactionCurrency,

      createdAt:
        parseDate(
          transaction
            .created_at ??
          transaction.created,
        ),
    });
  }

  return {
    providerDisputeId:
      dispute.id,

    providerChargeId:
      chargeId(
        dispute.charge,
      ),

    status:
      dispute.status as
        ProviderDisputeStatus,

    amountSatang:
      amount,

    fundingAmountSatang:
      fundingAmount,

    currency,

    fundingCurrency,

    providerDebitSatang:
      debit,

    providerCreditSatang:
      credit,

    transactions,

    reasonCode:
      dispute.reason_code ??
      null,

    reasonMessage:
      dispute.reason_message ??
      null,

    message:
      dispute.message ??
      null,

    adminMessage:
      dispute.admin_message ??
      null,

    createdAt:
      parseDate(
        dispute.created_at ??
        dispute.created,
      ),

    closedAt:
      parseDate(
        dispute.closed_at,
      ),
  };
}

async function request<T>(
  path:
    string,
): Promise<T> {
  const secretKey =
    getTestSecretKey();

  const auth =
    Buffer.from(
      `${secretKey}:`,
    ).toString(
      "base64",
    );

  const response =
    await fetch(
      `${OMISE_API_URL}${path}`,
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
    unknown;

  try {
    data =
      JSON.parse(
        text,
      );
  } catch {
    throw new Error(
      `Omise returned invalid JSON (HTTP ${response.status})`,
    );
  }

  if (!response.ok) {
    const error =
      data as
        OmiseErrorResponse;

    throw new Error(
      error.message ??
      `Omise API request failed (HTTP ${response.status})`,
    );
  }

  return data as T;
}

export const omiseDisputeProvider = {
  async listDisputes(
    state:
      ProviderDisputeListState,

    options: {
      from?:
        Date;

      to?:
        Date;

      maxRecords?:
        number;
    } = {},
  ): Promise<
    ProviderDisputeSnapshot[]
  > {
    const maxRecords =
      Math.max(
        1,
        Math.min(
          500,
          Math.trunc(
            options.maxRecords ??
            200,
          ),
        ),
      );

    const path =
      state ===
        "open"
        ? "/disputes/open"
        : state ===
            "pending"
          ? "/disputes/pending"
          : "/disputes/closed";

    const results:
      ProviderDisputeSnapshot[] =
        [];

    let offset =
      0;

    while (
      results.length <
      maxRecords
    ) {
      const pageLimit =
        Math.min(
          100,
          maxRecords -
            results.length,
        );

      const query =
        new URLSearchParams({
          limit:
            String(
              pageLimit,
            ),

          offset:
            String(
              offset,
            ),

          order:
            "reverse_chronological",
        });

      if (
        options.from instanceof
          Date &&
        Number.isFinite(
          options.from.getTime(),
        )
      ) {
        query.set(
          "from",
          options.from
            .toISOString(),
        );
      }

      if (
        options.to instanceof
          Date &&
        Number.isFinite(
          options.to.getTime(),
        )
      ) {
        query.set(
          "to",
          options.to
            .toISOString(),
        );
      }

      const list =
        await request<
          OmiseDisputeListResponse
        >(
          `${path}?${query.toString()}`,
        );

      if (
        list.object &&
        list.object !==
          "list"
      ) {
        throw new Error(
          "Omise Dispute list response ไม่ใช่ list",
        );
      }

      const data =
        Array.isArray(
          list.data,
        )
          ? list.data
          : [];

      for (
        const dispute
        of data
      ) {
        results.push(
          normalize(
            dispute,
          ),
        );

        if (
          results.length >=
          maxRecords
        ) {
          break;
        }
      }

      offset +=
        data.length;

      if (
        data.length ===
          0 ||
        data.length <
          pageLimit ||
        (
          Number.isSafeInteger(
            list.total,
          ) &&
          offset >=
            (
              list.total ??
              0
            )
        )
      ) {
        break;
      }
    }

    return results;
  },

  async retrieveDispute(
    providerDisputeId:
      string,
  ): Promise<ProviderDisputeSnapshot> {
    if (
      !providerDisputeId
        .trim()
    ) {
      throw new Error(
        "Provider Dispute ID ว่างเปล่า",
      );
    }

    const dispute =
      await request<OmiseDisputeResponse>(
        `/disputes/${encodeURIComponent(
          providerDisputeId,
        )}`,
      );

    return normalize(
      dispute,
    );
  },
};
