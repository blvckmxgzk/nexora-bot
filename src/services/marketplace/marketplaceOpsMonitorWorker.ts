import {
  marketplaceOpsHealthService,
} from "./marketplaceOpsHealthService.js";

let running =
  false;

let cycleRunning =
  false;

let timer:
  NodeJS.Timeout |
  null =
    null;

const INTERVAL_MS =
  60_000;

export const marketplaceOpsMonitorWorker = {
  start(): void {
    if (running) {
      return;
    }

    running =
      true;

    console.log(
      "📡 Marketplace ops monitor started",
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

    try {
      const result =
        await marketplaceOpsHealthService
          .syncAlerts();

      if (
        result
          .activeAlertCount >
        0
      ) {
        console.warn(
          [
            "📡 Marketplace Ops:",
            `active=${result.activeAlertCount}`,
            `critical=${result.criticalAlertCount}`,
            `warning=${result.warningAlertCount}`,
          ].join(
            " ",
          ),
        );
      }
    } catch (error) {
      console.error(
        "❌ Marketplace ops monitor failed:",
        error,
      );
    } finally {
      cycleRunning =
        false;
    }
  },
};
