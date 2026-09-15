import {
  Events,
  type Client,
  type GuildMember,
  type Message,
  type PartialGuildMember,
} from "discord.js";

import {
  memberLifecycleService,
} from "./memberLifecycleService.js";

const ACTIVITY_ROLE_CHECK_COOLDOWN_MS =
  60_000;

const RECONCILE_INTERVAL_MS =
  10 * 60 * 1000;

const CLEANUP_INTERVAL_MS =
  6 * 60 * 60 * 1000;

class MemberLifecycleRuntime {
  private started =
    false;

  private reconcileTimer:
    NodeJS.Timeout | null =
    null;

  private cleanupTimer:
    NodeJS.Timeout | null =
    null;

  private readonly nextActivityCheck =
    new Map<
      string,
      number
    >();

  private readonly memberLocks =
    new Map<
      string,
      Promise<void>
    >();

  private memberKey(
    member: GuildMember,
  ): string {
    return `${member.guild.id}:${member.id}`;
  }

  private enqueueMember(
    member: GuildMember,
  ): Promise<void> {
    const key =
      this.memberKey(
        member,
      );

    const previous =
      this.memberLocks.get(
        key,
      ) ??
      Promise.resolve();

    let next:
      Promise<void>;

    next =
      previous
        .catch(
          () => undefined,
        )
        .then(
          async () => {
            await memberLifecycleService.reconcileMember(
              member,
            );
          },
        )
        .catch(
          (error) => {
            console.error(
              `❌ Member Lifecycle reconcile failed for ${key}:`,
              error,
            );
          },
        )
        .finally(
          () => {
            if (
              this.memberLocks.get(
                key,
              ) === next
            ) {
              this.memberLocks.delete(
                key,
              );
            }
          },
        );

    this.memberLocks.set(
      key,
      next,
    );

    return next;
  }

  private readonly onGuildMemberAdd =
    (
      member: GuildMember,
    ): void => {
      void memberLifecycleService
        .handleJoin(
          member,
        )
        .catch(
          (error) => {
            console.error(
              `❌ Member Lifecycle join failed for ${member.id}:`,
              error,
            );
          },
        );
    };

  private readonly onGuildMemberRemove =
    (
      member: GuildMember | PartialGuildMember,
    ): void => {
      void memberLifecycleService
        .handleLeave(
          member.guild.id,
          member.id,
        )
        .catch(
          (error) => {
            console.error(
              `❌ Member Lifecycle leave failed for ${member.id}:`,
              error,
            );
          },
        );
    };

  private readonly onGuildMemberUpdate =
    (
      _oldMember: GuildMember | PartialGuildMember,
      newMember: GuildMember,
    ): void => {
      /*
       * Entry Security เพิ่ม Verified
       * และถอด Quarantine ผ่าน role update
       * event นี้จึงเป็นสะพาน
       * Security -> Member Lifecycle
       */
      void this.enqueueMember(
        newMember,
      );
    };

  private readonly onMessageCreate =
    (
      message: Message,
    ): void => {
      const guild =
        message.guild;

      if (
        message.author.bot ||
        !guild
      ) {
        return;
      }

      void (
        async () => {
          try {
            /*
             * ใช้เกณฑ์เดียวกับ Leveling ปัจจุบัน:
             * guild message จาก user ที่ไม่ใช่ bot = 1 message
             */
            await memberLifecycleService.recordMessage(
              guild.id,
              message.author.id,
              message.createdAt,
            );

            const key =
              `${guild.id}:${message.author.id}`;

            const now =
              Date.now();

            const nextAllowed =
              this.nextActivityCheck.get(
                key,
              ) ??
              0;

            if (
              now <
              nextAllowed
            ) {
              return;
            }

            this.nextActivityCheck.set(
              key,
              now +
                ACTIVITY_ROLE_CHECK_COOLDOWN_MS,
            );

            const member =
              message.member ??
              (await guild.members
                .fetch(
                  message.author.id,
                )
                .catch(
                  () => null,
                ));

            if (!member) {
              return;
            }

            await this.enqueueMember(
              member,
            );
          } catch (error) {
            console.error(
              `❌ Member Lifecycle activity failed for ${message.author.id}:`,
              error,
            );
          }
        }
      )();
    };

  private async reconcileAll(
    client: Client,
  ): Promise<void> {
    for (
      const guild of client.guilds.cache.values()
    ) {
      try {
        await memberLifecycleService.reconcileDueMembers(
          guild,
        );
      } catch (error) {
        console.error(
          `❌ Member Lifecycle scheduled reconcile failed for ${guild.id}:`,
          error,
        );
      }
    }
  }

  private async bootstrap(
    client: Client,
  ): Promise<void> {
    for (
      const guild of client.guilds.cache.values()
    ) {
      try {
        await memberLifecycleService.reconcileGuildStartup(
          guild,
        );
      } catch (error) {
        console.error(
          `❌ Member Lifecycle startup failed for ${guild.id}:`,
          error,
        );
      }
    }

    await this.reconcileAll(
      client,
    );

    await memberLifecycleService
      .cleanupOldActivity()
      .catch(
        (error) => {
          console.error(
            "❌ Member Lifecycle initial cleanup failed:",
            error,
          );
        },
      );

    this.reconcileTimer =
      setInterval(
        () => {
          void this.reconcileAll(
            client,
          );
        },
        RECONCILE_INTERVAL_MS,
      );

    this.reconcileTimer.unref();

    this.cleanupTimer =
      setInterval(
        () => {
          void memberLifecycleService
            .cleanupOldActivity()
            .catch(
              (error) => {
                console.error(
                  "❌ Member Lifecycle cleanup failed:",
                  error,
                );
              },
            );
        },
        CLEANUP_INTERVAL_MS,
      );

    this.cleanupTimer.unref();

    console.log(
      "🧬 NEXORA Member Lifecycle runtime started",
    );
  }

  public start(
    client: Client,
  ): void {
    if (this.started) {
      return;
    }

    this.started =
      true;

    client.on(
      Events.GuildMemberAdd,
      this.onGuildMemberAdd,
    );

    client.on(
      Events.GuildMemberRemove,
      this.onGuildMemberRemove,
    );

    client.on(
      Events.GuildMemberUpdate,
      this.onGuildMemberUpdate,
    );

    client.on(
      Events.MessageCreate,
      this.onMessageCreate,
    );

    client.once(
      Events.ClientReady,
      () => {
        void this.bootstrap(
          client,
        );
      },
    );
  }

  public stop(): void {
    if (
      this.reconcileTimer
    ) {
      clearInterval(
        this.reconcileTimer,
      );

      this.reconcileTimer =
        null;
    }

    if (
      this.cleanupTimer
    ) {
      clearInterval(
        this.cleanupTimer,
      );

      this.cleanupTimer =
        null;
    }

    this.nextActivityCheck.clear();
    this.memberLocks.clear();

    this.started =
      false;
  }
}

export const memberLifecycleRuntime =
  new MemberLifecycleRuntime();
