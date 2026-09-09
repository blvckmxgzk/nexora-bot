import {
  Events,
  type AutoModerationActionExecution,
} from "discord.js";

import {
  autoModService,
} from "../services/community/autoModService.js";

export const name =
  Events.AutoModerationActionExecution;

export async function execute(
  execution:
    AutoModerationActionExecution,
): Promise<void> {
  try {
    await autoModService
      .handleExecution(
        execution,
      );
  } catch (error) {
    console.error(
      "❌ AutoMod action handling failed:",
      error,
    );
  }
}
