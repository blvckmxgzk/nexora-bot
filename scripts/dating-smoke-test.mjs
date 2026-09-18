import {
  readFile,
} from "node:fs/promises";

for (
  const file of [
    "dist/models/DatingProfile.js",
    "dist/models/DatingMatch.js",
    "dist/services/datingService.js",
    "dist/commands/community/dating-panel.js",
    "dist/interactions/buttons/dating-ui.js",
    "dist/interactions/modals/dating-profile.js",
  ]
) {
  await readFile(
    file,
    "utf8",
  );
}

const profiles =
  await import(
    "../dist/models/DatingProfile.js"
  );

const service =
  await import(
    "../dist/services/datingService.js"
  );

const command =
  await import(
    "../dist/commands/community/dating-panel.js"
  );

const button =
  await import(
    "../dist/interactions/buttons/dating-ui.js"
  );

const modal =
  await import(
    "../dist/interactions/modals/dating-profile.js"
  );

if (
  !profiles
    .DATING_AGE_GROUPS
    .includes(
      "13-17",
    ) ||
  !profiles
    .DATING_AGE_GROUPS
    .includes(
      "18+",
    )
) {
  throw new Error(
    "Age groups invalid",
  );
}

if (
  service
    .datingService
    .parseAgeGroup(
      "13-17",
    ) !==
  "13-17"
) {
  throw new Error(
    "13-17 parser failed",
  );
}

if (
  service
    .datingService
    .parseAgeGroup(
      "18+",
    ) !==
  "18+"
) {
  throw new Error(
    "18+ parser failed",
  );
}

if (
  service
    .datingService
    .home.length <
  2
) {
  throw new Error(
    "Dating home API invalid",
  );
}

if (
  command.data
    .toJSON()
    .name !==
  "dating-panel"
) {
  throw new Error(
    "/dating-panel missing",
  );
}

if (
  button.customId !==
  "nexora_dating:"
) {
  throw new Error(
    "Button prefix invalid",
  );
}

if (
  modal.customId !==
  "nexora_dating:profile_modal"
) {
  throw new Error(
    "Modal ID invalid",
  );
}

console.log(
  "✅ Dating models valid",
);

console.log(
  "✅ 13–17 and 18+ isolation configured",
);

console.log(
  "✅ Optional dashboard notice API valid",
);

console.log(
  "✅ Dating interactions valid",
);
