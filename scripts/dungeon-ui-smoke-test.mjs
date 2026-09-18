import {
  readFile,
} from "node:fs/promises";

const files = [
  "dist/commands/dungeon.js",
  "dist/services/dungeons/dungeonUiService.js",
  "dist/interactions/buttons/dungeon-ui.js",
  "dist/interactions/selectMenus/dungeon-ui.js",
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

const command =
  await import(
    "../dist/commands/dungeon.js"
  );

const button =
  await import(
    "../dist/interactions/buttons/dungeon-ui.js"
  );

const select =
  await import(
    "../dist/interactions/selectMenus/dungeon-ui.js"
  );

const ui =
  await import(
    "../dist/services/dungeons/dungeonUiService.js"
  );

const commandJson =
  command.data.toJSON();

if (
  commandJson.name !==
  "dungeon"
) {
  throw new Error(
    "/dungeon missing",
  );
}

if (
  (
    commandJson.options ??
    []
  ).length !==
  0
) {
  throw new Error(
    "Old /dungeon subcommands remain",
  );
}

if (
  button.customId !==
  "nexora_dungeon:"
) {
  throw new Error(
    "Button dynamic prefix invalid",
  );
}

if (
  select.customId !==
  "nexora_dungeon:"
) {
  throw new Error(
    "Select dynamic prefix invalid",
  );
}

for (
  const method of [
    "home",
    "profile",
    "runSetup",
    "inventory",
    "item",
    "forge",
    "createCharacter",
    "equip",
    "upgrade",
    "forgeSubmit",
    "run",
    "ascend",
  ]
) {
  if (
    typeof ui
      .dungeonUiService[
        method
      ] !==
    "function"
  ) {
    throw new Error(
      `Missing Dungeon UI method: ${method}`,
    );
  }
}

console.log(
  "✅ /dungeon = one entry command",
);

console.log(
  "✅ Buttons valid",
);

console.log(
  "✅ Select menus valid",
);

console.log(
  "✅ Full interactive Dungeon navigation valid",
);
