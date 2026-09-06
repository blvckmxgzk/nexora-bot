import type {
  CreateRefundInput,
  RefundCreationResult,
  RefundProvider,
} from "../refundProvider.js";

const OMISE_API_URL =
  "https://api.omise.co";

function getSecretKey(): string {
  const key =
    process.env.OMISE_SECRET_KEY;

  if (!key) {
    throw new Error(
      "Missing environment variable: OMISE_SECRET_KEY",
    );
  }

  return key;
}

export const omiseRefundProvider:
  RefundProvider = {
    async createRefund(
      input: CreateRefundInput,
    ): Promise<RefundCreationResult> {
      const auth =
        Buffer.from(
          `${getSecretKey()}:`,
        ).toString("base64");

      const body =
        new URLSearchParams();

      body.set(
        "amount",
        String(
          Math.round(
            input.amount * 100,
          ),
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
                `Basic ${auth}`,

              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body,
          },
        );

      const data =
        (await response.json()) as {
          id?: string;
          status?: string;
          amount?: number;
          currency?: string;
          voided?: boolean;
          message?: string;
          code?: string;
        };

      if (
        !response.ok ||
        !data.id
      ) {
        throw new Error(
          data.message ??
            `Omise refund failed (${response.status})`,
        );
      }

      return {
        providerRefundId:
          data.id,

        status:
          data.status ??
          "unknown",

        amount:
          Number(
            data.amount ?? 0,
          ) / 100,

        currency:
          data.currency ??
          "THB",

        voided:
          Boolean(
            data.voided,
          ),
      };
    },
  };
