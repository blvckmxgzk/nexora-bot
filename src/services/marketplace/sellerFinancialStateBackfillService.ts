import {
  SellerFinancialState,
} from "../../models/SellerFinancialState.js";

import {
  SellerLedgerEntry,
} from "../../models/SellerLedgerEntry.js";

interface LedgerSellerGroup {
  _id:
    string;

  shopIds:
    string[];
}

export interface SellerFinancialStateBackfillResult {
  scanned:
    number;

  created:
    number;

  existing:
    number;
}

export async function backfillSellerFinancialStates():
  Promise<SellerFinancialStateBackfillResult> {
  const groups =
    await SellerLedgerEntry
      .aggregate<LedgerSellerGroup>([
        {
          $group: {
            _id:
              "$sellerId",

            shopIds: {
              $addToSet:
                "$shopId",
            },
          },
        },

        {
          $sort: {
            _id:
              1,
          },
        },
      ]);

  let created =
    0;

  let existing =
    0;

  for (
    const group
    of groups
  ) {
    const sellerId =
      group._id;

    const shopIds =
      group.shopIds.filter(
        (
          value,
        ): value is string =>
          typeof value ===
            "string" &&
          value.length >
            0,
      );

    if (
      !sellerId ||
      shopIds.length !==
        1
    ) {
      throw new Error(
        `SellerFinancialState backfill พบ seller ที่มี shop identity ไม่สอดคล้อง: ${sellerId}`,
      );
    }

    const shopId =
      shopIds[0];

    const current =
      await SellerFinancialState
        .findOne({
          sellerId,
        });

    if (current) {
      if (
        current.shopId !==
        shopId
      ) {
        throw new Error(
          `SellerFinancialState shopId mismatch สำหรับ seller ${sellerId}`,
        );
      }

      existing++;
      continue;
    }

    try {
      const result =
        await SellerFinancialState
          .updateOne(
            {
              sellerId,
            },
            {
              $setOnInsert: {
                sellerId,
                shopId,

                /*
                 * Backfill ไม่ใช่ financial mutation
                 * จึงไม่ increment revision
                 */
                revision:
                  0,
              },
            },
            {
              upsert:
                true,
            },
          );

      if (
        result.upsertedCount ===
        1
      ) {
        created++;
      } else {
        existing++;
      }
    } catch (
      error: any
    ) {
      if (
        error?.code !==
        11000
      ) {
        throw error;
      }

      const raced =
        await SellerFinancialState
          .findOne({
            sellerId,
          });

      if (
        !raced ||
        raced.shopId !==
          shopId
      ) {
        throw new Error(
          `SellerFinancialState concurrent backfill conflict สำหรับ seller ${sellerId}`,
        );
      }

      existing++;
    }
  }

  return {
    scanned:
      groups.length,

    created,

    existing,
  };
}
