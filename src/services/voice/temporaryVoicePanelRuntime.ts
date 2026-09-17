import {
  Events,
  type Client,
} from "discord.js";

import {
  temporaryVoicePanelService,
} from "./temporaryVoicePanelService.js";

class TemporaryVoicePanelRuntime {
  private client:
    Client |
    null =
      null;

  private readonly recoveryTimers =
    new Map<
      string,
      NodeJS.Timeout
    >();

  public start(
    client: Client,
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

    client.on(
      Events.ChannelDelete,
      this.onChannelDelete,
    );

    client.on(
      Events.MessageDelete,
      this.onMessageDelete,
    );

    console.log(
      "🎛️ Temporary Voice permanent panel runtime started",
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

    this.client.off(
      Events.ChannelDelete,
      this.onChannelDelete,
    );

    this.client.off(
      Events.MessageDelete,
      this.onMessageDelete,
    );

    for (
      const timer of
        this.recoveryTimers.values()
    ) {
      clearTimeout(
        timer,
      );
    }

    this.recoveryTimers.clear();

    this.client =
      null;

    console.log(
      "🎛️ Temporary Voice permanent panel runtime stopped",
    );
  }

  private readonly onReady =
    async (
      client: Client<true>,
    ): Promise<void> => {
      for (
        const guild of
          client.guilds.cache
            .values()
      ) {
        try {
          const result =
            await temporaryVoicePanelService
              .ensurePanel(
                guild,
              );

          console.log(
            [
              "🎛️ Temporary Voice panel ready:",
              guild.name,
              `panel=${result.panelChannel.id}`,
              `message=${result.panelMessage.id}`,
            ].join(
              " ",
            ),
          );
        } catch (
          error
        ) {
          console.error(
            `❌ Temporary Voice panel setup failed for ${guild.id}:`,
            error,
          );
        }
      }
    };

  private readonly onChannelDelete =
    async (
      channel: any,
    ): Promise<void> => {
      if (
        !channel?.guild?.id ||
        !channel?.id
      ) {
        return;
      }

      try {
        const relevant =
          await temporaryVoicePanelService
            .handleDeletedChannel(
              channel.guild.id,
              channel.id,
            );

        if (relevant) {
          this.scheduleRecovery(
            channel.guild.id,
          );
        }
      } catch (
        error
      ) {
        console.error(
          "❌ Temporary Voice panel channel recovery failed:",
          error,
        );
      }
    };

  private readonly onMessageDelete =
    async (
      message: any,
    ): Promise<void> => {
      const guildId =
        message?.guild?.id;

      const messageId =
        message?.id;

      if (
        !guildId ||
        !messageId
      ) {
        return;
      }

      try {
        const relevant =
          await temporaryVoicePanelService
            .handleDeletedMessage(
              guildId,
              messageId,
            );

        if (relevant) {
          this.scheduleRecovery(
            guildId,
          );
        }
      } catch (
        error
      ) {
        console.error(
          "❌ Temporary Voice panel message recovery failed:",
          error,
        );
      }
    };

  private scheduleRecovery(
    guildId: string,
  ): void {
    const previous =
      this.recoveryTimers.get(
        guildId,
      );

    if (previous) {
      clearTimeout(
        previous,
      );
    }

    const timer =
      setTimeout(
        () => {
          this.recoveryTimers.delete(
            guildId,
          );

          void this.recover(
            guildId,
          );
        },
        1_500,
      );

    timer.unref?.();

    this.recoveryTimers.set(
      guildId,
      timer,
    );
  }

  private async recover(
    guildId: string,
  ): Promise<void> {
    const guild =
      this.client
        ?.guilds
        .cache
        .get(
          guildId,
        );

    if (!guild) {
      return;
    }

    try {
      await temporaryVoicePanelService
        .ensurePanel(
          guild,
        );

      console.log(
        `♻️ Temporary Voice permanent panel recovered for ${guild.name}`,
      );
    } catch (
      error
    ) {
      console.error(
        `❌ Temporary Voice panel recovery failed for ${guildId}:`,
        error,
      );
    }
  }
}

export const temporaryVoicePanelRuntime =
  new TemporaryVoicePanelRuntime();
