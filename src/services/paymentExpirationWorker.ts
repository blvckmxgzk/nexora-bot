import {
  paymentExpirationService,
} from "./paymentExpirationService.js";

let running =
  false;

let cycleRunning =
  false;

let timer:
  NodeJS.Timeout |
  null =
    null;

export const paymentExpirationWorker = {
  start(): void {
    if (running) {
      return;
    }

    running =
      true;

    console.log(
      "⏱️ Payment expiration worker started",
    );

    void this.run();

    timer =
      setInterval(
        () => {
          void this.run();
        },
        30_000,
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
      const count =
        await paymentExpirationService
          .expirePayments();

      if (count > 0) {
        console.log(
          `⏱️ Expired ${count} payment(s)`,
        );
      }
    } catch (error) {
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
