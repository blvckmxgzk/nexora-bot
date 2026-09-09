import {
  Events,
  type Guild,
  type GuildAuditLogsEntry,
} from "discord.js";

import {
  securityService,
} from "../services/community/securityService.js";

export const name =
  Events.GuildAuditLogEntryCreate;

export async function execute(
  entry:
    GuildAuditLogsEntry,

  guild:
    Guild,
): Promise<void> {
  try {
    await securityService
      .handleAuditLogEntry(
        entry,
        guild,
      );
  } catch (error) {
    console.error(
      "❌ Security audit-log handling failed:",
      error,
    );
  }
}
