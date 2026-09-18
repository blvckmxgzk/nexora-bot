import {
  ActivityType,
  Events,
  type Client,
} from "discord.js";

export const NEXORA_STATUS_TEXT =
  "กำลังให้บริการ NEXORA";

class BotPresenceRuntime {
  private client:
    Client |
    null =
      null;

  public start(
    client:
      Client,
  ): void {
    if (this.client) {
      return;
    }

    this.client =
      client;

    client.on(
      Events.ClientReady,
      this.onReady,
    );

    console.log(
      "🟢 Bot Presence runtime started",
    );
  }

  public stop():
    void {
    if (!this.client) {
      return;
    }

    this.client.off(
      Events.ClientReady,
      this.onReady,
    );

    this.client =
      null;

    console.log(
      "🟢 Bot Presence runtime stopped",
    );
  }

  private readonly onReady =
    (
      client:
        Client<true>,
    ): void => {
      client.user.setPresence({
        status:
          "online",

        activities: [
          {
            name:
              "NEXORA",

            type:
              ActivityType.Custom,

            state:
              NEXORA_STATUS_TEXT,
          },
        ],
      });

      console.log(
        `🟢 Presence set: ${NEXORA_STATUS_TEXT}`,
      );
    };
}

export const botPresenceRuntime =
  new BotPresenceRuntime();
