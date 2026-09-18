import {
  Events,
  type Client,
} from "discord.js";

import {
  matchmakingService,
} from "./matchmakingService.js";

const INTERVAL_MS =
  5 *
  1000;

class MatchmakingRuntime {
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
      "🫂 Matchmaking runtime started",
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
      "🫂 Matchmaking runtime stopped",
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
        await matchmakingService
          .recoverStuckQueues();

      const paired =
        await matchmakingService
          .processQueues(
            client,
          );

      if (
        recovered >
          0 ||
        paired >
          0
      ) {
        console.log(
          `🫂 Matchmaking tick • recovered=${recovered} paired=${paired}`,
        );
      }
    } catch (error) {
      console.error(
        "❌ Matchmaking runtime failed:",
        error,
      );
    } finally {
      this.running =
        false;
    }
  }
}

export const matchmakingRuntime =
  new MatchmakingRuntime();
