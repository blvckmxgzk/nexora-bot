import {
  Events,
  type Client,
  type VoiceState,
} from "discord.js";

import {
  temporaryVoiceService,
} from "./temporaryVoiceService.js";

class TemporaryVoiceRuntime {
  private client:
    Client |
    null =
      null;

  private readonly ownerTimers =
    new Map<
      string,
      NodeJS.Timeout
    >();

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

    client.on(
      Events.VoiceStateUpdate,
      this.onVoiceStateUpdate,
    );

    client.on(
      Events.ChannelDelete,
      this.onChannelDelete,
    );

    console.log(
      "🔊 Temporary Voice runtime started",
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

    this.client.off(
      Events.VoiceStateUpdate,
      this.onVoiceStateUpdate,
    );

    this.client.off(
      Events.ChannelDelete,
      this.onChannelDelete,
    );

    for (
      const timer of
        this.ownerTimers
          .values()
    ) {
      clearTimeout(
        timer,
      );
    }

    this.ownerTimers.clear();

    this.client =
      null;

    console.log(
      "🔊 Temporary Voice runtime stopped",
    );
  }

  private readonly onReady =
    async (
      client:
        Client<true>,
    ): Promise<void> => {
      for (
        const guild of
          client.guilds
            .cache
            .values()
      ) {
        try {
          const setup =
            await temporaryVoiceService
              .ensureSetup(
                guild,
              );

          const result =
            await temporaryVoiceService
              .reconcileGuild(
                guild,
              );

          console.log(
            [
              `🔊 Temporary Voice ready: ${guild.name}`,
              `hub=${setup.hub.id}`,
              `synced=${result.synced}`,
              `deleted=${result.deleted}`,
            ].join(
              " ",
            ),
          );

          const rooms =
            await temporaryVoiceService
              .listRooms(
                guild.id,
              );

          for (
            const room of
              rooms
          ) {
            const channel =
              guild.channels
                .cache
                .get(
                  room.channelId,
                );

            if (
              !channel ||
              !channel.isVoiceBased()
            ) {
              continue;
            }

            if (
              !channel.members.has(
                String(
                  room.ownerId,
                ),
              ) &&
              channel.members.size >
                0
            ) {
              const config =
                await temporaryVoiceService
                  .getConfig(
                    guild.id,
                  );

              this.scheduleOwnerTransfer(
                guild.id,
                room.channelId,
                config
                  ?.ownerGraceSeconds ??
                  60,
              );
            }
          }
        } catch (
          error
        ) {
          console.error(
            `❌ Temporary Voice startup failed for ${guild.id}:`,
            error,
          );
        }
      }
    };

  private readonly onVoiceStateUpdate =
    async (
      oldState:
        VoiceState,

      newState:
        VoiceState,
    ): Promise<void> => {
      try {
        const guild =
          newState.guild;

        const member =
          newState.member ??
          oldState.member;

        if (
          !member ||
          member.user.bot
        ) {
          return;
        }

        const config =
          await temporaryVoiceService
            .getConfig(
              guild.id,
            );

        if (
          config
            ?.enabled &&
          config
            .hubChannelId &&
          newState.channelId ===
            config.hubChannelId
        ) {
          await temporaryVoiceService
            .createOrMoveRoom(
              member,
            );

          return;
        }

        if (
          newState.channelId
        ) {
          const newRoom =
            await temporaryVoiceService
              .findRoomByChannel(
                guild.id,
                newState.channelId,
              );

          if (newRoom) {
            if (
              (
                newRoom
                  .bannedUserIds ??
                []
              )
                .map(
                  String,
                )
                .includes(
                  member.id,
                )
            ) {
              await member.voice
                .setChannel(
                  null,
                  "NEXORA Temporary Voice ban enforcement",
                )
                .catch(
                  () =>
                    undefined,
                );

              return;
            }

            if (
              String(
                newRoom.ownerId,
              ) ===
              member.id
            ) {
              this.cancelOwnerTransfer(
                newRoom.channelId,
              );
            }
          }
        }

        if (
          !oldState.channelId ||
          oldState.channelId ===
            newState.channelId
        ) {
          return;
        }

        const oldRoom =
          await temporaryVoiceService
            .findRoomByChannel(
              guild.id,
              oldState.channelId,
            );

        if (!oldRoom) {
          return;
        }

        const channel =
          guild.channels
            .cache
            .get(
              oldRoom.channelId,
            );

        if (
          !channel ||
          !channel.isVoiceBased()
        ) {
          await temporaryVoiceService
            .deleteRoomByChannel(
              guild,
              oldRoom.channelId,
              "NEXORA stale Temporary Voice record",
            );

          this.cancelOwnerTransfer(
            oldRoom.channelId,
          );

          return;
        }

        if (
          channel.members.size ===
          0
        ) {
          this.cancelOwnerTransfer(
            oldRoom.channelId,
          );

          await temporaryVoiceService
            .deleteRoomByChannel(
              guild,
              oldRoom.channelId,
              "NEXORA Temporary Voice empty",
            );

          return;
        }

        if (
          String(
            oldRoom.ownerId,
          ) ===
          member.id
        ) {
          this.scheduleOwnerTransfer(
            guild.id,
            oldRoom.channelId,
            config
              ?.ownerGraceSeconds ??
              60,
          );
        }
      } catch (
        error
      ) {
        console.error(
          "❌ Temporary Voice voiceStateUpdate failed:",
          error,
        );
      }
    };

  private readonly onChannelDelete =
    async (
      channel:
        any,
    ): Promise<void> => {
      if (
        !channel?.guild ||
        !channel?.id
      ) {
        return;
      }

      try {
        this.cancelOwnerTransfer(
          String(
            channel.id,
          ),
        );

        await temporaryVoiceService
          .deleteRoomByChannel(
            channel.guild,
            String(
              channel.id,
            ),
            "NEXORA channelDelete cleanup",
          );

        const infrastructureDeleted =
          await temporaryVoiceService
            .clearDeletedInfrastructure(
              channel.guild,
              String(
                channel.id,
              ),
            );

        if (
          infrastructureDeleted
        ) {
          const timer =
            setTimeout(
              () => {
                void temporaryVoiceService
                  .ensureSetup(
                    channel.guild,
                  )
                  .then(
                    () =>
                      temporaryVoiceService
                        .reconcileGuild(
                          channel.guild,
                        ),
                  )
                  .catch(
                    (
                      error:
                        unknown,
                    ) => {
                      console.error(
                        "❌ Temporary Voice infrastructure recovery failed:",
                        error,
                      );
                    },
                  );
              },
              1_500,
            );

          timer.unref?.();
        }
      } catch (
        error
      ) {
        console.error(
          "❌ Temporary Voice channelDelete failed:",
          error,
        );
      }
    };

  private scheduleOwnerTransfer(
    guildId:
      string,

    channelId:
      string,

    seconds:
      number,
  ): void {
    this.cancelOwnerTransfer(
      channelId,
    );

    const timer =
      setTimeout(
        () => {
          void this.handleOwnerTimeout(
            guildId,
            channelId,
          );
        },
        Math.max(
          15,
          seconds,
        ) *
          1_000,
      );

    timer.unref?.();

    this.ownerTimers.set(
      channelId,
      timer,
    );
  }

  private cancelOwnerTransfer(
    channelId:
      string,
  ): void {
    const timer =
      this.ownerTimers.get(
        channelId,
      );

    if (timer) {
      clearTimeout(
        timer,
      );

      this.ownerTimers.delete(
        channelId,
      );
    }
  }

  private async handleOwnerTimeout(
    guildId:
      string,

    channelId:
      string,
  ): Promise<void> {
    this.ownerTimers.delete(
      channelId,
    );

    const client =
      this.client;

    if (!client) {
      return;
    }

    const guild =
      client.guilds.cache.get(
        guildId,
      );

    if (!guild) {
      return;
    }

    const room =
      await temporaryVoiceService
        .findRoomByChannel(
          guildId,
          channelId,
        );

    if (!room) {
      return;
    }

    const channel =
      guild.channels.cache.get(
        channelId,
      );

    if (
      !channel ||
      !channel.isVoiceBased()
    ) {
      await temporaryVoiceService
        .deleteRoomByChannel(
          guild,
          channelId,
          "NEXORA owner-timeout stale cleanup",
        );

      return;
    }

    if (
      channel.members.size ===
      0
    ) {
      await temporaryVoiceService
        .deleteRoomByChannel(
          guild,
          channelId,
          "NEXORA Temporary Voice empty after owner grace",
        );

      return;
    }

    if (
      channel.members.has(
        String(
          room.ownerId,
        ),
      )
    ) {
      return;
    }

    const candidates =
      [
        ...channel.members
          .values(),
      ].filter(
        (
          member,
        ) =>
          !member.user.bot,
      );

    for (
      const candidate of
        candidates
    ) {
      try {
        const result =
          await temporaryVoiceService
            .transferOwnershipSystem(
              guild,
              channelId,
              candidate.id,
            );

        if (result) {
          console.log(
            `👑 Temporary Voice ownership transferred: ${channelId} -> ${candidate.id}`,
          );

          return;
        }
      } catch {
        /*
         * Candidate may already own another room.
         * Try the next member.
         */
      }
    }

    /*
     * No eligible member could own it.
     * Keep the room alive while occupied and
     * retry later instead of deleting members.
     */
    this.scheduleOwnerTransfer(
      guildId,
      channelId,
      60,
    );
  }
}

export const temporaryVoiceRuntime =
  new TemporaryVoiceRuntime();
