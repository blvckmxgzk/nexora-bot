export const TICKET_TYPES = [
  {
    id: "support",
    emoji: "💬",
    label: "General Support",
    description: "สอบถามทั่วไปหรือขอความช่วยเหลือ",
    color: 0x5865f2,
  },
  {
    id: "report",
    emoji: "🚨",
    label: "Report",
    description: "รายงานสมาชิกหรือเหตุการณ์ในคอมมิวนิตี",
    color: 0xed4245,
  },
  {
    id: "appeal",
    emoji: "⚖️",
    label: "Appeal",
    description: "อุทธรณ์การลงโทษหรือการตัดสินของทีมงาน",
    color: 0xfee75c,
  },
  {
    id: "marketplace",
    emoji: "🛍️",
    label: "Marketplace",
    description: "ปัญหาร้านค้า สินค้า หรือคำสั่งซื้อ",
    color: 0x57f287,
  },
  {
    id: "payment",
    emoji: "💳",
    label: "Payment",
    description: "ปัญหาการชำระเงิน เติมเงิน หรือ Refund",
    color: 0x00a8fc,
  },
  {
    id: "bug",
    emoji: "🐞",
    label: "Bot / Bug",
    description: "แจ้งบั๊กหรือปัญหาการใช้งาน NEXORA Bot",
    color: 0xeb459e,
  },
  {
    id: "partnership",
    emoji: "🤝",
    label: "Partnership",
    description: "ติดต่อทีมงาน พาร์ทเนอร์ หรือเรื่องธุรกิจ",
    color: 0x9b59b6,
  },
] as const;

export type TicketType =
  typeof TICKET_TYPES[number]["id"];

export const TICKET_TYPE_MAP =
  new Map(
    TICKET_TYPES.map((type) => [
      type.id,
      type,
    ]),
  );

export function isTicketType(
  value: string,
): value is TicketType {
  return TICKET_TYPE_MAP.has(
    value as TicketType,
  );
}
