import {
  env,
} from "../config/env.js";

import {
  connectDatabase,
  disconnectDatabase,
} from "../database/connection.js";

import {
  assertMarketplaceFinancialRuntimeSafety,
} from "../services/marketplace/financialRuntimeSafety.js";

import {
  runFinalLaunchAudit,
} from "../services/marketplace/finalLaunchAuditService.js";

async function main():
  Promise<void> {
  if (
    env.NODE_ENV !==
    "production"
  ) {
    throw new Error(
      "Final launch audit ต้องรันด้วย NODE_ENV=production",
    );
  }

  /*
   * ยังบล็อก Live Omise key อยู่
   * จนกว่า external approval จะครบ
   */
  assertMarketplaceFinancialRuntimeSafety();

  await connectDatabase();

  try {
    const audit =
      await runFinalLaunchAudit();

    console.log(
      JSON.stringify(
        audit,
        null,
        2,
      ),
    );

    if (
      !audit.ready
    ) {
      process.exitCode =
        1;
    }
  } finally {
    await disconnectDatabase();
  }
}

void main().catch(
  (
    error,
  ) => {
    console.error(
      "❌ Final launch audit failed:",
      error,
    );

    process.exitCode =
      1;
  },
);
