import {
  reconcileDisputes,
} from "./disputeReconciliationService.js";

import {
  workerHealthService,
} from "./marketplace/workerHealthService.js";

let running =
  false;

let cycleRunning =
  false;

let timer:
  NodeJS.Timeout |
  null =
    null;

const WORKER_NAME =
  "dispute_reconciliation" as const;

const INTERVAL_MS =
  60_000;

export const disputeReconciliationWorker = {
  start(): void {
    if (running) {
      return;
    }

    running =
      true;

    void workerHealthService
      .markStarted(
        WORKER_NAME,
        INTERVAL_MS,
      );

    console.log(
      "🛡️ Dispute reconciliation worker started",
    );

    void this.run();

    timer =
      setInterval(
        () => {
          void this.run();
        },

        INTERVAL_MS,
      );
  },

  stop(): void {
    running =
      false;

    void workerHealthService
      .markStopped(
        WORKER_NAME,
      );

    if (timer) {
      clearInterval(
        timer,
      );

      timer =
        null;
    }
  },

  async run():
    Promise<void> {
    if (
      !running ||
      cycleRunning
    ) {
      return;
    }

    cycleRunning =
      true;

    const startedAt =
      Date.now();

    await workerHealthService
      .markCycleStarted(
        WORKER_NAME,
      );

    try {
      const result =
        await reconcileDisputes(
          200,
        );

      await workerHealthService
        .markCycleSuccess(
          WORKER_NAME,

          Date.now() -
            startedAt,

          {
            checked:
              result.checked,

            reconciled:
              result.reconciled,

            discovered:
              result.discovered,

            ignored:
              result.ignored,

            failed:
              result.failed,
          },
        );

      if (
        result.checked >
          0 ||
        result.failed >
          0
      ) {
        console.log(
          [
            "🛡️ Dispute reconciliation:",
            `checked=${result.checked}`,
            `reconciled=${result.reconciled}`,
            `discovered=${result.discovered}`,
            `ignored=${result.ignored}`,
            `failed=${result.failed}`,
          ].join(
            " ",
          ),
        );
      }

      if (
        result.errors.length >
        0
      ) {
        console.error(
          "⚠️ Dispute reconciliation errors:",
          result.errors,
        );
      }
    } catch (error) {
      await workerHealthService
        .markCycleFailure(
          WORKER_NAME,

          Date.now() -
            startedAt,

          error,
        );

      console.error(
        "❌ Dispute reconciliation worker failed:",
        error,
      );
    } finally {
      cycleRunning =
        false;
    }
  },
};
