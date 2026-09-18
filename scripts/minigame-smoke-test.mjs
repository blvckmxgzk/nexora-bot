import {
  readFile,
} from "node:fs/promises";

const files = [
  "dist/models/MiniGameSession.js",
  "dist/models/MiniGameStats.js",
  "dist/services/miniGameService.js",
  "dist/commands/community/minigame-panel.js",
  "dist/interactions/buttons/minigame-ui.js",
  "dist/interactions/selectMenus/minigame-ui.js",
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

const session =
  await import(
    "../dist/models/MiniGameSession.js"
  );

const service =
  await import(
    "../dist/services/miniGameService.js"
  );

const command =
  await import(
    "../dist/commands/community/minigame-panel.js"
  );

const button =
  await import(
    "../dist/interactions/buttons/minigame-ui.js"
  );

const select =
  await import(
    "../dist/interactions/selectMenus/minigame-ui.js"
  );

for (
  const game of [
    "rps",
    "guess",
    "tictactoe",
    "reaction",
  ]
) {
  if (
    !session
      .MINI_GAMES
      .includes(
        game,
      )
  ) {
    throw new Error(
      `Missing game: ${game}`,
    );
  }

  if (
    !service
      .miniGameService
      .isGame(
        game,
      )
  ) {
    throw new Error(
      `Game validator failed: ${game}`,
    );
  }
}

if (
  service.resolveRps(
    "rock",
    "scissors",
  ) !==
  "win"
) {
  throw new Error(
    "RPS win resolver failed",
  );
}

if (
  service.resolveRps(
    "rock",
    "paper",
  ) !==
  "loss"
) {
  throw new Error(
    "RPS loss resolver failed",
  );
}

if (
  service.resolveRps(
    "paper",
    "paper",
  ) !==
  "draw"
) {
  throw new Error(
    "RPS draw resolver failed",
  );
}

if (
  service.getTicTacToeWinner([
    "X",
    "X",
    "X",
    "",
    "O",
    "",
    "O",
    "",
    "",
  ]) !==
  "X"
) {
  throw new Error(
    "Tic-Tac-Toe winner detection failed",
  );
}

if (
  service.getTicTacToeWinner([
    "X",
    "O",
    "X",
    "X",
    "O",
    "O",
    "O",
    "X",
    "X",
  ]) !==
  "draw"
) {
  throw new Error(
    "Tic-Tac-Toe draw detection failed",
  );
}

for (
  let index =
    0;
  index <
    100;
  index++
) {
  const board = [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ];

  const move =
    service
      .chooseTicTacToeBotMove(
        board,
      );

  if (
    move ===
      null ||
    move <
      0 ||
    move >
      8
  ) {
    throw new Error(
      "Tic-Tac-Toe bot generated invalid move",
    );
  }
}

if (
  command.data
    .toJSON()
    .name !==
  "minigame-panel"
) {
  throw new Error(
    "/minigame-panel missing",
  );
}

if (
  button.customId !==
    "nexora_minigame:" ||
  select.customId !==
    "nexora_minigame:"
) {
  throw new Error(
    "Mini Game dynamic prefixes invalid",
  );
}

for (
  const method of [
    "home",
    "resume",
    "start",
    "rps",
    "guess",
    "ticTacToeMove",
    "reaction",
    "end",
    "stats",
  ]
) {
  if (
    typeof service
      .miniGameService[
        method
      ] !==
    "function"
  ) {
    throw new Error(
      `Missing Mini Game method: ${method}`,
    );
  }
}

console.log(
  "✅ Rock Paper Scissors resolver valid",
);

console.log(
  "✅ Guess Number registered",
);

console.log(
  "✅ Tic-Tac-Toe engine valid",
);

console.log(
  "✅ Tic-Tac-Toe bot tested 100 rounds",
);

console.log(
  "✅ Reaction Tap registered",
);

console.log(
  "✅ Persistent Mini Game API valid",
);
