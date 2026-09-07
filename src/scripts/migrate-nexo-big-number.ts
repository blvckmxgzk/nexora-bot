import {
  connectDatabase,
  disconnectDatabase,
} from "../database/connection.js";

import {
  Economy,
} from "../models/Economy.js";

import {
  Transaction,
} from "../models/Transaction.js";

function normalize(
  value:
    unknown,
): string {
  if (
    typeof value ===
    "string"
  ) {
    return value;
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return String(
      value,
    );
  }

  return "0";
}

async function main():
  Promise<void> {
  await connectDatabase();

  let economyUpdated =
    0;

  let transactionUpdated =
    0;

  const economies =
    Economy.collection
      .find({});

  for await (
    const economy
    of economies
  ) {
    const fields = {
      balance:
        normalize(
          economy.balance,
        ),

      bank:
        normalize(
          economy.bank,
        ),

      lifetimeEarned:
        normalize(
          economy
            .lifetimeEarned,
        ),

      lifetimeSpent:
        normalize(
          economy
            .lifetimeSpent,
        ),
    };

    const changed =
      typeof economy.balance !==
        "string" ||
      typeof economy.bank !==
        "string" ||
      typeof economy
        .lifetimeEarned !==
        "string" ||
      typeof economy
        .lifetimeSpent !==
        "string";

    if (changed) {
      await Economy.collection
        .updateOne(
          {
            _id:
              economy._id,
          },
          {
            $set:
              fields,
          },
        );

      economyUpdated++;
    }
  }

  const transactions =
    Transaction.collection
      .find({});

  for await (
    const transaction
    of transactions
  ) {
    const changed =
      typeof transaction.amount !==
        "string" ||
      typeof transaction
        .balanceBefore !==
        "string" ||
      typeof transaction
        .balanceAfter !==
        "string";

    if (!changed) {
      continue;
    }

    await Transaction.collection
      .updateOne(
        {
          _id:
            transaction._id,
        },
        {
          $set: {
            amount:
              normalize(
                transaction.amount,
              ),

            balanceBefore:
              normalize(
                transaction
                  .balanceBefore,
              ),

            balanceAfter:
              normalize(
                transaction
                  .balanceAfter,
              ),
          },
        },
      );

    transactionUpdated++;
  }

  console.log(
    `✅ Economy migrated: ${economyUpdated}`,
  );

  console.log(
    `✅ Transactions migrated: ${transactionUpdated}`,
  );
}

void main()
  .catch(
    (
      error,
    ) => {
      console.error(
        "❌ NEXO migration failed:",
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await disconnectDatabase();
    },
  );
