import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import {
  randomInt,
} from "node:crypto";

import {
  MiniGameSession,
} from "../models/MiniGameSession.js";

import {
  MiniGameStats,
} from "../models/MiniGameStats.js";

export type MiniGame =
  | "rps"
  | "guess"
  | "tictactoe"
  | "reaction";

export type RpsChoice =
  | "rock"
  | "paper"
  | "scissors";

export const MINIGAME_PREFIX =
  "nexora_minigame:";

const GAME_NAMES:
  Record<
    MiniGame,
    string
  > = {
    rps:
      "✊ เป่ายิ้งฉุบ",

    guess:
      "🔢 ทายเลข",

    tictactoe:
      "⭕ Tic-Tac-Toe",

    reaction:
      "⚡ Reaction Tap",
  };

const RPS_NAMES:
  Record<
    RpsChoice,
    string
  > = {
    rock:
      "✊ ค้อน",

    paper:
      "✋ กระดาษ",

    scissors:
      "✌️ กรรไกร",
  };

type GuessState = {
  target:
    number;

  attempts:
    number;

  maxAttempts:
    number;
};

type TicTacToeState = {
  board:
    string[];
};

type ReactionState = {
  targetIndex:
    number;

  readyAt:
    number;
};

async function ensureStats(
  guildId:
    string,

  userId:
    string,
) {
  return MiniGameStats
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
  await MiniGameSession
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

async function ensureNoActiveSession(
  guildId:
    string,

  userId:
    string,
) {
  await recoverSession(
    guildId,
    userId,
  );

  const existing =
    await MiniGameSession
      .findOne({
        guildId,
        userId,

        status: {
          $in: [
            "active",
            "processing",
          ],
        },
      });

  if (existing) {
    throw new Error(
      `คุณมีเกม ${GAME_NAMES[existing.game as MiniGame]} ที่กำลังเล่นอยู่ กรุณากด เล่นต่อ หรือ ออกจากเกม ก่อน`,
    );
  }
}

async function saveNewSession(
  guildId:
    string,

  userId:
    string,

  game:
    MiniGame,

  state:
    Record<
      string,
      unknown
    >,
) {
  return MiniGameSession
    .findOneAndUpdate(
      {
        guildId,
        userId,
      },
      {
        $set: {
          game,

          status:
            "active",

          state,

          startedAt:
            new Date(),

          finishedAt:
            null,

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

async function claimSession(
  guildId:
    string,

  userId:
    string,

  game:
    MiniGame,
) {
  await recoverSession(
    guildId,
    userId,
  );

  return MiniGameSession
    .findOneAndUpdate(
      {
        guildId,
        userId,
        game,

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
        new: true,
      },
    );
}

async function restoreClaim(
  session:
    any,
) {
  await MiniGameSession
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
}

function homeButton() {
  return new ButtonBuilder()
    .setCustomId(
      `${MINIGAME_PREFIX}home`,
    )
    .setLabel(
      "หน้าหลัก",
    )
    .setEmoji(
      "🏠",
    )
    .setStyle(
      ButtonStyle.Secondary,
    );
}

function resultButtons(
  game:
    MiniGame,
) {
  return new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${MINIGAME_PREFIX}start:${game}`,
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
          `${MINIGAME_PREFIX}stats`,
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

      homeButton(),
    );
}

export function resolveRps(
  user:
    RpsChoice,

  bot:
    RpsChoice,
):
  | "win"
  | "loss"
  | "draw" {
  if (
    user ===
    bot
  ) {
    return "draw";
  }

  if (
    (
      user ===
        "rock" &&
      bot ===
        "scissors"
    ) ||
    (
      user ===
        "paper" &&
      bot ===
        "rock"
    ) ||
    (
      user ===
        "scissors" &&
      bot ===
        "paper"
    )
  ) {
    return "win";
  }

  return "loss";
}

function isRpsChoice(
  value:
    string,
): value is
  RpsChoice {
  return (
    value ===
      "rock" ||
    value ===
      "paper" ||
    value ===
      "scissors"
  );
}

function rpsPayload(
  session:
    any,

  notice?:
    string,
) {
  const active =
    session.status ===
    "active";

  const state =
    session.state as
      {
        userChoice?:
          RpsChoice;

        botChoice?:
          RpsChoice;

        result?:
          string;
      };

  let description =
    "เลือก ค้อน กระดาษ หรือกรรไกร";

  if (!active) {
    description = [
      `คุณ: **${RPS_NAMES[state.userChoice!] ?? "-"}**`,
      `NEXORA: **${RPS_NAMES[state.botChoice!] ?? "-"}**`,
      "",
      session.status ===
        "won"
        ? "🏆 **คุณชนะ!**"
        : session.status ===
            "draw"
          ? "🤝 **เสมอ!**"
          : "🤖 **NEXORA ชนะ!**",
    ].join(
      "\n",
    );
  }

  return {
    content:
      notice ??
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
          "✊ เป่ายิ้งฉุบ",
        )
        .setDescription(
          description,
        )
        .setFooter({
          text:
            "คุณ vs NEXORA",
        }),
    ],

    components:
      active
        ? [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `${MINIGAME_PREFIX}rps:rock`,
                  )
                  .setLabel(
                    "ค้อน",
                  )
                  .setEmoji(
                    "✊",
                  )
                  .setStyle(
                    ButtonStyle.Primary,
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `${MINIGAME_PREFIX}rps:paper`,
                  )
                  .setLabel(
                    "กระดาษ",
                  )
                  .setEmoji(
                    "✋",
                  )
                  .setStyle(
                    ButtonStyle.Primary,
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `${MINIGAME_PREFIX}rps:scissors`,
                  )
                  .setLabel(
                    "กรรไกร",
                  )
                  .setEmoji(
                    "✌️",
                  )
                  .setStyle(
                    ButtonStyle.Primary,
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `${MINIGAME_PREFIX}end`,
                  )
                  .setLabel(
                    "ออก",
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
            resultButtons(
              "rps",
            ),
          ],
  };
}

function guessPayload(
  session:
    any,

  notice?:
    string,
) {
  const state =
    session.state as
      GuessState;

  const active =
    session.status ===
    "active";

  if (!active) {
    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            session.status ===
              "won"
              ? 0x2ecc71
              : 0xe74c3c,
          )
          .setTitle(
            "🔢 Guess Number",
          )
          .setDescription(
            [
              notice,
              "",
              session.status ===
                "won"
                ? `🏆 **ทายถูก!** เลขคือ **${state.target}**`
                : `💀 หมดโอกาสแล้ว • เลขคือ **${state.target}**`,
              "",
              `ใช้ไป **${state.attempts}/${state.maxAttempts}** ครั้ง`,
            ]
              .filter(
                (
                  value,
                ) =>
                  value !==
                  undefined &&
                  value !==
                  null,
              )
              .join(
                "\n",
              ),
          ),
      ],

      components: [
        resultButtons(
          "guess",
        ),
      ],
    };
  }

  const select =
    new StringSelectMenuBuilder()
      .setCustomId(
        `${MINIGAME_PREFIX}guess_select`,
      )
      .setPlaceholder(
        "เลือกเลข 1–20",
      )
      .setMinValues(
        1,
      )
      .setMaxValues(
        1,
      )
      .addOptions(
        ...Array.from(
          {
            length:
              20,
          },
          (
            _,
            index,
          ) => ({
            label:
              String(
                index +
                1,
              ),

            value:
              String(
                index +
                1,
              ),

            description:
              `เดาเลข ${index + 1}`,
          }),
        ),
      );

  return {
    content:
      notice ??
      null,

    embeds: [
      new EmbedBuilder()
        .setColor(
          0x3498db,
        )
        .setTitle(
          "🔢 Guess Number",
        )
        .setDescription(
          [
            "NEXORA เลือกเลขลับระหว่าง **1–20**",
            "คุณมีโอกาส **5 ครั้ง**",
            "",
            `🎯 Attempts: **${state.attempts}/${state.maxAttempts}**`,
          ].join(
            "\n",
          ),
        )
        .setFooter({
          text:
            "ระบบจะบอกว่าสูงไปหรือต่ำไป",
        }),
    ],

    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          select,
        ),

      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${MINIGAME_PREFIX}end`,
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
    ],
  };
}

export function getTicTacToeWinner(
  board:
    string[],
):
  | "X"
  | "O"
  | "draw"
  | null {
  const lines =
    [
      [
        0,
        1,
        2,
      ],

      [
        3,
        4,
        5,
      ],

      [
        6,
        7,
        8,
      ],

      [
        0,
        3,
        6,
      ],

      [
        1,
        4,
        7,
      ],

      [
        2,
        5,
        8,
      ],

      [
        0,
        4,
        8,
      ],

      [
        2,
        4,
        6,
      ],
    ];

  for (
    const [
      first,
      second,
      third,
    ] of
    lines
  ) {
    const mark =
      board[
        first!
      ];

    if (
      mark &&
      mark ===
        board[
          second!
        ] &&
      mark ===
        board[
          third!
        ]
    ) {
      return mark as
        | "X"
        | "O";
    }
  }

  if (
    board.every(
      (
        value,
      ) =>
        value !==
        "",
    )
  ) {
    return "draw";
  }

  return null;
}

function findWinningMove(
  board:
    string[],

  mark:
    "X"
    | "O",
):
  number |
  null {
  for (
    let index =
      0;
    index <
      board.length;
    index++
  ) {
    if (
      board[index] !==
      ""
    ) {
      continue;
    }

    const test =
      [
        ...board,
      ];

    test[index] =
      mark;

    if (
      getTicTacToeWinner(
        test,
      ) ===
      mark
    ) {
      return index;
    }
  }

  return null;
}

export function chooseTicTacToeBotMove(
  board:
    string[],
):
  number |
  null {
  const winning =
    findWinningMove(
      board,
      "O",
    );

  if (
    winning !==
    null
  ) {
    return winning;
  }

  const blocking =
    findWinningMove(
      board,
      "X",
    );

  if (
    blocking !==
    null
  ) {
    return blocking;
  }

  if (
    board[4] ===
    ""
  ) {
    return 4;
  }

  const corners =
    [
      0,
      2,
      6,
      8,
    ].filter(
      (
        index,
      ) =>
        board[
          index
        ] ===
        "",
    );

  if (
    corners.length >
    0
  ) {
    return corners[
      randomInt(
        corners.length,
      )
    ]!;
  }

  const remaining =
    board
      .map(
        (
          value,
          index,
        ) =>
          value ===
            ""
            ? index
            : -1,
      )
      .filter(
        (
          index,
        ) =>
          index >=
          0,
      );

  if (
    remaining.length ===
    0
  ) {
    return null;
  }

  return remaining[
    randomInt(
      remaining.length,
    )
  ]!;
}

function ticTacToePayload(
  session:
    any,

  notice?:
    string,
) {
  const state =
    session.state as
      TicTacToeState;

  const active =
    session.status ===
    "active";

  const rows:
    ActionRowBuilder<ButtonBuilder>[] =
      [];

  for (
    let row =
      0;
    row <
      3;
    row++
  ) {
    const actionRow =
      new ActionRowBuilder<ButtonBuilder>();

    for (
      let column =
        0;
      column <
        3;
      column++
    ) {
      const index =
        row *
          3 +
        column;

      const mark =
        state.board[
          index
        ] ??
        "";

      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(
            `${MINIGAME_PREFIX}ttt:${index}`,
          )
          .setLabel(
            mark ===
              "X"
              ? "❌"
              : mark ===
                  "O"
                ? "⭕"
                : "·",
          )
          .setStyle(
            mark ===
              "X"
              ? ButtonStyle.Danger
              : mark ===
                  "O"
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary,
          )
          .setDisabled(
            !active ||
            mark !==
              "",
          ),
      );
    }

    rows.push(
      actionRow,
    );
  }

  if (active) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${MINIGAME_PREFIX}end`,
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
    );
  } else {
    rows.push(
      resultButtons(
        "tictactoe",
      ),
    );
  }

  const result =
    session.status ===
      "won"
      ? "🏆 **คุณชนะ NEXORA!**"
      : session.status ===
          "lost"
        ? "🤖 **NEXORA ชนะ!**"
        : session.status ===
            "draw"
          ? "🤝 **เสมอ!**"
          : "คุณคือ ❌ • NEXORA คือ ⭕";

  return {
    content:
      notice ??
      null,

    embeds: [
      new EmbedBuilder()
        .setColor(
          active
            ? 0x9b59b6
            : session.status ===
                "won"
              ? 0x2ecc71
              : session.status ===
                  "draw"
                ? 0xf1c40f
                : 0xe74c3c,
        )
        .setTitle(
          "⭕ Tic-Tac-Toe",
        )
        .setDescription(
          result,
        )
        .setFooter({
          text:
            "คุณเดินก่อน",
        }),
    ],

    components:
      rows,
  };
}

function reactionPayload(
  session:
    any,

  notice?:
    string,
) {
  const state =
    session.state as
      ReactionState;

  const active =
    session.status ===
    "active";

  if (!active) {
    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            session.status ===
              "won"
              ? 0x2ecc71
              : 0xe74c3c,
          )
          .setTitle(
            "⚡ Reaction Tap",
          )
          .setDescription(
            notice ??
            (
              session.status ===
                "won"
                ? "✅ กดถูกเป้าหมาย"
                : "❌ กดผิดเป้าหมาย"
            ),
          ),
      ],

      components: [
        resultButtons(
          "reaction",
        ),
      ],
    };
  }

  const row =
    new ActionRowBuilder<ButtonBuilder>();

  for (
    let index =
      0;
    index <
      5;
    index++
  ) {
    const target =
      index ===
      state.targetIndex;

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `${MINIGAME_PREFIX}reaction:${index}`,
        )
        .setLabel(
          target
            ? "⚡"
            : "○",
        )
        .setStyle(
          target
            ? ButtonStyle.Success
            : ButtonStyle.Secondary,
        ),
    );
  }

  return {
    content:
      notice ??
      null,

    embeds: [
      new EmbedBuilder()
        .setColor(
          0xf1c40f,
        )
        .setTitle(
          "⚡ Reaction Tap",
        )
        .setDescription(
          [
            "กดปุ่ม **⚡** ให้เร็วที่สุด!",
            "",
            "อย่ากดปุ่ม ○",
          ].join(
            "\n",
          ),
        )
        .setFooter({
          text:
            "เวลาวัดจากตอนสร้างโจทย์จนถึงตอนกด",
        }),
    ],

    components: [
      row,

      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${MINIGAME_PREFIX}end`,
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
    ],
  };
}

export const miniGameService = {
  isGame(
    value:
      string,
  ): value is
    MiniGame {
    return (
      value ===
        "rps" ||
      value ===
        "guess" ||
      value ===
        "tictactoe" ||
      value ===
        "reaction"
    );
  },

  isRpsChoice,

  buildPanel() {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(
            0x5865f2,
          )
          .setTitle(
            "🎮 NEXORA • Mini Games",
          )
          .setDescription(
            [
              "เกมสั้น ๆ เล่นกับ NEXORA ผ่านปุ่มได้ทันที",
              "",
              "✊ **เป่ายิ้งฉุบ**",
              "คุณ vs NEXORA",
              "",
              "🔢 **Guess Number**",
              "ทายเลขลับ 1–20 ภายใน 5 ครั้ง",
              "",
              "⭕ **Tic-Tac-Toe**",
              "เล่น XO กับ NEXORA",
              "",
              "⚡ **Reaction Tap**",
              "กดเป้าหมายให้เร็วที่สุด",
              "",
              "📊 ทุกเกมมีสถิติถาวร",
              "💠 ไม่มีการเดิมพันหรือรางวัล NEXO",
            ].join(
              "\n",
            ),
          )
          .setFooter({
            text:
              "NEXORA Mini Games",
          })
          .setTimestamp(),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${MINIGAME_PREFIX}home`,
              )
              .setLabel(
                "เปิด Mini Games",
              )
              .setEmoji(
                "🎮",
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
      await MiniGameSession
        .findOne({
          guildId,
          userId,
        });

    const active =
      session?.status ===
      "active";

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
            "🎮 NEXORA Mini Games",
          )
          .setDescription(
            [
              active
                ? `▶️ มีเกม **${GAME_NAMES[session.game as MiniGame]}** ที่เล่นค้างอยู่`
                : "เลือกมินิเกมได้เลย",
              "",
              "✊ เป่ายิ้งฉุบ",
              "🔢 ทายเลข 1–20",
              "⭕ Tic-Tac-Toe",
              "⚡ Reaction Tap",
            ].join(
              "\n",
            ),
          ),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${MINIGAME_PREFIX}start:rps`,
              )
              .setLabel(
                "เป่ายิ้งฉุบ",
              )
              .setEmoji(
                "✊",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${MINIGAME_PREFIX}start:guess`,
              )
              .setLabel(
                "ทายเลข",
              )
              .setEmoji(
                "🔢",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${MINIGAME_PREFIX}start:tictactoe`,
              )
              .setLabel(
                "Tic-Tac-Toe",
              )
              .setEmoji(
                "⭕",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${MINIGAME_PREFIX}start:reaction`,
              )
              .setLabel(
                "Reaction",
              )
              .setEmoji(
                "⚡",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),
          ),

        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${MINIGAME_PREFIX}resume`,
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
                `${MINIGAME_PREFIX}stats`,
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
      await MiniGameSession
        .findOne({
          guildId,
          userId,

          status:
            "active",
        });

    if (!session) {
      throw new Error(
        "ไม่มี Mini Game ที่กำลังเล่นอยู่",
      );
    }

    switch (
      session.game
    ) {
      case "rps":
        return rpsPayload(
          session,
        );

      case "guess":
        return guessPayload(
          session,
        );

      case "tictactoe":
        return ticTacToePayload(
          session,
        );

      case "reaction":
        return reactionPayload(
          session,
        );

      default:
        throw new Error(
          "ไม่พบ Mini Game นี้",
        );
    }
  },

  async start(
    guildId:
      string,

    userId:
      string,

    game:
      MiniGame,
  ) {
    await ensureNoActiveSession(
      guildId,
      userId,
    );

    await ensureStats(
      guildId,
      userId,
    );

    if (
      game ===
      "rps"
    ) {
      const session =
        await saveNewSession(
          guildId,
          userId,
          game,
          {},
        );

      await MiniGameStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              "rps.played":
                1,
            },
          },
        );

      return rpsPayload(
        session,
      );
    }

    if (
      game ===
      "guess"
    ) {
      const state:
        GuessState = {
          target:
            randomInt(
              1,
              21,
            ),

          attempts:
            0,

          maxAttempts:
            5,
        };

      const session =
        await saveNewSession(
          guildId,
          userId,
          game,
          state,
        );

      await MiniGameStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              "guess.played":
                1,
            },
          },
        );

      return guessPayload(
        session,
      );
    }

    if (
      game ===
      "tictactoe"
    ) {
      const session =
        await saveNewSession(
          guildId,
          userId,
          game,
          {
            board:
              Array(
                9,
              ).fill(
                "",
              ),
          },
        );

      await MiniGameStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              "tictactoe.played":
                1,
            },
          },
        );

      return ticTacToePayload(
        session,
      );
    }

    const state:
      ReactionState = {
        targetIndex:
          randomInt(
            5,
          ),

        readyAt:
          Date.now(),
      };

    const session =
      await saveNewSession(
        guildId,
        userId,
        "reaction",
        state,
      );

    await MiniGameStats
      .updateOne(
        {
          guildId,
          userId,
        },
        {
          $inc: {
            "reaction.played":
              1,
          },
        },
      );

    return reactionPayload(
      session,
    );
  },

  async rps(
    guildId:
      string,

    userId:
      string,

    choice:
      RpsChoice,
  ) {
    const session =
      await claimSession(
        guildId,
        userId,
        "rps",
      );

    if (!session) {
      throw new Error(
        "ไม่มีเกมเป่ายิ้งฉุบที่รอรับคำสั่ง",
      );
    }

    try {
      const choices:
        RpsChoice[] = [
          "rock",
          "paper",
          "scissors",
        ];

      const botChoice =
        choices[
          randomInt(
            choices.length,
          )
        ]!;

      const result =
        resolveRps(
          choice,
          botChoice,
        );

      session.status =
        result ===
          "win"
          ? "won"
          : result ===
              "loss"
            ? "lost"
            : "draw";

      session.finishedAt =
        new Date();

      session.processingStartedAt =
        null;

      session.set(
        "state",
        {
          userChoice:
            choice,

          botChoice,

          result,
        },
      );

      await session.save();

      await MiniGameStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              [`rps.${
                result ===
                  "win"
                  ? "wins"
                  : result ===
                      "loss"
                    ? "losses"
                    : "draws"
              }`]:
                1,
            },
          },
        );

      return rpsPayload(
        session,
      );
    } catch (error) {
      await restoreClaim(
        session,
      );

      throw error;
    }
  },

  async guess(
    guildId:
      string,

    userId:
      string,

    value:
      number,
  ) {
    if (
      value <
        1 ||
      value >
        20
    ) {
      throw new Error(
        "เลขต้องอยู่ระหว่าง 1–20",
      );
    }

    const session =
      await claimSession(
        guildId,
        userId,
        "guess",
      );

    if (!session) {
      throw new Error(
        "ไม่มีเกมทายเลขที่รอรับคำสั่ง",
      );
    }

    try {
      const state =
        session.state as
          GuessState;

      state.attempts +=
        1;

      await MiniGameStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              "guess.totalAttempts":
                1,
            },
          },
        );

      if (
        value ===
        state.target
      ) {
        session.status =
          "won";

        session.finishedAt =
          new Date();

        session.processingStartedAt =
          null;

        session.set(
          "state",
          state,
        );

        await session.save();

        await MiniGameStats
          .updateOne(
            {
              guildId,
              userId,
            },
            {
              $inc: {
                "guess.wins":
                  1,
              },

              $min: {
                "guess.bestAttempts":
                  state.attempts,
              },
            },
          );

        return guessPayload(
          session,
          `🎯 คุณเลือก **${value}**`,
        );
      }

      if (
        state.attempts >=
        state.maxAttempts
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

        await MiniGameStats
          .updateOne(
            {
              guildId,
              userId,
            },
            {
              $inc: {
                "guess.losses":
                  1,
              },
            },
          );

        return guessPayload(
          session,
          `❌ คุณเลือก **${value}**`,
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

      return guessPayload(
        session,
        value <
          state.target
          ? `⬆️ **${value} ต่ำไป** • ลองเลขที่สูงกว่านี้`
          : `⬇️ **${value} สูงไป** • ลองเลขที่ต่ำกว่านี้`,
      );
    } catch (error) {
      await restoreClaim(
        session,
      );

      throw error;
    }
  },

  async ticTacToeMove(
    guildId:
      string,

    userId:
      string,

    index:
      number,
  ) {
    if (
      index <
        0 ||
      index >
        8
    ) {
      throw new Error(
        "ตำแหน่งไม่ถูกต้อง",
      );
    }

    const session =
      await claimSession(
        guildId,
        userId,
        "tictactoe",
      );

    if (!session) {
      throw new Error(
        "ไม่มี Tic-Tac-Toe ที่รอรับคำสั่ง",
      );
    }

    try {
      const state =
        session.state as
          TicTacToeState;

      if (
        state.board[
          index
        ] !==
        ""
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

        return ticTacToePayload(
          session,
          "⚠️ ช่องนี้ถูกเลือกไปแล้ว",
        );
      }

      state.board[
        index
      ] =
        "X";

      let result =
        getTicTacToeWinner(
          state.board,
        );

      if (
        result ===
        "X"
      ) {
        session.status =
          "won";
      } else if (
        result ===
        "draw"
      ) {
        session.status =
          "draw";
      } else {
        const botMove =
          chooseTicTacToeBotMove(
            state.board,
          );

        if (
          botMove !==
          null
        ) {
          state.board[
            botMove
          ] =
            "O";
        }

        result =
          getTicTacToeWinner(
            state.board,
          );

        if (
          result ===
          "O"
        ) {
          session.status =
            "lost";
        } else if (
          result ===
          "draw"
        ) {
          session.status =
            "draw";
        } else {
          session.status =
            "active";
        }
      }

      session.processingStartedAt =
        null;

      if (
        session.status !==
        "active"
      ) {
        session.finishedAt =
          new Date();
      }

      session.set(
        "state",
        state,
      );

      await session.save();

      if (
        session.status !==
        "active"
      ) {
        await MiniGameStats
          .updateOne(
            {
              guildId,
              userId,
            },
            {
              $inc: {
                [`tictactoe.${
                  session.status ===
                    "won"
                    ? "wins"
                    : session.status ===
                        "lost"
                      ? "losses"
                      : "draws"
                }`]:
                  1,
              },
            },
          );
      }

      return ticTacToePayload(
        session,
      );
    } catch (error) {
      await restoreClaim(
        session,
      );

      throw error;
    }
  },

  async reaction(
    guildId:
      string,

    userId:
      string,

    index:
      number,
  ) {
    if (
      index <
        0 ||
      index >
        4
    ) {
      throw new Error(
        "Reaction target ไม่ถูกต้อง",
      );
    }

    const session =
      await claimSession(
        guildId,
        userId,
        "reaction",
      );

    if (!session) {
      throw new Error(
        "ไม่มี Reaction Game ที่รอรับคำสั่ง",
      );
    }

    try {
      const state =
        session.state as
          ReactionState;

      const elapsed =
        Math.max(
          0,
          Date.now() -
          Number(
            state.readyAt,
          ),
        );

      const correct =
        index ===
        state.targetIndex;

      session.status =
        correct
          ? "won"
          : "lost";

      session.finishedAt =
        new Date();

      session.processingStartedAt =
        null;

      session.set(
        "state",
        state,
      );

      await session.save();

      if (correct) {
        await MiniGameStats
          .updateOne(
            {
              guildId,
              userId,
            },
            {
              $inc: {
                "reaction.hits":
                  1,
              },

              $min: {
                "reaction.bestMs":
                  elapsed,
              },
            },
          );

        return reactionPayload(
          session,
          `⚡ **ถูกต้อง!** Response Time: **${elapsed.toLocaleString()} ms**`,
        );
      }

      await MiniGameStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              "reaction.misses":
                1,
            },
          },
        );

      return reactionPayload(
        session,
        `❌ กดผิดปุ่ม • เป้าหมายอยู่ช่อง **${state.targetIndex + 1}**`,
      );
    } catch (error) {
      await restoreClaim(
        session,
      );

      throw error;
    }
  },

  async end(
    guildId:
      string,

    userId:
      string,
  ) {
    const session =
      await MiniGameSession
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
            new: true,
          },
        );

    if (!session) {
      throw new Error(
        "ไม่มี Mini Game ที่กำลังเล่นอยู่",
      );
    }

    return this.home(
      guildId,
      userId,
      "🚪 ออกจาก Mini Game แล้ว",
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

    const rps =
      stats.rps ??
      {};

    const guess =
      stats.guess ??
      {};

    const ttt =
      stats.tictactoe ??
      {};

    const reaction =
      stats.reaction ??
      {};

    const bestAttempts =
      Number(
        guess.bestAttempts ??
        999,
      );

    const bestMs =
      Number(
        reaction.bestMs ??
        999999,
      );

    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0x5865f2,
          )
          .setTitle(
            "📊 Mini Game Stats",
          )
          .addFields(
            {
              name:
                "✊ เป่ายิ้งฉุบ",

              value: [
                `เล่น **${Number(rps.played ?? 0).toLocaleString()}**`,
                `ชนะ **${Number(rps.wins ?? 0).toLocaleString()}**`,
                `แพ้ **${Number(rps.losses ?? 0).toLocaleString()}**`,
                `เสมอ **${Number(rps.draws ?? 0).toLocaleString()}**`,
              ].join(
                "\n",
              ),

              inline:
                true,
            },

            {
              name:
                "🔢 ทายเลข",

              value: [
                `เล่น **${Number(guess.played ?? 0).toLocaleString()}**`,
                `ชนะ **${Number(guess.wins ?? 0).toLocaleString()}**`,
                `แพ้ **${Number(guess.losses ?? 0).toLocaleString()}**`,
                `Best **${bestAttempts >= 999 ? "-" : `${bestAttempts} ครั้ง`}**`,
              ].join(
                "\n",
              ),

              inline:
                true,
            },

            {
              name:
                "⭕ Tic-Tac-Toe",

              value: [
                `เล่น **${Number(ttt.played ?? 0).toLocaleString()}**`,
                `ชนะ **${Number(ttt.wins ?? 0).toLocaleString()}**`,
                `แพ้ **${Number(ttt.losses ?? 0).toLocaleString()}**`,
                `เสมอ **${Number(ttt.draws ?? 0).toLocaleString()}**`,
              ].join(
                "\n",
              ),

              inline:
                true,
            },

            {
              name:
                "⚡ Reaction",

              value: [
                `เล่น **${Number(reaction.played ?? 0).toLocaleString()}**`,
                `ถูก **${Number(reaction.hits ?? 0).toLocaleString()}**`,
                `พลาด **${Number(reaction.misses ?? 0).toLocaleString()}**`,
                `Best **${bestMs >= 999999 ? "-" : `${bestMs.toLocaleString()} ms`}**`,
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
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            homeButton(),
          ),
      ],
    };
  },
};
