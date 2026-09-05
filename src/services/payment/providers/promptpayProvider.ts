import type {
  CreatePaymentInput,
  PaymentCreationResult,
  PaymentProvider,
  PaymentVerificationResult,
} from "../paymentProvider.js";

export class PromptPayProvider
  implements PaymentProvider
{
  readonly name =
    "promptpay" as const;

  async createPayment(
    input: CreatePaymentInput,
  ): Promise<PaymentCreationResult> {
    return {
      provider: this.name,

      providerPaymentId:
        `PP-${input.paymentId}`,

      paymentReference:
        input.paymentId,

      paymentUrl: null,

      qrData: null,

      instructions:
        [
          "ชำระเงินผ่าน PromptPay",
          `จำนวนเงิน: ฿${input.amount.toLocaleString("th-TH")}`,
          `หมดเวลา: ${input.expiresAt.toLocaleString("th-TH")}`,
          "",
          "Provider จริงจะถูกเชื่อมต่อในขั้นตอน Payment Gateway",
        ].join("\n"),
    };
  }

  async verifyPayment(
    providerPaymentId: string,
  ): Promise<PaymentVerificationResult> {
    void providerPaymentId;

    return {
      paid: false,
      providerPaymentId,
      paidAt: null,
    };
  }
}
