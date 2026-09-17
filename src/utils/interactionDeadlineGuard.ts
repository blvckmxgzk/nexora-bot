import {
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";

type AnyFunction =
  (...args: any[]) =>
    Promise<any>;

function toEditOptions(
  options: any,
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
   * editReply cannot change ephemeral state.
   * If the guard auto-deferred, the message
   * is already ephemeral.
   */
  delete clean.ephemeral;
  delete clean.flags;
  delete clean.fetchReply;
  delete clean.withResponse;

  return clean;
}

export function isUnknownInteractionError(
  error: unknown,
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
      10062 ||
    candidate.rawError
      ?.code ===
      10062 ||
    String(
      candidate.message ??
      "",
    ).includes(
      "Unknown interaction",
    )
  );
}

/*
 * Discord requires the initial interaction
 * acknowledgement within roughly 3 seconds.
 *
 * Existing NEXORA commands can perform MongoDB,
 * AutoMod or other async work before reply().
 *
 * This guard waits 1.8s. If the command has not
 * replied/deferred by then, NEXORA automatically
 * defers ephemerally and transparently converts
 * a later reply() into editReply().
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

  let automaticAck:
    Promise<any> |
    null =
      null;

  let disposed =
    false;

  const beginAutomaticAck =
    (): Promise<any> => {
      if (
        disposed ||
        interaction.replied ||
        interaction.deferred
      ) {
        return Promise.resolve(
          undefined,
        );
      }

      if (
        automaticAck
      ) {
        return automaticAck;
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

      automaticAck =
        originalDeferReply({
          flags:
            MessageFlags
              .Ephemeral,
        })
          .catch(
            (error:
              unknown) => {
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
            },
          )
          .finally(
            () => {
              automaticAck =
                null;
            },
          );

      return automaticAck;
    };

  mutable.reply =
    async (
      options: any,
    ): Promise<any> => {
      if (
        automaticAck
      ) {
        try {
          await automaticAck;
        } catch {
          // Fall through.
        }
      }

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

      return originalReply(
        options,
      );
    };

  mutable.deferReply =
    async (
      options: any = {},
    ): Promise<any> => {
      if (
        automaticAck
      ) {
        return automaticAck;
      }

      if (
        interaction.deferred ||
        interaction.replied
      ) {
        return undefined;
      }

      return originalDeferReply(
        options,
      );
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
