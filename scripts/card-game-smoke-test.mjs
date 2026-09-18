import {
  readFile,
} from "node:fs/promises";

const files = [
  "dist/models/CardGameSession.js",
  "dist/models/CardGameStats.js",
  "dist/services/cardGameService.js",
  "dist/commands/community/card-panel.js",
  "dist/interactions/buttons/card-game.js",
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

const sessionModel =
  await import(
    "../dist/models/CardGameSession.js"
  );

const service =
  await import(
    "../dist/services/cardGameService.js"
  );

const command =
  await import(
    "../dist/commands/community/card-panel.js"
  );

const button =
  await import(
    "../dist/interactions/buttons/card-game.js"
  );

const deck =
  service.createDeck();

if (
  deck.length !==
  52
) {
  throw new Error(
    `Expected 52 cards, got ${deck.length}`,
  );
}

if (
  new Set(
    deck,
  ).size !==
  52
) {
  throw new Error(
    "Deck contains duplicate cards",
  );
}

if (
  service.calculateBlackjackScore([
    "AS",
    "KH",
  ]) !==
  21
) {
  throw new Error(
    "Blackjack score failed",
  );
}

if (
  service.calculateBlackjackScore([
    "AS",
    "AH",
    "9D",
  ]) !==
  21
) {
  throw new Error(
    "Ace adjustment failed",
  );
}

if (
  service.compareHighLow(
    "9S",
    "KH",
  ) !==
  "higher"
) {
  throw new Error(
    "High-Low compare failed",
  );
}

if (
  service.compareHighLow(
    "QS",
    "4H",
  ) !==
  "lower"
) {
  throw new Error(
    "High-Low lower compare failed",
  );
}

if (
  !sessionModel
    .CARD_GAMES
    .includes(
      "blackjack",
    ) ||
  !sessionModel
    .CARD_GAMES
    .includes(
      "highlow",
    )
) {
  throw new Error(
    "Card game modes missing",
  );
}

if (
  command.data
    .toJSON()
    .name !==
  "card-panel"
) {
  throw new Error(
    "/card-panel missing",
  );
}

if (
  button.customId !==
  "nexora_cards:"
) {
  throw new Error(
    "Card button prefix invalid",
  );
}

for (
  const method of [
    "home",
    "resume",
    "startBlackjack",
    "blackjackHit",
    "blackjackStand",
    "startHighLow",
    "highLowGuess",
    "endGame",
    "stats",
  ]
) {
  if (
    typeof service
      .cardGameService[
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
  "✅ Standard 52-card deck valid",
);

console.log(
  "✅ Blackjack scoring valid",
);

console.log(
  "✅ High–Low comparison valid",
);

console.log(
  "✅ Persistent Card Game API valid",
);

console.log(
  "✅ Card interaction router valid",
);
