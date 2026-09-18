import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import {
  randomInt,
} from "node:crypto";

import {
  CardGameSession,
} from "../models/CardGameSession.js";

import {
  CardGameStats,
} from "../models/CardGameStats.js";

export const CARD_GAME_PREFIX =
  "nexora_cards:";

const SUITS = [
  "S",
  "H",
  "D",
  "C",
] as const;

const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

const SUIT_LABELS:
  Record<
    string,
    string
  > = {
    S: "♠️",
    H: "♥️",
    D: "♦️",
    C: "♣️",
  };

type BlackjackState = {
  deck:
    string[];

  player:
    string[];

  dealer:
    string[];
};

type HighLowState = {
  deck:
    string[];

  current:
    string;

  streak:
    number;
};

export function createDeck():
  string[] {
  const deck:
    string[] =
      [];

  for (
    const suit of
    SUITS
  ) {
    for (
      const rank of
      RANKS
    ) {
      deck.push(
        `${rank}${suit}`,
      );
    }
  }

  return deck;
}

export function shuffleDeck(
  source:
    string[],
): string[] {
  const deck =
    [
      ...source,
    ];

  for (
    let index =
      deck.length -
      1;
    index >
      0;
    index--
  ) {
    const target =
      randomInt(
        index +
        1,
      );

    [
      deck[index],
      deck[target],
    ] = [
      deck[target]!,
      deck[index]!,
    ];
  }

  return deck;
}

function rankOf(
  card:
    string,
): string {
  return card.slice(
    0,
    -1,
  );
}

function suitOf(
  card:
    string,
): string {
  return card.slice(
    -1,
  );
}

export function cardLabel(
  card:
    string,
): string {
  return (
    `**${rankOf(card)}**` +
    `${SUIT_LABELS[suitOf(card)] ?? "🃏"}`
  );
}

function cardsLabel(
  cards:
    string[],
): string {
  return cards
    .map(
      cardLabel,
    )
    .join(
      "  ",
    );
}

export function calculateBlackjackScore(
  hand:
    string[],
): number {
  let score =
    0;

  let aces =
    0;

  for (
    const card of
    hand
  ) {
    const rank =
      rankOf(
        card,
      );

    if (
      rank ===
      "A"
    ) {
      score +=
        11;

      aces +=
        1;
    } else if (
      rank ===
        "K" ||
      rank ===
        "Q" ||
      rank ===
        "J"
    ) {
      score +=
        10;
    } else {
      score +=
        Number(
          rank,
        );
    }
  }

  while (
    score >
      21 &&
    aces >
      0
  ) {
    score -=
      10;

    aces -=
      1;
  }

  return score;
}

function highLowValue(
  card:
    string,
): number {
  const rank =
    rankOf(
      card,
    );

  if (
    rank ===
    "A"
  ) {
    return 14;
  }

  if (
    rank ===
    "K"
  ) {
    return 13;
  }

  if (
    rank ===
    "Q"
  ) {
    return 12;
  }

  if (
    rank ===
    "J"
  ) {
    return 11;
  }

  return Number(
    rank,
  );
}

export function compareHighLow(
  current:
    string,

  next:
    string,
):
  | "higher"
  | "lower"
  | "equal" {
  const first =
    highLowValue(
      current,
    );

  const second =
    highLowValue(
      next,
    );

  if (
    second >
    first
  ) {
    return "higher";
  }

  if (
    second <
    first
  ) {
    return "lower";
  }

  return "equal";
}

async function ensureStats(
  guildId:
    string,

  userId:
    string,
) {
  return CardGameStats
    .findOneAndUpdate(
      {
        guildId,
        userId,
      },
      {
        $setOnInsert: {
          guildId,
          userId,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
}

async function recoverSession(
  guildId:
    string,

  userId:
    string,
) {
  await CardGameSession
    .updateOne(
      {
        guildId,
        userId,
        status:
          "processing",

        processingStartedAt: {
          $lt:
            new Date(
              Date.now() -
              30_000,
            ),
        },
      },
      {
        $set: {
          status:
            "active",

          processingStartedAt:
            null,
        },
      },
    );
}

async function saveSession(
  guildId:
    string,

  userId:
    string,

  game:
    "blackjack"
    | "highlow",

  status:
    string,

  state:
    Record<
      string,
      unknown
    >,
) {
  return CardGameSession
    .findOneAndUpdate(
      {
        guildId,
        userId,
      },
      {
        $set: {
          game,
          status,
          state,

          startedAt:
            new Date(),

          finishedAt:
            status ===
              "active"
              ? null
              : new Date(),

          processingStartedAt:
            null,
        },

        $setOnInsert: {
          guildId,
          userId,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
}

function homeButtons() {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${CARD_GAME_PREFIX}home`,
        )
        .setLabel(
          "หน้าหลัก",
        )
        .setEmoji(
          "🏠",
        )
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
}

function blackjackButtons(
  active:
    boolean,
) {
  if (
    !active
  ) {
    return [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${CARD_GAME_PREFIX}blackjack_start`,
            )
            .setLabel(
              "เล่นอีกครั้ง",
            )
            .setEmoji(
              "🃏",
            )
            .setStyle(
              ButtonStyle.Primary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `${CARD_GAME_PREFIX}stats`,
            )
            .setLabel(
              "สถิติ",
            )
            .setEmoji(
              "📊",
            )
            .setStyle(
              ButtonStyle.Secondary,
            ),

          homeButtons()
            .components[0]!,
        ),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `${CARD_GAME_PREFIX}blackjack_hit`,
          )
          .setLabel(
            "Hit",
          )
          .setEmoji(
            "➕",
          )
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `${CARD_GAME_PREFIX}blackjack_stand`,
          )
          .setLabel(
            "Stand",
          )
          .setEmoji(
            "✋",
          )
          .setStyle(
            ButtonStyle.Success,
          ),

        new ButtonBuilder()
          .setCustomId(
            `${CARD_GAME_PREFIX}end`,
          )
          .setLabel(
            "ออกจากเกม",
          )
          .setEmoji(
            "🚪",
          )
          .setStyle(
            ButtonStyle.Danger,
          ),
      ),
  ];
}

function blackjackPayload(
  session:
    any,

  notice?:
    string,
) {
  const state =
    session.state as
      BlackjackState;

  const active =
    session.status ===
    "active";

  const playerScore =
    calculateBlackjackScore(
      state.player,
    );

  const dealerScore =
    calculateBlackjackScore(
      state.dealer,
    );

  const dealerCards =
    active
      ? `${cardLabel(state.dealer[0]!)}  🂠`
      : cardsLabel(
          state.dealer,
        );

  let result =
    "";

  if (
    session.status ===
    "won"
  ) {
    result =
      "🏆 **คุณชนะ!**";
  } else if (
    session.status ===
    "lost"
  ) {
    result =
      "💀 **Dealer ชนะ**";
  } else if (
    session.status ===
    "draw"
  ) {
    result =
      "🤝 **เสมอ**";
  }

  const description =
    [
      notice,
      result,
    ]
      .filter(
        Boolean,
      )
      .join(
        "\n\n",
      ) ||
    "พยายามทำแต้มให้ใกล้ **21** มากที่สุดโดยไม่เกิน 21";

  return {
    content:
      null,

    embeds: [
      new EmbedBuilder()
        .setColor(
          active
            ? 0x5865f2
            : session.status ===
                "won"
              ? 0x2ecc71
              : session.status ===
                  "draw"
                ? 0xf1c40f
                : 0xe74c3c,
        )
        .setTitle(
          "🃏 Blackjack",
        )
        .setDescription(
          description,
        )
        .addFields(
          {
            name:
              `👤 คุณ • ${playerScore}`,

            value:
              cardsLabel(
                state.player,
              ),

            inline:
              false,
          },

          {
            name:
              active
                ? "🎩 Dealer • ?"
                : `🎩 Dealer • ${dealerScore}`,

            value:
              dealerCards,

            inline:
              false,
          },
        )
        .setFooter({
          text:
            "ไม่มีการเดิมพัน NEXO หรือเงินจริง",
        }),
    ],

    components:
      blackjackButtons(
        active,
      ),
  };
}

function highLowPayload(
  session:
    any,

  notice?:
    string,
) {
  const state =
    session.state as
      HighLowState;

  const active =
    session.status ===
    "active";

  return {
    content:
      null,

    embeds: [
      new EmbedBuilder()
        .setColor(
          active
            ? 0x9b59b6
            : 0xe74c3c,
        )
        .setTitle(
          "⬆️⬇️ High–Low",
        )
        .setDescription(
          [
            notice,
            active
              ? "ทายว่าไพ่ใบถัดไปจะ **สูงกว่า** หรือ **ต่ำกว่า**"
              : "💥 **จบรอบแล้ว**",
          ]
            .filter(
              Boolean,
            )
            .join(
              "\n\n",
            ),
        )
        .addFields(
          {
            name:
              "🃏 ไพ่ปัจจุบัน",

            value:
              cardLabel(
                state.current,
              ),

            inline:
              true,
          },

          {
            name:
              "🔥 Streak",

            value:
              `**${state.streak}**`,

            inline:
              true,
          },
        )
        .setFooter({
          text:
            "A สูงที่สุด • ไพ่เลขเท่ากันไม่นับแพ้",
        }),
    ],

    components:
      active
        ? [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `${CARD_GAME_PREFIX}highlow_higher`,
                  )
                  .setLabel(
                    "สูงกว่า",
                  )
                  .setEmoji(
                    "⬆️",
                  )
                  .setStyle(
                    ButtonStyle.Success,
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `${CARD_GAME_PREFIX}highlow_lower`,
                  )
                  .setLabel(
                    "ต่ำกว่า",
                  )
                  .setEmoji(
                    "⬇️",
                  )
                  .setStyle(
                    ButtonStyle.Primary,
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `${CARD_GAME_PREFIX}end`,
                  )
                  .setLabel(
                    "ออกจากเกม",
                  )
                  .setEmoji(
                    "🚪",
                  )
                  .setStyle(
                    ButtonStyle.Danger,
                  ),
              ),
          ]
        : [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `${CARD_GAME_PREFIX}highlow_start`,
                  )
                  .setLabel(
                    "เล่นอีกครั้ง",
                  )
                  .setEmoji(
                    "🔁",
                  )
                  .setStyle(
                    ButtonStyle.Primary,
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `${CARD_GAME_PREFIX}stats`,
                  )
                  .setLabel(
                    "สถิติ",
                  )
                  .setEmoji(
                    "📊",
                  )
                  .setStyle(
                    ButtonStyle.Secondary,
                  ),

                homeButtons()
                  .components[0]!,
              ),
          ],
  };
}

async function finishBlackjack(
  session:
    any,

  state:
    BlackjackState,
) {
  while (
    calculateBlackjackScore(
      state.dealer,
    ) <
    17
  ) {
    const card =
      state.deck.pop();

    if (!card) {
      break;
    }

    state.dealer.push(
      card,
    );
  }

  const playerScore =
    calculateBlackjackScore(
      state.player,
    );

  const dealerScore =
    calculateBlackjackScore(
      state.dealer,
    );

  let status:
    "won"
    | "lost"
    | "draw";

  if (
    dealerScore >
      21 ||
    playerScore >
      dealerScore
  ) {
    status =
      "won";
  } else if (
    playerScore <
    dealerScore
  ) {
    status =
      "lost";
  } else {
    status =
      "draw";
  }

  session.status =
    status;

  session.finishedAt =
    new Date();

  session.processingStartedAt =
    null;

  session.set(
    "state",
    state,
  );

  await session.save();

  await CardGameStats
    .updateOne(
      {
        guildId:
          session.guildId,

        userId:
          session.userId,
      },
      {
        $inc: {
          [`blackjack.${
            status ===
              "won"
              ? "wins"
              : status ===
                  "lost"
                ? "losses"
                : "draws"
          }`]:
            1,
        },
      },
    );

  return session;
}

export const cardGameService = {
  buildPanel() {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(
            0x5865f2,
          )
          .setTitle(
            "🃏 NEXORA • Card Games",
          )
          .setDescription(
            [
              "เล่นเกมไพ่กับ NEXORA ผ่านปุ่มได้เลย",
              "",
              "🃏 **Blackjack**",
              "ทำแต้มให้ใกล้ 21 มากกว่า Dealer",
              "",
              "⬆️⬇️ **High–Low**",
              "ทายว่าไพ่ใบถัดไปสูงหรือต่ำกว่า",
              "",
              "📊 มีสถิติถาวรและรองรับการ Restart",
              "💠 ไม่มีการเดิมพัน NEXO และไม่มีเงินจริง",
            ].join(
              "\n",
            ),
          )
          .setFooter({
            text:
              "NEXORA Card Games",
          })
          .setTimestamp(),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${CARD_GAME_PREFIX}home`,
              )
              .setLabel(
                "เปิด Card Games",
              )
              .setEmoji(
                "🃏",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),
          ),
      ],
    };
  },

  async home(
    guildId:
      string,

    userId:
      string,

    notice?:
      string,
  ) {
    await recoverSession(
      guildId,
      userId,
    );

    const session =
      await CardGameSession
        .findOne({
          guildId,
          userId,
        });

    const active =
      session &&
      (
        session.status ===
          "active" ||
        session.status ===
          "processing"
      );

    return {
      content:
        notice ??
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0x5865f2,
          )
          .setTitle(
            "🃏 NEXORA Card Games",
          )
          .setDescription(
            [
              active
                ? `🎮 มีเกม **${session.game === "blackjack" ? "Blackjack" : "High–Low"}** ที่กำลังเล่นอยู่`
                : "เลือกเกมที่ต้องการเล่น",
              "",
              "🃏 **Blackjack** — Hit / Stand / Dealer",
              "⬆️⬇️ **High–Low** — ทายสูงหรือต่ำ",
              "",
              "เกมนี้ไม่มีการเดิมพัน NEXO",
            ].join(
              "\n",
            ),
          )
          .setTimestamp(),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${CARD_GAME_PREFIX}blackjack_start`,
              )
              .setLabel(
                "Blackjack",
              )
              .setEmoji(
                "🃏",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${CARD_GAME_PREFIX}highlow_start`,
              )
              .setLabel(
                "High–Low",
              )
              .setEmoji(
                "⬆️",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${CARD_GAME_PREFIX}resume`,
              )
              .setLabel(
                "เล่นต่อ",
              )
              .setEmoji(
                "▶️",
              )
              .setStyle(
                ButtonStyle.Success,
              )
              .setDisabled(
                !active,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${CARD_GAME_PREFIX}stats`,
              )
              .setLabel(
                "สถิติ",
              )
              .setEmoji(
                "📊",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),
          ),
      ],
    };
  },

  async resume(
    guildId:
      string,

    userId:
      string,
  ) {
    await recoverSession(
      guildId,
      userId,
    );

    const session =
      await CardGameSession
        .findOne({
          guildId,
          userId,

          status:
            "active",
        });

    if (!session) {
      throw new Error(
        "ไม่มีเกมที่กำลังเล่นอยู่",
      );
    }

    return session.game ===
      "blackjack"
      ? blackjackPayload(
          session,
        )
      : highLowPayload(
          session,
        );
  },

  async startBlackjack(
    guildId:
      string,

    userId:
      string,
  ) {
    await ensureStats(
      guildId,
      userId,
    );

    const deck =
      shuffleDeck(
        createDeck(),
      );

    const state:
      BlackjackState = {
        deck,

        player: [
          deck.pop()!,
          deck.pop()!,
        ],

        dealer: [
          deck.pop()!,
          deck.pop()!,
        ],
      };

    let status:
      "active"
      | "won"
      | "lost"
      | "draw" =
        "active";

    const playerBlackjack =
      calculateBlackjackScore(
        state.player,
      ) ===
      21;

    const dealerBlackjack =
      calculateBlackjackScore(
        state.dealer,
      ) ===
      21;

    if (
      playerBlackjack &&
      dealerBlackjack
    ) {
      status =
        "draw";
    } else if (
      playerBlackjack
    ) {
      status =
        "won";
    } else if (
      dealerBlackjack
    ) {
      status =
        "lost";
    }

    const session =
      await saveSession(
        guildId,
        userId,
        "blackjack",
        status,
        state,
      );

    const increments:
      Record<
        string,
        number
      > = {
        "blackjack.played":
          1,
      };

    if (
      status ===
      "won"
    ) {
      increments[
        "blackjack.wins"
      ] =
        1;

      if (
        playerBlackjack
      ) {
        increments[
          "blackjack.blackjacks"
        ] =
          1;
      }
    } else if (
      status ===
      "lost"
    ) {
      increments[
        "blackjack.losses"
      ] =
        1;
    } else if (
      status ===
      "draw"
    ) {
      increments[
        "blackjack.draws"
      ] =
        1;
    }

    await CardGameStats
      .updateOne(
        {
          guildId,
          userId,
        },
        {
          $inc:
            increments,
        },
      );

    return blackjackPayload(
      session,
      playerBlackjack
        ? status ===
            "won"
          ? "✨ **BLACKJACK!**"
          : "✨ ทั้งคุณและ Dealer ได้ Blackjack"
        : dealerBlackjack
          ? "🎩 Dealer ได้ Blackjack"
          : undefined,
    );
  },

  async blackjackHit(
    guildId:
      string,

    userId:
      string,
  ) {
    await recoverSession(
      guildId,
      userId,
    );

    const session =
      await CardGameSession
        .findOneAndUpdate(
          {
            guildId,
            userId,
            game:
              "blackjack",

            status:
              "active",
          },
          {
            $set: {
              status:
                "processing",

              processingStartedAt:
                new Date(),
            },
          },
          {
            new:
              true,
          },
        );

    if (!session) {
      throw new Error(
        "ไม่มี Blackjack ที่รอรับคำสั่ง",
      );
    }

    try {
      const state =
        session.state as
          BlackjackState;

      const next =
        state.deck.pop();

      if (!next) {
        throw new Error(
          "Deck หมด",
        );
      }

      state.player.push(
        next,
      );

      const score =
        calculateBlackjackScore(
          state.player,
        );

      if (
        score >
        21
      ) {
        session.status =
          "lost";

        session.finishedAt =
          new Date();

        session.processingStartedAt =
          null;

        session.set(
          "state",
          state,
        );

        await session.save();

        await CardGameStats
          .updateOne(
            {
              guildId,
              userId,
            },
            {
              $inc: {
                "blackjack.losses":
                  1,
              },
            },
          );

        return blackjackPayload(
          session,
          `💥 Bust! ได้ ${score} แต้ม`,
        );
      }

      if (
        score ===
        21
      ) {
        return blackjackPayload(
          await finishBlackjack(
            session,
            state,
          ),
          "🎯 ได้ 21 แต้ม ระบบ Stand ให้อัตโนมัติ",
        );
      }

      session.status =
        "active";

      session.processingStartedAt =
        null;

      session.set(
        "state",
        state,
      );

      await session.save();

      return blackjackPayload(
        session,
        `➕ ได้ ${cardLabel(next)}`,
      );
    } catch (error) {
      await CardGameSession
        .updateOne(
          {
            _id:
              session._id,

            status:
              "processing",
          },
          {
            $set: {
              status:
                "active",

              processingStartedAt:
                null,
            },
          },
        );

      throw error;
    }
  },

  async blackjackStand(
    guildId:
      string,

    userId:
      string,
  ) {
    await recoverSession(
      guildId,
      userId,
    );

    const session =
      await CardGameSession
        .findOneAndUpdate(
          {
            guildId,
            userId,
            game:
              "blackjack",

            status:
              "active",
          },
          {
            $set: {
              status:
                "processing",

              processingStartedAt:
                new Date(),
            },
          },
          {
            new:
              true,
          },
        );

    if (!session) {
      throw new Error(
        "ไม่มี Blackjack ที่รอรับคำสั่ง",
      );
    }

    try {
      const state =
        session.state as
          BlackjackState;

      return blackjackPayload(
        await finishBlackjack(
          session,
          state,
        ),
      );
    } catch (error) {
      await CardGameSession
        .updateOne(
          {
            _id:
              session._id,

            status:
              "processing",
          },
          {
            $set: {
              status:
                "active",

              processingStartedAt:
                null,
            },
          },
        );

      throw error;
    }
  },

  async startHighLow(
    guildId:
      string,

    userId:
      string,
  ) {
    await ensureStats(
      guildId,
      userId,
    );

    const deck =
      shuffleDeck(
        createDeck(),
      );

    const current =
      deck.pop();

    if (!current) {
      throw new Error(
        "ไม่สามารถสร้าง Deck ได้",
      );
    }

    const session =
      await saveSession(
        guildId,
        userId,
        "highlow",
        "active",
        {
          deck,
          current,
          streak:
            0,
        },
      );

    await CardGameStats
      .updateOne(
        {
          guildId,
          userId,
        },
        {
          $inc: {
            "highlow.played":
              1,
          },
        },
      );

    return highLowPayload(
      session,
    );
  },

  async highLowGuess(
    guildId:
      string,

    userId:
      string,

    guess:
      "higher"
      | "lower",
  ) {
    await recoverSession(
      guildId,
      userId,
    );

    const session =
      await CardGameSession
        .findOneAndUpdate(
          {
            guildId,
            userId,
            game:
              "highlow",

            status:
              "active",
          },
          {
            $set: {
              status:
                "processing",

              processingStartedAt:
                new Date(),
            },
          },
          {
            new:
              true,
          },
        );

    if (!session) {
      throw new Error(
        "ไม่มี High–Low ที่รอรับคำสั่ง",
      );
    }

    try {
      const state =
        session.state as
          HighLowState;

      if (
        state.deck.length ===
        0
      ) {
        state.deck =
          shuffleDeck(
            createDeck(),
          );
      }

      const next =
        state.deck.pop();

      if (!next) {
        throw new Error(
          "ไม่สามารถจั่วไพ่ได้",
        );
      }

      const comparison =
        compareHighLow(
          state.current,
          next,
        );

      const previous =
        state.current;

      state.current =
        next;

      if (
        comparison ===
        "equal"
      ) {
        session.status =
          "active";

        session.processingStartedAt =
          null;

        session.set(
          "state",
          state,
        );

        await session.save();

        return highLowPayload(
          session,
          `${cardLabel(previous)} → ${cardLabel(next)}\n🤝 Rank เท่ากัน ไม่นับแพ้`,
        );
      }

      if (
        comparison ===
        guess
      ) {
        state.streak +=
          1;

        session.status =
          "active";

        session.processingStartedAt =
          null;

        session.set(
          "state",
          state,
        );

        await session.save();

        await CardGameStats
          .updateOne(
            {
              guildId,
              userId,
            },
            {
              $inc: {
                "highlow.correct":
                  1,
              },

              $max: {
                "highlow.bestStreak":
                  state.streak,
              },
            },
          );

        return highLowPayload(
          session,
          `${cardLabel(previous)} → ${cardLabel(next)}\n✅ ถูกต้อง!`,
        );
      }

      session.status =
        "lost";

      session.finishedAt =
        new Date();

      session.processingStartedAt =
        null;

      session.set(
        "state",
        state,
      );

      await session.save();

      await CardGameStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              "highlow.wrong":
                1,
            },

            $max: {
              "highlow.bestStreak":
                state.streak,
            },
          },
        );

      return highLowPayload(
        session,
        `${cardLabel(previous)} → ${cardLabel(next)}\n❌ ทายผิด • จบที่ Streak **${state.streak}**`,
      );
    } catch (error) {
      await CardGameSession
        .updateOne(
          {
            _id:
              session._id,

            status:
              "processing",
          },
          {
            $set: {
              status:
                "active",

              processingStartedAt:
                null,
            },
          },
        );

      throw error;
    }
  },

  async endGame(
    guildId:
      string,

    userId:
      string,
  ) {
    const session =
      await CardGameSession
        .findOneAndUpdate(
          {
            guildId,
            userId,

            status: {
              $in: [
                "active",
                "processing",
              ],
            },
          },
          {
            $set: {
              status:
                "ended",

              finishedAt:
                new Date(),

              processingStartedAt:
                null,
            },
          },
          {
            new:
              true,
          },
        );

    if (!session) {
      throw new Error(
        "ไม่มีเกมที่กำลังเล่นอยู่",
      );
    }

    return this.home(
      guildId,
      userId,
      "🚪 ออกจากเกมแล้ว",
    );
  },

  async stats(
    guildId:
      string,

    userId:
      string,
  ) {
    const stats =
      await ensureStats(
        guildId,
        userId,
      );

    const blackjack =
      stats.blackjack ??
      {};

    const highlow =
      stats.highlow ??
      {};

    const blackjackPlayed =
      Number(
        blackjack.played ??
        0,
      );

    const blackjackWins =
      Number(
        blackjack.wins ??
        0,
      );

    const winRate =
      blackjackPlayed >
        0
        ? (
            blackjackWins /
            blackjackPlayed *
            100
          ).toFixed(
            1,
          )
        : "0.0";

    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0x5865f2,
          )
          .setTitle(
            "📊 Card Game Stats",
          )
          .addFields(
            {
              name:
                "🃏 Blackjack",

              value: [
                `เล่น **${blackjackPlayed.toLocaleString()}**`,
                `ชนะ **${blackjackWins.toLocaleString()}**`,
                `แพ้ **${Number(blackjack.losses ?? 0).toLocaleString()}**`,
                `เสมอ **${Number(blackjack.draws ?? 0).toLocaleString()}**`,
                `Blackjack **${Number(blackjack.blackjacks ?? 0).toLocaleString()}**`,
                `Win Rate **${winRate}%**`,
              ].join(
                "\n",
              ),

              inline:
                true,
            },

            {
              name:
                "⬆️⬇️ High–Low",

              value: [
                `รอบ **${Number(highlow.played ?? 0).toLocaleString()}**`,
                `ทายถูก **${Number(highlow.correct ?? 0).toLocaleString()}**`,
                `ทายผิด **${Number(highlow.wrong ?? 0).toLocaleString()}**`,
                `Best Streak **${Number(highlow.bestStreak ?? 0).toLocaleString()}**`,
              ].join(
                "\n",
              ),

              inline:
                true,
            },
          )
          .setFooter({
            text:
              "สถิติเก็บถาวรใน MongoDB",
          })
          .setTimestamp(),
      ],

      components: [
        homeButtons(),
      ],
    };
  },
};
