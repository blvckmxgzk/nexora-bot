export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded"
  | "disputed";

export const orderStatusService = {
  getName(
    status: OrderStatus,
  ): string {
    const names: Record<
      OrderStatus,
      string
    > = {
      pending:
        "🟡 รอดำเนินการ",

      awaiting_payment:
        "🟠 รอชำระเงิน",

      paid:
        "🔵 ชำระเงินแล้ว",

      processing:
        "🟣 กำลังดำเนินการ",

      completed:
        "🟢 สำเร็จ",

      cancelled:
        "🔴 ยกเลิก",

      refunded:
        "💰 คืนเงินแล้ว",

      disputed:
        "⚠️ มีข้อพิพาท",
    };

    return (
      names[status] ??
      status
    );
  },

  canCancel(
    status: OrderStatus,
  ): boolean {
    return (
      status === "pending" ||
      status ===
        "awaiting_payment"
    );
  },

  canRefund(
    status: OrderStatus,
  ): boolean {
    return (
      status === "paid" ||
      status === "processing" ||
      status === "completed"
    );
  },

  canProcess(
    status: OrderStatus,
  ): boolean {
    return (
      status === "paid"
    );
  },

  canComplete(
    status: OrderStatus,
  ): boolean {
    return (
      status === "processing" ||
      status === "paid"
    );
  },
};
