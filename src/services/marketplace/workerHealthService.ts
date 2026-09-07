import {
  WorkerHeartbeat,
} from "../../models/WorkerHeartbeat.js";

export type MarketplaceWorkerName =
  | "payment_expiration"
  | "payout_reconciliation"
  | "dispute_reconciliation"
  | "notification_delivery";

export const MARKETPLACE_WORKERS = {
  payment_expiration: {
    intervalMs:
      30_000,
  },

  payout_reconciliation: {
    intervalMs:
      60_000,
  },

  dispute_reconciliation: {
    intervalMs:
      60_000,
  },

  notification_delivery: {
    intervalMs:
      30_000,
  },
} as const;

function errorMessage(
  error:
    unknown,
): string {
  return (
    error instanceof Error
      ? error.message
      : String(error)
  ).slice(
    0,
    2000,
  );
}

async function bestEffort(
  operation:
    () =>
      Promise<unknown>,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.error(
      "⚠️ Worker heartbeat update failed:",
      error,
    );
  }
}

export const workerHealthService = {
  async markStarted(
    workerName:
      MarketplaceWorkerName,

    intervalMs:
      number,
  ): Promise<void> {
    const now =
      new Date();

    await bestEffort(
      async () => {
        await WorkerHeartbeat
          .findOneAndUpdate(
            {
              workerName,
            },
            {
              $set: {
                status:
                  "running",

                intervalMs,

                lastStartedAt:
                  now,

                lastStoppedAt:
                  null,

                lastError:
                  null,
              },

              $setOnInsert: {
                consecutiveFailures:
                  0,

                lastResult:
                  {},
              },
            },
            {
              upsert:
                true,

              new:
                true,
            },
          );
      },
    );
  },

  async markStopped(
    workerName:
      MarketplaceWorkerName,
  ): Promise<void> {
    await bestEffort(
      async () => {
        await WorkerHeartbeat
          .updateOne(
            {
              workerName,
            },
            {
              $set: {
                status:
                  "stopped",

                lastStoppedAt:
                  new Date(),
              },
            },
          );
      },
    );
  },

  async markCycleStarted(
    workerName:
      MarketplaceWorkerName,
  ): Promise<void> {
    await bestEffort(
      async () => {
        await WorkerHeartbeat
          .updateOne(
            {
              workerName,
            },
            {
              $set: {
                status:
                  "running",

                lastCycleStartedAt:
                  new Date(),
              },
            },
          );
      },
    );
  },

  async markCycleSuccess(
    workerName:
      MarketplaceWorkerName,

    durationMs:
      number,

    result:
      Record<
        string,
        unknown
      > =
        {},
  ): Promise<void> {
    await bestEffort(
      async () => {
        await WorkerHeartbeat
          .updateOne(
            {
              workerName,
            },
            {
              $set: {
                status:
                  "running",

                lastSuccessAt:
                  new Date(),

                lastDurationMs:
                  Math.max(
                    0,
                    Math.trunc(
                      durationMs,
                    ),
                  ),

                consecutiveFailures:
                  0,

                lastError:
                  null,

                lastResult:
                  result,
              },
            },
          );
      },
    );
  },

  async markCycleFailure(
    workerName:
      MarketplaceWorkerName,

    durationMs:
      number,

    error:
      unknown,
  ): Promise<void> {
    await bestEffort(
      async () => {
        await WorkerHeartbeat
          .updateOne(
            {
              workerName,
            },
            {
              $set: {
                status:
                  "running",

                lastFailureAt:
                  new Date(),

                lastDurationMs:
                  Math.max(
                    0,
                    Math.trunc(
                      durationMs,
                    ),
                  ),

                lastError:
                  errorMessage(
                    error,
                  ),
              },

              $inc: {
                consecutiveFailures:
                  1,
              },
            },
          );
      },
    );
  },

  async getSnapshot(
    now =
      new Date(),
  ) {
    const documents =
      await WorkerHeartbeat
        .find({
          workerName: {
            $in:
              Object.keys(
                MARKETPLACE_WORKERS,
              ),
          },
        })
        .lean();

    const byName =
      new Map(
        documents.map(
          (
            worker,
          ) => [
            worker.workerName,
            worker,
          ],
        ),
      );

    const workers =
      (
        Object.entries(
          MARKETPLACE_WORKERS,
        ) as Array<
          [
            MarketplaceWorkerName,
            {
              intervalMs:
                number;
            },
          ]
        >
      ).map(
        (
          [
            workerName,
            config,
          ],
        ) => {
          const worker =
            byName.get(
              workerName,
            );

          if (!worker) {
            return {
              workerName,

              healthy:
                false,

              reason:
                "heartbeat_missing",

              intervalMs:
                config.intervalMs,

              status:
                "missing",

              lastSuccessAt:
                null,

              consecutiveFailures:
                null,
            };
          }

          const referenceDate =
            worker.lastSuccessAt ??
            worker.lastStartedAt;

          const referenceMs =
            referenceDate
              ? new Date(
                  referenceDate,
                ).getTime()
              : Number.NaN;

          /*
           * ให้เวลาอย่างน้อย 4 cycles
           * ก่อนถือว่า worker heartbeat stale
           */
          const staleAfterMs =
            Math.max(
              config.intervalMs *
                4,
              120_000,
            );

          const stale =
            !Number.isFinite(
              referenceMs,
            ) ||
            now.getTime() -
              referenceMs >
              staleAfterMs;

          const tooManyFailures =
            (
              worker
                .consecutiveFailures ??
              0
            ) >=
            3;

          const stopped =
            worker.status ===
            "stopped";

          let reason:
            string |
            null =
              null;

          if (stopped) {
            reason =
              "worker_stopped";
          } else if (
            tooManyFailures
          ) {
            reason =
              "consecutive_failures";
          } else if (
            stale
          ) {
            reason =
              "heartbeat_stale";
          }

          return {
            workerName,

            healthy:
              reason ===
              null,

            reason,

            intervalMs:
              config.intervalMs,

            status:
              worker.status,

            lastStartedAt:
              worker
                .lastStartedAt ??
              null,

            lastSuccessAt:
              worker
                .lastSuccessAt ??
              null,

            lastFailureAt:
              worker
                .lastFailureAt ??
              null,

            lastDurationMs:
              worker
                .lastDurationMs ??
              null,

            consecutiveFailures:
              worker
                .consecutiveFailures ??
              0,
          };
        },
      );

    return {
      checkedAt:
        now,

      healthy:
        workers.every(
          (
            worker,
          ) =>
            worker.healthy,
        ),

      workers,
    };
  },
};
