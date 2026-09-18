import {
  Events,
  type Client,
} from "discord.js";

import {
  SystemState,
} from "../../models/SystemState.js";

import {
  marketplaceV2Service,
} from "./marketplaceV2Service.js";

const INTERVAL_MS =
  10 *
  60 *
  1000;

class MarketplaceV2Runtime {
  private client:
    Client |
    null =
      null;

  private timer:
    NodeJS.Timeout |
    null =
      null;

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
      "🛒 Marketplace v2 runtime started",
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
      "🛒 Marketplace v2 runtime stopped",
    );
  }

  private readonly onReady =
    async (
      client:
        Client<true>,
    ): Promise<void> => {
      try {
        const forceMaintenance =
          process.env
            .MARKETPLACE_MAINTENANCE ===
          "true";

        const state =
          await SystemState
            .findOneAndUpdate(
              {
                _id:
                  "global",
              },

              {
                $setOnInsert: {
                  marketplaceMaintenance:
                    forceMaintenance,
                },
              },

              {
                upsert:
                  true,

                new:
                  true,

                setDefaultsOnInsert:
                  true,
              },
            );

        if (
          !forceMaintenance &&
          !state.marketplaceV2InitializedAt
        ) {
          await SystemState
            .updateOne(
              {
                _id:
                  "global",

                marketplaceV2InitializedAt:
                  null,
              },

              {
                $set: {
                  marketplaceMaintenance:
                    false,

                  marketplaceMaintenanceReason:
                    "NEXORA Marketplace v2 เปิดให้บริการแล้ว",

                  marketplaceMaintenanceUpdatedAt:
                    new Date(),

                  marketplaceV2InitializedAt:
                    new Date(),
                },
              },
            );
        }

        const expired =
          await marketplaceV2Service
            .expireRequests(
              client,
            );

        console.log(
          `🛒 Marketplace v2 ready • expired=${expired}`,
        );

        this.timer =
          setInterval(
            () => {
              void marketplaceV2Service
                .expireRequests(
                  client,
                )
                .catch(
                  (
                    error:
                      unknown,
                  ) => {
                    console.error(
                      "❌ Trade expiration worker failed:",
                      error,
                    );
                  },
                );
            },
            INTERVAL_MS,
          );

        this.timer.unref?.();
      } catch (
        error
      ) {
        console.error(
          "❌ Marketplace v2 startup failed:",
          error,
        );
      }
    };
}

export const marketplaceV2Runtime =
  new MarketplaceV2Runtime();
