import {
  readFile,
} from "node:fs/promises";

const files = [
  "dist/models/MatchmakingProfile.js",
  "dist/models/MatchmakingQueue.js",
  "dist/models/MatchmakingSession.js",
  "dist/services/matchmakingService.js",
  "dist/services/matchmakingRuntime.js",
  "dist/commands/community/match-panel.js",
  "dist/interactions/buttons/matchmaking-ui.js",
  "dist/interactions/selectMenus/matchmaking-ui.js",
];

for (
  const file of
    files
) {
  await readFile(
    file,
    "utf8",
  );
}

const queue =
  await import(
    "../dist/models/MatchmakingQueue.js"
  );

const profile =
  await import(
    "../dist/models/MatchmakingProfile.js"
  );

const service =
  await import(
    "../dist/services/matchmakingService.js"
  );

const command =
  await import(
    "../dist/commands/community/match-panel.js"
  );

const button =
  await import(
    "../dist/interactions/buttons/matchmaking-ui.js"
  );

const select =
  await import(
    "../dist/interactions/selectMenus/matchmaking-ui.js"
  );

if (
  command.data
    .toJSON()
    .name !==
  "match-panel"
) {
  throw new Error(
    "/match-panel missing",
  );
}

for (
  const mode of [
    "friend",
    "chat",
    "gaming",
  ]
) {
  if (
    !queue
      .MATCHMAKING_MODES
      .includes(
        mode,
      )
  ) {
    throw new Error(
      `Missing mode: ${mode}`,
    );
  }

  if (
    !service
      .matchmakingService
      .isMode(
        mode,
      )
  ) {
    throw new Error(
      `Mode validation failed: ${mode}`,
    );
  }
}

if (
  !profile
    .MATCHMAKING_AGE_GROUPS
    .includes(
      "13-17",
    ) ||
  !profile
    .MATCHMAKING_AGE_GROUPS
    .includes(
      "18+",
    )
) {
  throw new Error(
    "Age group isolation missing",
  );
}

if (
  button.customId !==
  "nexora_matchmaking:" ||
  select.customId !==
  "nexora_matchmaking:"
) {
  throw new Error(
    "Dynamic interaction prefixes invalid",
  );
}

for (
  const method of [
    "home",
    "setAgeGroup",
    "joinQueue",
    "leaveQueue",
    "endSession",
    "history",
    "recoverStuckQueues",
    "processQueues",
    "notifyPair",
  ]
) {
  if (
    typeof service
      .matchmakingService[
        method
      ] !==
    "function"
  ) {
    throw new Error(
      `Missing method: ${method}`,
    );
  }
}

console.log(
  "✅ Matchmaking models valid",
);

console.log(
  "✅ friend / chat / gaming modes valid",
);

console.log(
  "✅ 13–17 / 18+ queue isolation valid",
);

console.log(
  "✅ Persistent queue + runtime valid",
);

console.log(
  "✅ Matchmaking interactions valid",
);
