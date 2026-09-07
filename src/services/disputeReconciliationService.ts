import {
  Dispute,
} from "../models/Dispute.js";

import {
  disputeService,
} from "./disputeService.js";

import {
  omiseDisputeProvider,
} from "./payment/providers/omiseDisputeProvider.js";

const CLOSED_DISCOVERY_LOOKBACK_MS =
  72 *
  60 *
  60 *
  1000;

export async function reconcileDisputes(
  limit =
    200,
) {
  const safeLimit =
    Math.max(
      1,
      Math.min(
        500,
        Math.trunc(
          limit,
        ),
      ),
    );

  const report = {
    checked:
      0,

    reconciled:
      0,

    ignored:
      0,

    failed:
      0,

    discovered:
      0,

    errors:
      [] as Array<{
        providerDisputeId:
          string;

        error:
          string;
      }>,
  };

  const processed =
    new Set<string>();

  async function apply(
    providerDisputeId:
      string,

    snapshot?:
      Awaited<
        ReturnType<
          typeof omiseDisputeProvider.retrieveDispute
        >
      >,
  ) {
    if (
      processed.has(
        providerDisputeId,
      )
    ) {
      return;
    }

    processed.add(
      providerDisputeId,
    );

    report.checked++;

    try {
      const canonical =
        snapshot ??
        await omiseDisputeProvider
          .retrieveDispute(
            providerDisputeId,
          );

      const result =
        await disputeService
          .applyProviderSnapshot(
            canonical,
          );

      if (
        result.ignored ===
        true
      ) {
        report.ignored++;
      } else {
        report.reconciled++;
      }
    } catch (error) {
      report.failed++;

      report.errors.push({
        providerDisputeId,

        error:
          error instanceof
            Error
            ? error.message
            : "Unknown dispute reconciliation error",
      });
    }
  }

  /*
   * 1. Known local blockers
   *
   * retrieve รายตัวเสมอเพื่อให้
   * Provider เป็น canonical truth
   */
  const local =
    await Dispute
      .find({
        $or: [
          {
            status: {
              $in: [
                "open",
                "pending",
              ],
            },
          },

          {
            status:
              "lost",

            riskResolvedAt:
              null,
          },

          {
            status:
              "won",

            "metadata.providerCreditConfirmed": {
              $ne:
                true,
            },
          },
        ],
      })
      .sort({
        lastReconciledAt:
          1,
      })
      .limit(
        safeLimit,
      );

  for (
    const dispute
    of local
  ) {
    await apply(
      dispute.providerDisputeId,
    );
  }

  /*
   * 2. Provider discovery
   *
   * สำคัญ:
   * ถ้า dispute.create webhook หาย
   * Mongo จะไม่มี Dispute record
   *
   * จึงต้อง list จาก Provider
   */
  const closedFrom =
    new Date(
      Date.now() -
      CLOSED_DISCOVERY_LOOKBACK_MS,
    );

  const discoverySets =
    await Promise.allSettled([
      omiseDisputeProvider
        .listDisputes(
          "open",
          {
            maxRecords:
              safeLimit,
          },
        ),

      omiseDisputeProvider
        .listDisputes(
          "pending",
          {
            maxRecords:
              safeLimit,
          },
        ),

      omiseDisputeProvider
        .listDisputes(
          "closed",
          {
            from:
              closedFrom,

            maxRecords:
              safeLimit,
          },
        ),
    ]);

  for (
    const discovery
    of discoverySets
  ) {
    if (
      discovery.status ===
      "rejected"
    ) {
      report.failed++;

      report.errors.push({
        providerDisputeId:
          "provider-list",

        error:
          discovery.reason instanceof
            Error
            ? discovery.reason.message
            : "Provider dispute discovery failed",
      });

      continue;
    }

    for (
      const snapshot
      of discovery.value
    ) {
      const known =
        processed.has(
          snapshot
            .providerDisputeId,
        );

      if (!known) {
        report.discovered++;
      }

      await apply(
        snapshot
          .providerDisputeId,

        snapshot,
      );
    }
  }

  return report;
}
