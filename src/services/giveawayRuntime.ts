import {
  Events,
  type Client,
} from "discord.js";

import {
  giveawayService,
} from "./giveawayService.js";

const INTERVAL_MS =
  30 *
  1000;

class GiveawayRuntime {
  private client:
    Client |
    null =
      null;

  private timer:
    NodeJS.Timeout |
    null =
      null;

  private running =
    false;

  public start(
    client:
      Client,
  ): void {
    if (
      this.client
    ) {
      return;
    }

    this.client =
      client;

    client.on(
      Events.ClientReady,
      this.onReady,
    );

    console.log(
      "🎉 Giveaway runtime started",
    );
  }

  public stop():
    void {
    if (
      !this.client
    ) {
      return;
    }

    this.client.off(
      Events.ClientReady,
      this.onReady,
    );

    if (
      this.timer
    ) {
      clearInterval(
        this.timer,
      );

      this.timer =
        null;
    }

    this.client =
      null;

    console.log(
      "🎉 Giveaway runtime stopped",
    );
  }

  private readonly onReady =
    async (
      client:
        Client<true>,
    ): Promise<void> => {
      await this.tick(
        client,
      );

      this.timer =
        setInterval(
          () => {
            void this.tick(
              client,
            );
          },
          INTERVAL_MS,
        );

      this.timer.unref?.();
  };

  private async tick(
    client:
      Client,
  ): Promise<void> {
    if (
      this.running
    ) {
      return;
    }

    this.running =
      true;

    try {
      const recovered =
        await giveawayService
          .recoverStuckProcessing();

      const ended =
        await giveawayService
          .processDueGiveaways(
            client,
          );

      const reconciled =
        await giveawayService
          .reconcileEndedGiveaways(
            client,
          );

      if (
        recovered >
          0 ||
        ended >
          0 ||
        reconciled >
          0
      ) {
        console.log(
          `🎉 Giveaway tick • recovered=${recovered} ended=${ended} reconciled=${reconciled}`,
        );
      }
    } catch (error) {
      console.error(
        "❌ Giveaway runtime tick failed:",
        error,
      );
    } finally {
      this.running =
        false;
    }
  }
}

export const giveawayRuntime =
  new GiveawayRuntime();
