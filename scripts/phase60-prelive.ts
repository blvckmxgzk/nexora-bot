import {
  connectDatabase,
  disconnectDatabase,
} from "../src/database/connection.js";

import {
  backfillLegacyPaymentAccounting,
} from "../src/services/marketplace/preLiveFinancialMigrationService.js";

import {
  runPreLiveFinancialAudit,
} from "../src/services/marketplace/preLiveFinancialAuditService.js";

function readLimit():
  number {
  const argument =
    process.argv.find(
      (value) =>
        value.startsWith(
          "--limit=",
        ),
    );

  if (!argument) {
    return 100;
  }

  const value =
    Number(
      argument.slice(
        "--limit=".length,
      ),
    );

  if (
    !Number.isInteger(
      value,
    ) ||
    value <
      1
  ) {
    throw new Error(
      "--limit ต้องเป็นจำนวนเต็มมากกว่า 0",
    );
  }

  return Math.min(
    500,
    value,
  );
}

async function main():
  Promise<void> {
  const apply =
    process.argv.includes(
      "--apply",
    );

  if (
    apply &&
    process.env
      .NEXORA_PHASE60_ALLOW_APPLY !==
      "YES"
  ) {
    throw new Error(
      "Phase 6.0 apply ถูก block: ต้องตั้ง NEXORA_PHASE60_ALLOW_APPLY=YES พร้อม --apply",
    );
  }

  const limit =
    readLimit();

  console.log(
    apply
      ? "⚠️ Phase 6.0 APPLY mode"
      : "🔎 Phase 6.0 DRY-RUN mode",
  );

  await connectDatabase();

  try {
    const migration =
      await backfillLegacyPaymentAccounting({
        apply,
        limit,
      });

    console.log(
      "\n===== Migration =====",
    );

    console.log(
      JSON.stringify(
        migration,
        null,
        2,
      ),
    );

    const audit =
      await runPreLiveFinancialAudit();

    console.log(
      "\n===== Pre-Live Audit =====",
    );

    console.log(
      JSON.stringify(
        audit,
        null,
        2,
      ),
    );

    if (
      apply &&
      (
        migration.unresolved >
          0 ||
        !audit.ready
      )
    ) {
      process.exitCode =
        2;
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch(
  (error) => {
    console.error(
      "❌ Phase 6.0 failed:",
      error,
    );

    process.exitCode =
      1;
  },
);
