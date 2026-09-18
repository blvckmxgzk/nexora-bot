import {
  readFile,
} from "node:fs/promises";

const requiredFiles = [
  "dist/models/Giveaway.js",
  "dist/services/giveawayService.js",
  "dist/services/giveawayRuntime.js",
  "dist/commands/community/giveaway.js",
  "dist/interactions/buttons/giveaway-enter.js",
];

for (
  const file of
    requiredFiles
) {
  await readFile(
    file,
    "utf8",
  );
}

const giveawayModel =
  await import(
    "../dist/models/Giveaway.js"
  );

const giveawayServiceModule =
  await import(
    "../dist/services/giveawayService.js"
  );

const giveawayCommand =
  await import(
    "../dist/commands/community/giveaway.js"
  );

const giveawayButton =
  await import(
    "../dist/interactions/buttons/giveaway-enter.js"
  );

for (
  const status of [
    "active",
    "ending",
    "ended",
    "cancelled",
  ]
) {
  if (
    !giveawayModel
      .GIVEAWAY_STATUSES
      .includes(
        status,
      )
  ) {
    throw new Error(
      `Missing Giveaway status: ${status}`,
    );
  }
}

const {
  parseGiveawayDuration,
  pickGiveawayWinners,
} =
  giveawayServiceModule;

if (
  parseGiveawayDuration(
    "30s",
  ) !==
  30_000
) {
  throw new Error(
    "Duration parser failed for 30s",
  );
}

if (
  parseGiveawayDuration(
    "10m",
  ) !==
  600_000
) {
  throw new Error(
    "Duration parser failed for 10m",
  );
}

if (
  parseGiveawayDuration(
    "2h",
  ) !==
  7_200_000
) {
  throw new Error(
    "Duration parser failed for 2h",
  );
}

let invalidDurationPassed =
  false;

try {
  parseGiveawayDuration(
    "banana",
  );
} catch {
  invalidDurationPassed =
    true;
}

if (
  !invalidDurationPassed
) {
  throw new Error(
    "Invalid duration was accepted",
  );
}

const winners =
  pickGiveawayWinners(
    [
      "1",
      "2",
      "3",
      "4",
      "5",
      "5",
    ],
    3,
    [
      "1",
    ],
  );

if (
  winners.length !==
  3
) {
  throw new Error(
    "Winner count incorrect",
  );
}

if (
  new Set(
    winners,
  ).size !==
  winners.length
) {
  throw new Error(
    "Duplicate winners detected",
  );
}

if (
  winners.includes(
    "1",
  )
) {
  throw new Error(
    "Excluded winner selected",
  );
}

if (
  giveawayButton.customId !==
  "nexora_giveaway_enter:"
) {
  throw new Error(
    "Dynamic Giveaway button prefix invalid",
  );
}

const commandJson =
  giveawayCommand.data
    .toJSON();

if (
  commandJson.name !==
  "giveaway"
) {
  throw new Error(
    "/giveaway command missing",
  );
}

const subcommands =
  (
    commandJson.options ??
    []
  )
    .map(
      (
        option,
      ) =>
        option.name,
    );

for (
  const name of [
    "create",
    "end",
    "reroll",
    "cancel",
    "info",
    "list",
  ]
) {
  if (
    !subcommands.includes(
      name,
    )
  ) {
    throw new Error(
      `Missing /giveaway ${name}`,
    );
  }
}

console.log(
  "✅ Giveaway model valid",
);

console.log(
  "✅ Duration parser valid",
);

console.log(
  "✅ Winner selection valid",
);

console.log(
  "✅ Dynamic join button valid",
);

console.log(
  "✅ Slash command structure valid",
);
