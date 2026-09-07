import {
  minerService,
} from "./minerService.js";

import {
  minerLootService,
} from "./minerLootService.js";

import {
  minerRareDropNotificationService,
} from "./minerRareDropNotificationService.js";


import {
  minerTradeService,
} from "./minerTradeService.js";

const INTERVAL_MS =
  60_000;

let running =
  false;

let cycleRunning =
  false;

let timer:
  NodeJS.Timeout |
  null =
    null;

export const minerSettlementWorker = {
  start(): void {
    if (
      running
    ) {
      return;
    }

    running =
      true;

    console.log(
      "⛏️ NEXO Miner worker started",
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

    if (
      timer
    ) {
      clearInterval(
        timer,
      );

      timer =
        null;
    }

    console.log(
      "⛏️ NEXO Miner worker stopped",
    );
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
      const settlement =
        await minerService
          .settleDueProfiles(
            100,
          );

      const loot =
        await minerLootService
          .processPendingProfiles(
            100,
          );

      const notifications =
        await minerRareDropNotificationService
          .notifyPending(
            25,
          );


      const trades =
        await minerTradeService
          .expireDueTrades(
            100,
          );

      if (
        settlement.failed >
          0 ||
        loot.failed >
          0 ||
        notifications.failed >
          0
      ) {
        console.warn(
          [
            "⚠️ NEXO Miner worker partial failure",
            `settlement=${settlement.processed}/${settlement.checked} failed=${settlement.failed}`,
            `loot=${loot.processed}/${loot.checked} failed=${loot.failed}`,
            `notifications=${notifications.sent}/${notifications.checked} failed=${notifications.failed}`,
          ].join(
            " | ",
          ),
        );
      }
    } catch (
      error
    ) {
      console.error(
        "❌ NEXO Miner worker cycle failed:",
        error,
      );
    } finally {
      cycleRunning =
        false;
    }
  },
};
