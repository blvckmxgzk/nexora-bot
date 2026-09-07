import {
  reconcileOpenPayouts,
} from "./payoutService.js";

let running =
  false;

let cycleRunning =
  false;

let timer:
  NodeJS.Timeout |
  null =
    null;

export const payoutReconciliationWorker = {
  start(): void {
    if (running) {
      return;
    }

    running =
      true;

    console.log(
      "💸 Payout reconciliation worker started",
    );

    void this.run();

    timer =
      setInterval(
        () => {
          void this.run();
        },
        60_000,
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

  async run(): Promise<void> {
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
        await reconcileOpenPayouts(
          50,
        );

      if (
        result.checked >
        0
      ) {
        console.log(
          `💸 Payout reconciliation: checked=${result.checked} reconciled=${result.reconciled} pending=${result.failed}`,
        );
      }
    } catch (error) {
      console.error(
        "❌ Payout reconciliation worker failed:",
        error,
      );
    } finally {
      cycleRunning =
        false;
    }
  },
};
