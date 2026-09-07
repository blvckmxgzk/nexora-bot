export type PaymentProviderName =
  | "promptpay"
  | "truemoney";

export interface CreatePaymentInput {
  paymentId: string;
  orderId: string;
  amount: number;

  /**
   * @deprecated
   * Legacy seller payment target.
   * Platform checkout must not use this field.
   */
  account?: string;

  expiresAt: Date;
  provider: PaymentProviderName;
}

export interface PaymentCreationResult {
  provider: PaymentProviderName;
  providerPaymentId: string;
  paymentReference: string;
  paymentUrl?: string | null;
  qrData?: string | null;
  instructions?: string | null;
  expiresAt?: Date | null;
}

export interface PaymentAccountingSnapshot {
  grossAmountSatang: number;

  fundingAmountSatang: number;

  providerFeeSatang: number;

  providerFeeVatSatang: number;

  /*
   * fundingAmount - providerNet
   *
   * ใช้ field นี้แทนการสมมติว่า
   * deduction มีแค่ fee + VAT เสมอ
   */
  providerDeductionsSatang: number;

  providerNetSatang: number;

  currency: string;

  fundingCurrency: string;

  providerTransactionId:
    string |
    null;
}

export interface PaymentVerificationResult {
  paid: boolean;
  providerPaymentId?: string | null;
  paidAt?: Date | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  expiresAt?: Date | null;

  accounting?:
    PaymentAccountingSnapshot |
    null;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;

  createPayment(
    input: CreatePaymentInput,
  ): Promise<PaymentCreationResult>;

  findExistingPayment?(
    input: CreatePaymentInput,
  ): Promise<PaymentCreationResult | null>;

  verifyPayment(
    providerPaymentId: string,
  ): Promise<PaymentVerificationResult>;
}
