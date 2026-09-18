import {
  readFile,
} from "node:fs/promises";

const files = [
  "dist/models/PuzzleSession.js",
  "dist/models/PuzzleStats.js",
  "dist/services/puzzleService.js",
  "dist/commands/community/puzzle-panel.js",
  "dist/interactions/buttons/puzzle-game.js",
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
    "../dist/models/PuzzleSession.js"
  );

const service =
  await import(
    "../dist/services/puzzleService.js"
  );

const command =
  await import(
    "../dist/commands/community/puzzle-panel.js"
  );

const button =
  await import(
    "../dist/interactions/buttons/puzzle-game.js"
  );

for (
  const game of [
    "sequence",
    "riddle",
    "logic",
  ]
) {
  if (
    !session
      .PUZZLE_GAMES
      .includes(
        game,
      )
  ) {
    throw new Error(
      `Missing Puzzle game: ${game}`,
    );
  }

  if (
    !service
      .puzzleService
      .isGame(
        game,
      )
  ) {
    throw new Error(
      `Invalid Puzzle game: ${game}`,
    );
  }
}

for (
  let index =
    0;
  index <
    100;
  index++
) {
  const question =
    service
      .generateSequenceQuestion();

  if (
    question.options.length !==
    4
  ) {
    throw new Error(
      "Sequence question must contain 4 options",
    );
  }

  if (
    question.correctIndex <
      0 ||
    question.correctIndex >
      3
  ) {
    throw new Error(
      "Sequence correctIndex invalid",
    );
  }

  if (
    new Set(
      question.options,
    ).size !==
    4
  ) {
    throw new Error(
      "Sequence options contain duplicates",
    );
  }
}

if (
  command.data
    .toJSON()
    .name !==
  "puzzle-panel"
) {
  throw new Error(
    "/puzzle-panel missing",
  );
}

if (
  button.customId !==
  "nexora_puzzle:"
) {
  throw new Error(
    "Puzzle dynamic button prefix invalid",
  );
}

for (
  const method of [
    "home",
    "start",
    "resume",
    "hint",
    "answer",
    "end",
    "stats",
  ]
) {
  if (
    typeof service
      .puzzleService[
        method
      ] !==
    "function"
  ) {
    throw new Error(
      `Missing Puzzle method: ${method}`,
    );
  }
}

console.log(
  "✅ Sequence generator passed 100 rounds",
);

console.log(
  "✅ Riddle mode registered",
);

console.log(
  "✅ Logic mode registered",
);

console.log(
  "✅ Persistent Puzzle API valid",
);

console.log(
  "✅ Puzzle interactions valid",
);
