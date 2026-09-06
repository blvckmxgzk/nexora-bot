export interface CreateRefundInput {
  providerPaymentId: string;
  amount: number;
  orderId: string;
  refundId: string;
}

export interface RefundCreationResult {
  providerRefundId: string;
  status: string;
  amount: number;
  currency: string;
  voided: boolean;
}

export interface RefundProvider {
  createRefund(
    input: CreateRefundInput,
  ): Promise<RefundCreationResult>;
}
