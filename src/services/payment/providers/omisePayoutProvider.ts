const OMISE_API_URL =
  "https://api.omise.co";

interface OmiseBankAccount {
  last_digits?: string | null;
  bank_code?: string | null;
  brand?: string | null;
  name?: string | null;
}

interface OmiseRecipientResponse {
  object?: string;
  id: string;
  livemode: boolean;
  deleted?: boolean;
  active?: boolean;
  verified?: boolean;
  failure_code?: string | null;
  name?: string | null;
  metadata?: Record<
    string,
    unknown
  >;
  bank_account?:
    | OmiseBankAccount
    | null;
}

interface OmiseTransferResponse {
  object?: string;
  id: string;
  livemode: boolean;
  deleted?: boolean;
  amount: number;
  currency: string;
  recipient:
    | string
    | {
        id?: string;
      };
  sendable?: boolean;
  sent?: boolean;
  paid?: boolean;
  sent_at?: string | null;
  paid_at?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  fee?: number | null;
  fee_vat?: number | null;
  total_fee?: number | null;
  net?: number | null;
  metadata?: Record<
    string,
    unknown
  >;
}

export interface OmiseRecipientSnapshot {
  recipientId: string;

  deleted?:
    boolean;

  active: boolean;
  verified: boolean;
  failureCode:
    | string
    | null;
  bankCode:
    | string
    | null;
  bankBrand:
    | string
    | null;
  bankLastDigits:
    | string
    | null;
  accountHolderName:
    | string
    | null;
}

export interface OmiseTransferSnapshot {
  providerTransferId:
    string;

  recipientId:
    string;

  amountSatang:
    number;

  currency:
    string;

  sendable:
    boolean;

  sent:
    boolean;

  paid:
    boolean;

  deleted:
    boolean;

  sentAt:
    Date | null;

  paidAt:
    Date | null;

  failureCode:
    string | null;

  failureMessage:
    string | null;

  feeSatang:
    number | null;

  netSatang:
    number | null;
}

function getTestSecretKey():
  string {
  const key =
    process.env
      .OMISE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "Missing environment variable: OMISE_SECRET_KEY",
    );
  }

  /*
   * Phase 5.3:
   * ห้ามใช้ Live Mode โดยเด็ดขาด
   */
  if (
    !key.startsWith(
      "skey_test_",
    )
  ) {
    throw new Error(
      "Phase 5.3 Payout รองรับเฉพาะ Omise Test Mode เท่านั้น",
    );
  }

  return key;
}

async function request<T>(
  path: string,

  options: {
    method?:
      | "GET"
      | "POST"
      | "PATCH";

    body?:
      URLSearchParams;
  } = {},
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
          options.method ??
          "GET",

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
          AbortSignal.timeout(
            15_000,
          ),
      },
    );

  const text =
    await response.text();

  let data: any;

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
    throw new Error(
      data?.message ??
        `Omise API request failed (HTTP ${response.status})`,
    );
  }

  return data as T;
}

function normalizeRecipient(
  recipient:
    OmiseRecipientResponse,
): OmiseRecipientSnapshot {
  if (
    recipient.livemode
  ) {
    throw new Error(
      "Omise ส่ง Live Recipient กลับมา แต่ NEXORA อยู่ใน Test Mode",
    );
  }

  return {
    recipientId:
      recipient.id,

    deleted:
      recipient.deleted ===
      true,

    active:
      recipient.active ===
      true,

    verified:
      recipient.verified ===
      true,

    failureCode:
      recipient
        .failure_code ??
      null,

    bankCode:
      recipient
        .bank_account
        ?.bank_code ??
      null,

    bankBrand:
      recipient
        .bank_account
        ?.brand ??
      null,

    bankLastDigits:
      recipient
        .bank_account
        ?.last_digits ??
      null,

    accountHolderName:
      recipient
        .bank_account
        ?.name ??
      recipient.name ??
      null,
  };
}

function getRecipientId(
  value:
    OmiseTransferResponse[
      "recipient"
    ],
): string {
  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  return (
    value?.id ??
    ""
  );
}

function normalizeTransfer(
  transfer:
    OmiseTransferResponse,
): OmiseTransferSnapshot {
  if (
    transfer.livemode
  ) {
    throw new Error(
      "Omise ส่ง Live Transfer กลับมา แต่ NEXORA อยู่ใน Test Mode",
    );
  }

  return {
    providerTransferId:
      transfer.id,

    recipientId:
      getRecipientId(
        transfer.recipient,
      ),

    amountSatang:
      transfer.amount,

    currency:
      transfer.currency
        .toUpperCase(),

    sendable:
      transfer.sendable ===
      true,

    sent:
      transfer.sent ===
      true,

    paid:
      transfer.paid ===
      true,

    deleted:
      transfer.deleted ===
      true,

    sentAt:
      transfer.sent_at
        ? new Date(
            transfer.sent_at,
          )
        : null,

    paidAt:
      transfer.paid_at
        ? new Date(
            transfer.paid_at,
          )
        : null,

    failureCode:
      transfer
        .failure_code ??
      null,

    failureMessage:
      transfer
        .failure_message ??
      null,

    feeSatang:
      Number.isSafeInteger(
        transfer.total_fee,
      )
        ? transfer
            .total_fee!
        : null,

    netSatang:
      Number.isSafeInteger(
        transfer.net,
      )
        ? transfer.net!
        : null,
  };
}

export const omisePayoutProvider = {
  name:
    "omise" as const,

  async createRecipient(
    input: {
      payoutAccountId:
        string;
      sellerId:
        string;
      shopId:
        string;
      accountHolderName:
        string;
      bankCode:
        string;
      accountNumber:
        string;
    },
  ): Promise<OmiseRecipientSnapshot> {
    /*
     * Test Mode เท่านั้น:
     * ไม่รับข้อมูลบัญชีธนาคารจริง
     */
    if (
      input.bankCode !==
      "test"
    ) {
      throw new Error(
        "Phase 5.3 ต้องใช้ Omise Test Bank โดยตั้ง Bank Code เป็น test",
      );
    }

    const body =
      new URLSearchParams();

    body.set(
      "name",
      input.accountHolderName,
    );

    body.set(
      "type",
      "individual",
    );

    body.set(
      "description",
      `NEXORA seller ${input.sellerId}`,
    );

    body.set(
      "bank_account[brand]",
      input.bankCode,
    );

    body.set(
      "bank_account[number]",
      input.accountNumber,
    );

    body.set(
      "bank_account[name]",
      input.accountHolderName,
    );

    body.set(
      "metadata[nexora_payout_account_id]",
      input.payoutAccountId,
    );

    body.set(
      "metadata[nexora_seller_id]",
      input.sellerId,
    );

    body.set(
      "metadata[nexora_shop_id]",
      input.shopId,
    );

    const recipient =
      await request<OmiseRecipientResponse>(
        "/recipients",
        {
          method:
            "POST",
          body,
        },
      );

    return normalizeRecipient(
      recipient,
    );
  },

  async findExistingRecipient(
    input: {
      payoutAccountId:
        string;
      sellerId:
        string;
      shopId:
        string;
    },
  ): Promise<
    OmiseRecipientSnapshot |
    null
  > {
    const query =
      new URLSearchParams({
        scope:
          "recipient",

        query:
          input.payoutAccountId,

        page:
          "1",

        per_page:
          "100",
      });

    const result =
      await request<{
        data?:
          OmiseRecipientResponse[];
      }>(
        `/search?${query.toString()}`,
      );

    const recipient =
      result.data?.find(
        (candidate) =>
          candidate.deleted !==
            true &&
          candidate.metadata
            ?.nexora_payout_account_id ===
            input.payoutAccountId &&
          candidate.metadata
            ?.nexora_seller_id ===
            input.sellerId &&
          candidate.metadata
            ?.nexora_shop_id ===
            input.shopId,
      );

    return recipient
      ? normalizeRecipient(
          recipient,
        )
      : null;
  },

  async retrieveRecipient(
    recipientId:
      string,
  ): Promise<OmiseRecipientSnapshot> {
    const recipient =
      await request<OmiseRecipientResponse>(
        `/recipients/${encodeURIComponent(
          recipientId,
        )}`,
      );

    return normalizeRecipient(
      recipient,
    );
  },

  async verifyRecipientForTest(
    recipientId:
      string,
  ): Promise<OmiseRecipientSnapshot> {
    const recipient =
      await request<OmiseRecipientResponse>(
        `/recipients/${encodeURIComponent(
          recipientId,
        )}/verify`,
        {
          method:
            "PATCH",
        },
      );

    return normalizeRecipient(
      recipient,
    );
  },

  async createTransfer(
    input: {
      payoutId:
        string;

      sellerId:
        string;

      shopId:
        string;

      recipientId:
        string;

      amountSatang:
        number;

      idempotencyKey:
        string;
    },
  ): Promise<OmiseTransferSnapshot> {
    if (
      !Number.isSafeInteger(
        input.amountSatang,
      ) ||
      input.amountSatang <=
        0
    ) {
      throw new Error(
        "จำนวนเงิน Transfer ไม่ถูกต้อง",
      );
    }

    const body =
      new URLSearchParams();

    body.set(
      "amount",
      String(
        input.amountSatang,
      ),
    );

    body.set(
      "recipient",
      input.recipientId,
    );

    /*
     * ถ้า Omise แจ้ง failure
     * ไม่ให้ provider retry เอง
     * เพื่อให้ NEXORA reconcile ได้ชัด
     */
    body.set(
      "fail_fast",
      "true",
    );

    body.set(
      "idemp_key",
      input.idempotencyKey,
    );

    body.set(
      "metadata[nexora_payout_id]",
      input.payoutId,
    );

    body.set(
      "metadata[nexora_seller_id]",
      input.sellerId,
    );

    body.set(
      "metadata[nexora_shop_id]",
      input.shopId,
    );

    const transfer =
      await request<OmiseTransferResponse>(
        "/transfers",
        {
          method:
            "POST",
          body,
        },
      );

    return normalizeTransfer(
      transfer,
    );
  },

  async findExistingTransfer(
    input: {
      payoutId:
        string;

      sellerId:
        string;

      shopId:
        string;

      recipientId:
        string;

      amountSatang:
        number;
    },
  ): Promise<
    OmiseTransferSnapshot |
    null
  > {
    /*
     * Recovery ต้อง validate หลาย field
     * พร้อมกันเสมอ
     *
     * ห้ามเชื่อแค่ payoutId หรือ amount
     */
    const matches =
      (
        candidate:
          OmiseTransferResponse,
      ): boolean =>
        candidate.deleted !==
          true &&
        candidate.metadata
          ?.nexora_payout_id ===
          input.payoutId &&
        candidate.metadata
          ?.nexora_seller_id ===
          input.sellerId &&
        candidate.metadata
          ?.nexora_shop_id ===
          input.shopId &&
        candidate.amount ===
          input.amountSatang &&
        candidate.currency
          ?.toUpperCase() ===
          "THB" &&
        getRecipientId(
          candidate.recipient,
        ) ===
          input.recipientId;

    /*
     * Recovery Layer 1:
     * Omise Search API
     *
     * Search metadata รองรับอย่างเป็นทางการ
     * แต่เราไม่ควรพึ่ง Search เพียงอย่างเดียว
     * สำหรับ financial idempotency
     */
    const searchQuery =
      new URLSearchParams({
        scope:
          "transfer",

        query:
          input.payoutId,

        page:
          "1",

        per_page:
          "100",
      });

    const searchResult =
      await request<{
        data?:
          OmiseTransferResponse[];
      }>(
        `/search?${searchQuery.toString()}`,
      );

    const searched =
      searchResult.data?.find(
        matches,
      );

    if (searched) {
      return normalizeTransfer(
        searched,
      );
    }

    /*
     * Recovery Layer 2:
     * List Transfers โดยตรง
     *
     * ช่วยกรณี Search index
     * ยังไม่เห็น Transfer ล่าสุด
     */
    const listQuery =
      new URLSearchParams({
        order:
          "reverse_chronological",

        limit:
          "100",

        offset:
          "0",
      });

    const listResult =
      await request<{
        data?:
          OmiseTransferResponse[];
      }>(
        `/transfers?${listQuery.toString()}`,
      );

    const listed =
      listResult.data?.find(
        matches,
      );

    return listed
      ? normalizeTransfer(
          listed,
        )
      : null;
  },

  async retrieveTransfer(
    transferId:
      string,
  ): Promise<OmiseTransferSnapshot> {
    const transfer =
      await request<OmiseTransferResponse>(
        `/transfers/${encodeURIComponent(
          transferId,
        )}`,
      );

    return normalizeTransfer(
      transfer,
    );
  },

  async markTransferSentForTest(
    transferId:
      string,
  ): Promise<OmiseTransferSnapshot> {
    const transfer =
      await request<OmiseTransferResponse>(
        `/transfers/${encodeURIComponent(
          transferId,
        )}/mark_as_sent`,
        {
          method:
            "POST",
        },
      );

    return normalizeTransfer(
      transfer,
    );
  },

  async markTransferPaidForTest(
    transferId:
      string,
  ): Promise<OmiseTransferSnapshot> {
    const transfer =
      await request<OmiseTransferResponse>(
        `/transfers/${encodeURIComponent(
          transferId,
        )}/mark_as_paid`,
        {
          method:
            "POST",
        },
      );

    return normalizeTransfer(
      transfer,
    );
  },
};
