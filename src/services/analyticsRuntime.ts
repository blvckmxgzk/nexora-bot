import {
  Events,
  type Client,
} from "discord.js";

import {
  analyticsService,
} from "./analyticsService.js";

const INTERVAL_MS =
  60 *
  60 *
  1000;

class AnalyticsRuntime {
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
      "📊 Analytics runtime started",
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
      "📊 Analytics runtime stopped",
    );
  }

  private readonly onReady =
    async (
      client:
        Client<true>,
    ): Promise<void> => {
      await this.capture(
        client,
      );

      this.timer =
        setInterval(
          () => {
            void this.capture(
              client,
            );
          },
          INTERVAL_MS,
        );

      this.timer.unref?.();
    };

  private async capture(
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
      for (
        const guild of
          client.guilds
            .cache.values()
      ) {
        try {
          await analyticsService
            .captureSnapshot(
              guild,
            );

          console.log(
            `📊 Analytics snapshot updated • ${guild.id}`,
          );
        } catch (error) {
          console.error(
            `❌ Analytics snapshot failed • ${guild.id}:`,
            error,
          );
        }
      }
    } finally {
      this.running =
        false;
    }
  }
}

export const analyticsRuntime =
  new AnalyticsRuntime();
