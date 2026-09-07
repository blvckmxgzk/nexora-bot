export type PayoutProviderName =
  | "omise";

export interface CreatePayoutRecipientInput {
  payoutAccountId: string;
  sellerId: string;
  shopId: string;
  accountHolderName: string;
  bankCode: string;
  accountNumber: string;
}

export interface FindPayoutRecipientInput {
  payoutAccountId: string;
  sellerId: string;
  shopId: string;
}

export interface PayoutRecipientSnapshot {
  recipientId: string;
  active: boolean;
  verified: boolean;
  failureCode: string | null;
  bankCode: string | null;
  bankBrand: string | null;
  bankLastDigits: string | null;
  accountHolderName: string | null;
}

export interface CreatePayoutTransferInput {
  payoutId: string;
  sellerId: string;
  shopId: string;
  recipientId: string;
  amountSatang: number;
  idempotencyKey: string;
}

export interface FindPayoutTransferInput {
  payoutId: string;
  sellerId: string;
  shopId: string;
  recipientId: string;
  amountSatang: number;
}

export interface PayoutProviderBalanceSnapshot {
  currency:
    string;

  totalSatang:
    number;

  transferableSatang:
    number;

  onHoldSatang:
    number |
    null;

  reserveSatang:
    number |
    null;
}

export interface PayoutTransferSnapshot {
  providerTransferId: string;
  recipientId: string;
  amountSatang: number;
  currency: string;
  sendable: boolean;
  sent: boolean;
  paid: boolean;
  deleted: boolean;
  sentAt: Date | null;
  paidAt: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  feeSatang: number | null;
  netSatang: number | null;
}

export interface PayoutProvider {
  readonly name:
    PayoutProviderName;

  createRecipient(
    input:
      CreatePayoutRecipientInput,
  ): Promise<PayoutRecipientSnapshot>;

  findExistingRecipient(
    input:
      FindPayoutRecipientInput,
  ): Promise<
    PayoutRecipientSnapshot |
    null
  >;

  retrieveRecipient(
    recipientId: string,
  ): Promise<PayoutRecipientSnapshot>;

  retrieveBalance():
    Promise<PayoutProviderBalanceSnapshot>;

  createTransfer(
    input:
      CreatePayoutTransferInput,
  ): Promise<PayoutTransferSnapshot>;

  findExistingTransfer(
    input:
      FindPayoutTransferInput,
  ): Promise<
    PayoutTransferSnapshot |
    null
  >;

  retrieveTransfer(
    transferId: string,
  ): Promise<PayoutTransferSnapshot>;
}
