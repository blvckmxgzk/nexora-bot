import {
  notificationDeliveryService,
} from "./notificationDeliveryService.js";

import {
  workerHealthService,
} from "./workerHealthService.js";

let running =
  false;

let cycleRunning =
  false;

let timer:
  NodeJS.Timeout |
  null =
    null;

const WORKER_NAME =
  "notification_delivery" as const;

const INTERVAL_MS =
  30_000;

export const notificationDeliveryWorker = {
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
      "📨 Notification delivery worker started",
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
        await notificationDeliveryService
          .processDue(
            25,
          );

      await workerHealthService
        .markCycleSuccess(
          WORKER_NAME,

          Date.now() -
            startedAt,

          result,
        );

      if (
        result.checked >
        0
      ) {
        console.log(
          `📨 Notification retry: checked=${result.checked} sent=${result.sent} retrying=${result.retried} dead=${result.deadLetter}`,
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
        "❌ Notification delivery worker failed:",
        error,
      );
    } finally {
      cycleRunning =
        false;
    }
  },
};
