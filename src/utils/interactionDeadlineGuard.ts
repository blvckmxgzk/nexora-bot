import {
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";

type AnyFunction =
  (...args: any[]) =>
    Promise<any>;

function toEditOptions(
  options:
    any,
): any {
  if (
    typeof options ===
    "string"
  ) {
    return {
      content:
        options,
    };
  }

  const clean = {
    ...options,
  };

  /*
   * editReply cannot change the ephemeral
   * state established by deferReply().
   */
  delete clean.ephemeral;
  delete clean.flags;
  delete clean.fetchReply;
  delete clean.withResponse;

  return clean;
}

function hasDiscordErrorCode(
  error:
    unknown,

  code:
    number,
): boolean {
  if (
    !error ||
    typeof error !==
      "object"
  ) {
    return false;
  }

  const candidate =
    error as {
      code?:
        unknown;

      message?:
        unknown;

      rawError?: {
        code?:
          unknown;
      };
    };

  return (
    candidate.code ===
      code ||
    candidate.rawError
      ?.code ===
      code
  );
}

export function isUnknownInteractionError(
  error:
    unknown,
): boolean {
  if (
    hasDiscordErrorCode(
      error,
      10062,
    )
  ) {
    return true;
  }

  if (
    !error ||
    typeof error !==
      "object"
  ) {
    return false;
  }

  const candidate =
    error as {
      message?:
        unknown;
    };

  return String(
    candidate.message ??
    "",
  ).includes(
    "Unknown interaction",
  );
}

export function isAlreadyAcknowledgedError(
  error:
    unknown,
): boolean {
  if (
    hasDiscordErrorCode(
      error,
      40060,
    )
  ) {
    return true;
  }

  if (
    !error ||
    typeof error !==
      "object"
  ) {
    return false;
  }

  const candidate =
    error as {
      message?:
        unknown;
    };

  return String(
    candidate.message ??
    "",
  ).includes(
    "Interaction has already been acknowledged",
  );
}

/*
 * Discord requires the first interaction
 * acknowledgement within roughly 3 seconds.
 *
 * The important part here is SINGLE-FLIGHT:
 *
 * reply()
 * deferReply()
 * automatic deferReply()
 *
 * are never allowed to send two initial
 * acknowledgements concurrently.
 *
 * discord.js only flips interaction.replied /
 * interaction.deferred after the REST request
 * completes. Without this lock, a slow reply()
 * can still look "unacknowledged" when the
 * 1.8 second timer fires, causing Discord 40060.
 */
export function installInteractionDeadlineGuard(
  interaction:
    ChatInputCommandInteraction,
): () => void {
  const mutable =
    interaction as any;

  const originalReply =
    interaction.reply
      .bind(
        interaction,
      ) as
        AnyFunction;

  const originalDeferReply =
    interaction.deferReply
      .bind(
        interaction,
      ) as
        AnyFunction;

  const originalEditReply =
    interaction.editReply
      .bind(
        interaction,
      ) as
        AnyFunction;

  const originalFollowUp =
    interaction.followUp
      .bind(
        interaction,
      ) as
        AnyFunction;

  /*
   * Represents ANY initial acknowledgement
   * currently travelling to Discord.
   *
   * This is deliberately separate from
   * interaction.replied/deferred because those
   * flags update only after Discord responds.
   */
  let initialAckInFlight:
    Promise<any> |
    null =
      null;

  let disposed =
    false;

  const runInitialAck =
    async (
      operation:
        () =>
          Promise<any>,
    ): Promise<any> => {
      if (
        initialAckInFlight
      ) {
        return initialAckInFlight;
      }

      let promise:
        Promise<any>;

      try {
        promise =
          Promise.resolve(
            operation(),
          );
      } catch (error) {
        throw error;
      }

      initialAckInFlight =
        promise;

      try {
        return await promise;
      } finally {
        /*
         * Do not clear a newer request if
         * something replaced the reference.
         */
        if (
          initialAckInFlight ===
          promise
        ) {
          initialAckInFlight =
            null;
        }
      }
    };

  const waitForInitialAck =
    async (): Promise<void> => {
      const current =
        initialAckInFlight;

      if (!current) {
        return;
      }

      try {
        await current;
      } catch {
        /*
         * The caller below re-checks Discord.js
         * state and chooses the appropriate path.
         */
      }
    };

  const beginAutomaticAck =
    async (): Promise<any> => {
      if (
        disposed ||
        interaction.replied ||
        interaction.deferred
      ) {
        return undefined;
      }

      /*
       * An explicit reply/defer may already be
       * on the wire even though discord.js has
       * not changed replied/deferred yet.
       *
       * Never race it with another callback.
       */
      if (
        initialAckInFlight
      ) {
        return initialAckInFlight;
      }

      console.warn(
        [
          "⏱️ Auto-defer interaction:",
          `/${interaction.commandName}`,
          `id=${interaction.id}`,
        ].join(
          " ",
        ),
      );

      try {
        return await runInitialAck(
          () =>
            originalDeferReply({
              flags:
                MessageFlags
                  .Ephemeral,
            }),
        );
      } catch (
        error
      ) {
        /*
         * 40060 means another acknowledgement
         * won the race. It is not a command
         * failure and must not create noisy logs.
         */
        if (
          isAlreadyAcknowledgedError(
            error,
          )
        ) {
          return undefined;
        }

        if (
          !isUnknownInteractionError(
            error,
          )
        ) {
          console.error(
            "❌ Automatic interaction defer failed:",
            error,
          );
        }

        throw error;
      }
    };

  mutable.reply =
    async (
      options:
        any,
    ): Promise<any> => {
      /*
       * Auto-defer or another explicit initial
       * acknowledgement may currently be pending.
       */
      await waitForInitialAck();

      if (
        interaction.deferred &&
        !interaction.replied
      ) {
        return originalEditReply(
          toEditOptions(
            options,
          ),
        );
      }

      if (
        interaction.replied
      ) {
        return originalFollowUp(
          options,
        );
      }

      try {
        return await runInitialAck(
          () =>
            originalReply(
              options,
            ),
        );
      } catch (
        error
      ) {
        /*
         * Defensive recovery for an acknowledgement
         * performed elsewhere on the same object.
         */
        if (
          isAlreadyAcknowledgedError(
            error,
          )
        ) {
          await Promise.resolve();

          if (
            interaction.deferred &&
            !interaction.replied
          ) {
            return originalEditReply(
              toEditOptions(
                options,
              ),
            );
          }

          if (
            interaction.replied
          ) {
            return originalFollowUp(
              options,
            );
          }
        }

        throw error;
      }
    };

  mutable.deferReply =
    async (
      options:
        any = {},
    ): Promise<any> => {
      await waitForInitialAck();

      if (
        interaction.deferred ||
        interaction.replied
      ) {
        return undefined;
      }

      try {
        return await runInitialAck(
          () =>
            originalDeferReply(
              options,
            ),
        );
      } catch (
        error
      ) {
        if (
          isAlreadyAcknowledgedError(
            error,
          )
        ) {
          return undefined;
        }

        throw error;
      }
    };

  const timer =
    setTimeout(
      () => {
        void beginAutomaticAck()
          .catch(
            () =>
              undefined,
          );
      },
      1_800,
    );

  timer.unref?.();

  return () => {
    disposed =
      true;

    clearTimeout(
      timer,
    );
  };
}
