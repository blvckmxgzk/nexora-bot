import {
  installInteractionDeadlineGuard,
  isAlreadyAcknowledgedError,
} from "../dist/utils/interactionDeadlineGuard.js";

const sleep =
  (
    milliseconds,
  ) =>
    new Promise(
      (
        resolve,
      ) =>
        setTimeout(
          resolve,
          milliseconds,
        ),
    );

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(
      message,
    );
  }
}

function makeInteraction({
  replyDelay =
    0,

  deferDelay =
    0,
} = {}) {
  const counters = {
    reply:
      0,

    defer:
      0,

    edit:
      0,

    followUp:
      0,
  };

  const interaction = {
    commandName:
      "ack-race-test",

    id:
      `test-${Date.now()}-${Math.random()}`,

    replied:
      false,

    deferred:
      false,

    async reply(
      options,
    ) {
      counters.reply +=
        1;

      if (
        replyDelay >
        0
      ) {
        await sleep(
          replyDelay,
        );
      }

      interaction.replied =
        true;

      return {
        type:
          "reply",

        options,
      };
    },

    async deferReply(
      options,
    ) {
      counters.defer +=
        1;

      if (
        deferDelay >
        0
      ) {
        await sleep(
          deferDelay,
        );
      }

      interaction.deferred =
        true;

      return {
        type:
          "defer",

        options,
      };
    },

    async editReply(
      options,
    ) {
      counters.edit +=
        1;

      interaction.replied =
        true;

      return {
        type:
          "edit",

        options,
      };
    },

    async followUp(
      options,
    ) {
      counters.followUp +=
        1;

      return {
        type:
          "followUp",

        options,
      };
    },
  };

  return {
    interaction,
    counters,
  };
}

/*
 * ==========================================================
 * TEST 1
 *
 * Explicit reply begins BEFORE auto-defer timer,
 * but Discord response takes longer than 1.8 seconds.
 *
 * Old implementation:
 *   reply request + defer request raced -> 40060
 *
 * Fixed implementation:
 *   auto timer sees initialAckInFlight -> no second request.
 * ==========================================================
 */

{
  const {
    interaction,
    counters,
  } =
    makeInteraction({
      replyDelay:
        2_050,
    });

  const cleanup =
    installInteractionDeadlineGuard(
      interaction,
    );

  await interaction.reply({
    content:
      "slow explicit reply",
  });

  cleanup();

  assert(
    counters.reply ===
      1,
    `Expected 1 explicit reply, got ${counters.reply}`,
  );

  assert(
    counters.defer ===
      0,
    `Auto-defer raced explicit reply (${counters.defer} defer calls)`,
  );

  assert(
    interaction.replied ===
      true,
    "Explicit reply did not complete",
  );

  console.log(
    "✅ Slow explicit reply does not race auto-defer",
  );
}

/*
 * ==========================================================
 * TEST 2
 *
 * No explicit acknowledgement -> guard auto-defers.
 * A later reply must become editReply().
 * ==========================================================
 */

{
  const {
    interaction,
    counters,
  } =
    makeInteraction({
      deferDelay:
        10,
    });

  const cleanup =
    installInteractionDeadlineGuard(
      interaction,
    );

  await sleep(
    1_950,
  );

  assert(
    counters.defer ===
      1,
    `Expected exactly 1 auto-defer, got ${counters.defer}`,
  );

  assert(
    interaction.deferred ===
      true,
    "Auto-defer did not mark interaction deferred",
  );

  await interaction.reply({
    content:
      "reply after automatic defer",

    ephemeral:
      true,
  });

  cleanup();

  assert(
    counters.reply ===
      0,
    "Late reply incorrectly sent a second initial reply",
  );

  assert(
    counters.edit ===
      1,
    `Late reply must become editReply, got ${counters.edit}`,
  );

  console.log(
    "✅ Reply after auto-defer becomes editReply",
  );
}

/*
 * ==========================================================
 * TEST 3
 *
 * Explicit defer starts shortly before timer and remains
 * in-flight when timer fires. Must still produce one defer.
 * ==========================================================
 */

{
  const {
    interaction,
    counters,
  } =
    makeInteraction({
      deferDelay:
        350,
    });

  const cleanup =
    installInteractionDeadlineGuard(
      interaction,
    );

  await sleep(
    1_650,
  );

  await interaction.deferReply({
    ephemeral:
      true,
  });

  cleanup();

  assert(
    counters.defer ===
      1,
    `Explicit defer duplicated by auto timer: ${counters.defer}`,
  );

  console.log(
    "✅ Explicit defer is single-flight across timer boundary",
  );
}

/*
 * Error classifier.
 */
assert(
  isAlreadyAcknowledgedError({
    code:
      40060,
  }),
  "40060 classifier failed",
);

assert(
  isAlreadyAcknowledgedError({
    rawError: {
      code:
        40060,
    },
  }),
  "rawError 40060 classifier failed",
);

console.log(
  "✅ Discord 40060 classifier valid",
);

console.log(
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
);

console.log(
  "✅ INTERACTION ACK RACE SMOKE — PASSED",
);

console.log(
  "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
);
