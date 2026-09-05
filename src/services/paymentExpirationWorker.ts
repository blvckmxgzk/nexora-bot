import {
  paymentExpirationService,
} from "./paymentExpirationService.js";

let running = false;

export const paymentExpirationWorker = {
  start(): void {
    if (running) {
      return;
    }

    running = true;

    console.log(
      "⏱️ Payment expiration worker started",
    );

    void this.run();

    setInterval(() => {
      void this.run();
    }, 30_000);
  },

  async run(): Promise<void> {
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
    }
  },
};
