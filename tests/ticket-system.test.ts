import {
  describe,
  expect,
  it,
} from "vitest";

import {
  TICKET_TYPES,
  TICKET_TYPE_MAP,
  isTicketType,
} from "../src/community/tickets/ticketTypes.ts";

describe("NEXORA Ticket System", () => {
  it("has unique ticket types", () => {
    const ids = TICKET_TYPES.map((type) => type.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains core ticket categories", () => {
    for (const id of [
      "support",
      "report",
      "appeal",
      "marketplace",
      "payment",
      "bug",
      "partnership",
    ]) {
      expect(isTicketType(id)).toBe(true);
      expect(TICKET_TYPE_MAP.get(id as any)).toBeTruthy();
    }
  });
});
