import {
  paymentExpirationService,
} from "./paymentExpirationService.js";

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
  "payment_expiration" as const;

const INTERVAL_MS =
  30_000;

export const paymentExpirationWorker = {
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
      "⏱️ Payment expiration worker started",
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
      const count =
        await paymentExpirationService
          .expirePayments();

      await workerHealthService
        .markCycleSuccess(
          WORKER_NAME,

          Date.now() -
            startedAt,

          {
            expiredCount:
              count,
          },
        );

      if (
        count >
        0
      ) {
        console.log(
          `⏱️ Expired ${count} payment(s)`,
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
        "❌ Payment expiration worker failed:",
        error,
      );
    } finally {
      cycleRunning =
        false;
    }
  },
};
