import type {
  CreatePaymentInput,
  PaymentCreationResult,
  PaymentProvider,
  PaymentVerificationResult,
} from "../paymentProvider.js";

export class TrueMoneyProvider
  implements PaymentProvider
{
  readonly name =
    "truemoney" as const;

  async createPayment(
    input: CreatePaymentInput,
  ): Promise<PaymentCreationResult> {
    return {
      provider: this.name,

      providerPaymentId:
        `TM-${input.paymentId}`,

      paymentReference:
        input.paymentId,

      paymentUrl: null,

      qrData: null,

      instructions:
        [
          "ชำระเงินผ่าน TrueMoney",
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
