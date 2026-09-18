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
  PuzzleSession,
} from "../models/PuzzleSession.js";

import {
  PuzzleStats,
} from "../models/PuzzleStats.js";

export type PuzzleGame =
  | "sequence"
  | "riddle"
  | "logic";

export type PuzzleQuestion = {
  id:
    string;

  prompt:
    string;

  options:
    string[];

  correctIndex:
    number;

  hint:
    string;

  explanation:
    string;
};

export const PUZZLE_PREFIX =
  "nexora_puzzle:";

const MAX_ROUNDS =
  5;

const GAME_DATA:
  Record<
    PuzzleGame,
    {
      name:
        string;

      emoji:
        string;

      description:
        string;
    }
  > = {
    sequence: {
      name:
        "ลำดับตัวเลข",

      emoji:
        "🔢",

      description:
        "หาตัวเลขตัวถัดไปจากรูปแบบของลำดับ",
    },

    riddle: {
      name:
        "ปริศนาคำทาย",

      emoji:
        "❓",

      description:
        "แก้คำทายจากคำใบ้",
    },

    logic: {
      name:
        "ตรรกะ",

      emoji:
        "🧠",

      description:
        "โจทย์คิดวิเคราะห์และเหตุผล",
    },
  };

const RIDDLES:
  PuzzleQuestion[] = [
    {
      id:
        "riddle-shadow",

      prompt:
        "อะไรเอ่ย ตามเราไปทุกที่ แต่จับต้องไม่ได้?",

      options: [
        "เงา",
        "ลม",
        "เสียง",
        "เวลา",
      ],

      correctIndex:
        0,

      hint:
        "มักเห็นชัดเมื่อมีแสง",

      explanation:
        "คำตอบคือ **เงา** เพราะมันเคลื่อนตามเราเมื่อมีแสง",
    },

    {
      id:
        "riddle-hole",

      prompt:
        "อะไรเอ่ย ยิ่งเอาออก ยิ่งใหญ่ขึ้น?",

      options: [
        "กล่อง",
        "หลุม",
        "กระเป๋า",
        "ลูกโป่ง",
      ],

      correctIndex:
        1,

      hint:
        "เกิดจากการขุดสิ่งออกไป",

      explanation:
        "คำตอบคือ **หลุม** เพราะยิ่งขุดดินออก หลุมก็ยิ่งใหญ่",
    },

    {
      id:
        "riddle-clock",

      prompt:
        "อะไรเอ่ย มีหน้าแต่ไม่มีตา มีมือแต่ไม่มีแขน?",

      options: [
        "นาฬิกา",
        "หุ่นยนต์",
        "หนังสือ",
        "โทรศัพท์",
      ],

      correctIndex:
        0,

      hint:
        "ใช้บอกเวลา",

      explanation:
        "คำตอบคือ **นาฬิกา** มีหน้าปัดและเข็มนาฬิกา",
    },

    {
      id:
        "riddle-towel",

      prompt:
        "อะไรเอ่ย ยิ่งเช็ดก็ยิ่งเปียก?",

      options: [
        "กระดาษ",
        "ผ้าเช็ดตัว",
        "พื้น",
        "แก้วน้ำ",
      ],

      correctIndex:
        1,

      hint:
        "ใช้หลังอาบน้ำ",

      explanation:
        "คำตอบคือ **ผ้าเช็ดตัว** เพราะมันรับน้ำจากสิ่งที่เช็ด",
    },

    {
      id:
        "riddle-keyboard",

      prompt:
        "อะไรเอ่ย มีปุ่มมากมาย แต่เปิดประตูไม่ได้?",

      options: [
        "รีโมต",
        "คีย์บอร์ด",
        "ลิฟต์",
        "เครื่องคิดเลข",
      ],

      correctIndex:
        1,

      hint:
        "ใช้พิมพ์ข้อความ",

      explanation:
        "คำตอบคือ **คีย์บอร์ด** มีปุ่มจำนวนมากแต่ไม่ใช่กุญแจ",
    },

    {
      id:
        "riddle-river",

      prompt:
        "อะไรเอ่ย วิ่งตลอดเวลาแต่ไม่มีขา?",

      options: [
        "แม่น้ำ",
        "รถ",
        "สุนัข",
        "คน",
      ],

      correctIndex:
        0,

      hint:
        "ไหลจากที่สูงไปที่ต่ำ",

      explanation:
        "คำตอบคือ **แม่น้ำ** เพราะน้ำไหลหรือ 'วิ่ง' อยู่ตลอด",
    },

    {
      id:
        "riddle-map",

      prompt:
        "อะไรเอ่ย มีเมืองแต่ไม่มีบ้าน มีป่าแต่ไม่มีต้นไม้?",

      options: [
        "หนังสือ",
        "แผนที่",
        "ภาพวาด",
        "เกม",
      ],

      correctIndex:
        1,

      hint:
        "ใช้สำหรับดูเส้นทาง",

      explanation:
        "คำตอบคือ **แผนที่** ซึ่งแสดงเมืองและป่าในรูปสัญลักษณ์",
    },

    {
      id:
        "riddle-echo",

      prompt:
        "อะไรเอ่ย พูดโดยไม่มีปาก และตอบเราได้โดยไม่มีหู?",

      options: [
        "เสียงสะท้อน",
        "วิทยุ",
        "โทรศัพท์",
        "นก",
      ],

      correctIndex:
        0,

      hint:
        "มักได้ยินในถ้ำหรือหุบเขา",

      explanation:
        "คำตอบคือ **เสียงสะท้อน**",
    },
  ];

const LOGIC:
  PuzzleQuestion[] = [
    {
      id:
        "logic-socks",

      prompt:
        "มีถุงเท้าดำ 3 คู่ และขาว 3 คู่ อยู่ในลิ้นชักมืด ต้องหยิบอย่างน้อยกี่ข้างจึงรับประกันว่าได้สีเดียวกัน 2 ข้าง?",

      options: [
        "2",
        "3",
        "4",
        "6",
      ],

      correctIndex:
        1,

      hint:
        "มีเพียง 2 สี ใช้หลัก Pigeonhole",

      explanation:
        "หยิบ **3 ข้าง** รับประกันว่าต้องมีอย่างน้อย 2 ข้างสีเดียวกัน",
    },

    {
      id:
        "logic-bats",

      prompt:
        "ไม้เบสบอลกับลูกบอลรวมราคา 110 บาท ไม้แพงกว่าลูกบอล 100 บาท ลูกบอลราคาเท่าไร?",

      options: [
        "5 บาท",
        "10 บาท",
        "15 บาท",
        "20 บาท",
      ],

      correctIndex:
        0,

      hint:
        "ถ้าลูกบอลราคา x บาท ไม้ราคา x + 100",

      explanation:
        "x + (x + 100) = 110 ดังนั้น x = **5 บาท**",
    },

    {
      id:
        "logic-machines",

      prompt:
        "เครื่องจักร 5 เครื่อง ผลิตของ 5 ชิ้นใน 5 นาที เครื่องจักร 100 เครื่องจะผลิตของ 100 ชิ้นในกี่นาที?",

      options: [
        "5 นาที",
        "20 นาที",
        "100 นาที",
        "500 นาที",
      ],

      correctIndex:
        0,

      hint:
        "แต่ละเครื่องผลิต 1 ชิ้นพร้อมกัน",

      explanation:
        "เครื่องแต่ละเครื่องใช้ **5 นาที** ต่อชิ้น ดังนั้น 100 เครื่องผลิต 100 ชิ้นพร้อมกันใน 5 นาที",
    },

    {
      id:
        "logic-months",

      prompt:
        "มีกี่เดือนที่มีอย่างน้อย 28 วัน?",

      options: [
        "1",
        "2",
        "11",
        "12",
      ],

      correctIndex:
        3,

      hint:
        "คำถามคือ 'อย่างน้อย' 28 วัน",

      explanation:
        "**12 เดือน** ทุกเดือนมีอย่างน้อย 28 วัน",
    },

    {
      id:
        "logic-race",

      prompt:
        "ในการวิ่งแข่ง ถ้าคุณแซงคนที่อยู่อันดับ 2 คุณจะขึ้นมาอยู่อันดับไหน?",

      options: [
        "อันดับ 1",
        "อันดับ 2",
        "อันดับ 3",
        "อันดับสุดท้าย",
      ],

      correctIndex:
        1,

      hint:
        "คุณเข้าแทนที่ตำแหน่งของคนที่ถูกแซง",

      explanation:
        "คุณจะขึ้นเป็น **อันดับ 2** ไม่ใช่อันดับ 1",
    },

    {
      id:
        "logic-father",

      prompt:
        "พ่อมีลูก 5 คน: Nana, Nene, Nini, Nono และคนสุดท้ายชื่ออะไร?",

      options: [
        "Nunu",
        "Nana",
        "ระบุไม่ได้",
        "Nono",
      ],

      correctIndex:
        2,

      hint:
        "โจทย์ไม่ได้บอกชื่อคนสุดท้ายจริง ๆ",

      explanation:
        "รูปแบบชื่ออาจชวนให้เดา แต่ข้อมูลไม่เพียงพอ ดังนั้น **ระบุไม่ได้**",
    },

    {
      id:
        "logic-cats",

      prompt:
        "แมว 3 ตัว จับหนู 3 ตัวใน 3 นาที ถ้าอัตราเท่าเดิม แมว 100 ตัวจะจับหนู 100 ตัวในกี่นาที?",

      options: [
        "3 นาที",
        "33 นาที",
        "100 นาที",
        "300 นาที",
      ],

      correctIndex:
        0,

      hint:
        "แมวแต่ละตัวทำงานพร้อมกัน",

      explanation:
        "แมวแต่ละตัวจับหนู 1 ตัวใน **3 นาที**",
    },

    {
      id:
        "logic-families",

      prompt:
        "คุณมีพี่ชาย 2 คน และพี่ชายแต่ละคนมีน้องสาว 1 คน ครอบครัวนี้มีลูกอย่างน้อยกี่คน?",

      options: [
        "3 คน",
        "4 คน",
        "5 คน",
        "6 คน",
      ],

      correctIndex:
        0,

      hint:
        "น้องสาวของพี่ชายทั้งสองอาจเป็นคนเดียวกัน",

      explanation:
        "มีพี่ชาย 2 คนและคุณซึ่งเป็นน้องสาวคนเดียวกัน รวมอย่างน้อย **3 คน**",
    },
  ];

function shuffled<T>(
  input:
    T[],
): T[] {
  const output =
    [
      ...input,
    ];

  for (
    let index =
      output.length -
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
      output[index],
      output[target],
    ] = [
      output[target]!,
      output[index]!,
    ];
  }

  return output;
}

function buildOptions(
  answer:
    number,
): {
  options:
    string[];

  correctIndex:
    number;
} {
  const candidates =
    new Set<number>([
      answer,
    ]);

  let guard =
    0;

  while (
    candidates.size <
      4 &&
    guard <
      100
  ) {
    guard +=
      1;

    const spread =
      Math.max(
        3,
        Math.ceil(
          Math.abs(
            answer,
          ) *
            0.25,
        ),
      );

    const candidate =
      answer +
      randomInt(
        -spread,
        spread +
          1,
      );

    if (
      candidate >=
      0
    ) {
      candidates.add(
        candidate,
      );
    }
  }

  let fallback =
    1;

  while (
    candidates.size <
    4
  ) {
    candidates.add(
      answer +
      fallback,
    );

    fallback +=
      1;
  }

  const options =
    shuffled(
      [
        ...candidates,
      ]
        .slice(
          0,
          4,
        )
        .map(
          String,
        ),
    );

  return {
    options,

    correctIndex:
      options.indexOf(
        String(
          answer,
        ),
      ),
  };
}

export function generateSequenceQuestion():
  PuzzleQuestion {
  const kind =
    randomInt(
      4,
    );

  if (
    kind ===
    0
  ) {
    const start =
      randomInt(
        1,
        21,
      );

    const step =
      randomInt(
        2,
        10,
      );

    const numbers =
      Array.from(
        {
          length:
            5,
        },
        (
          _,
          index,
        ) =>
          start +
          step *
            index,
      );

    const answer =
      start +
      step *
        5;

    const {
      options,
      correctIndex,
    } =
      buildOptions(
        answer,
      );

    return {
      id:
        `seq-add-${Date.now()}-${randomInt(1_000_000)}`,

      prompt:
        `${numbers.join(" → ")} → ?`,

      options,
      correctIndex,

      hint:
        "ดูผลต่างระหว่างตัวเลขแต่ละตัว",

      explanation:
        `เพิ่มทีละ **${step}** ดังนั้นคำตอบคือ **${answer}**`,
    };
  }

  if (
    kind ===
    1
  ) {
    const start =
      randomInt(
        1,
        6,
      );

    const multiplier =
      randomInt(
        2,
        4,
      );

    const numbers:
      number[] =
        [];

    let value =
      start;

    for (
      let index =
        0;
      index <
        5;
      index++
    ) {
      numbers.push(
        value,
      );

      value *=
        multiplier;
    }

    const answer =
      value;

    const {
      options,
      correctIndex,
    } =
      buildOptions(
        answer,
      );

    return {
      id:
        `seq-mul-${Date.now()}-${randomInt(1_000_000)}`,

      prompt:
        `${numbers.join(" → ")} → ?`,

      options,
      correctIndex,

      hint:
        "ลองหารตัวถัดไปด้วยตัวก่อนหน้า",

      explanation:
        `คูณ **${multiplier}** ทุกครั้ง ดังนั้นคำตอบคือ **${answer}**`,
    };
  }

  if (
    kind ===
    2
  ) {
    const start =
      randomInt(
        1,
        8,
      );

    const numbers:
      number[] =
        [
          start,
        ];

    let value =
      start;

    for (
      let step =
        1;
      step <=
        4;
      step++
    ) {
      value +=
        step;

      numbers.push(
        value,
      );
    }

    const answer =
      value +
      5;

    const {
      options,
      correctIndex,
    } =
      buildOptions(
        answer,
      );

    return {
      id:
        `seq-grow-${Date.now()}-${randomInt(1_000_000)}`,

      prompt:
        `${numbers.join(" → ")} → ?`,

      options,
      correctIndex,

      hint:
        "ผลต่างเพิ่มขึ้นทีละ 1",

      explanation:
        "ลำดับเพิ่ม +1, +2, +3, +4 และต่อไปคือ **+5** " +
        `ดังนั้นคำตอบคือ **${answer}**`,
    };
  }

  const base =
    randomInt(
      1,
      5,
    );

  const numbers =
    Array.from(
      {
        length:
          5,
      },
      (
        _,
        index,
      ) => {
        const value =
          base +
          index;

        return (
          value *
          value
        );
      },
    );

  const next =
    base +
    5;

  const answer =
    next *
    next;

  const {
    options,
    correctIndex,
  } =
    buildOptions(
      answer,
    );

  return {
    id:
      `seq-square-${Date.now()}-${randomInt(1_000_000)}`,

    prompt:
      `${numbers.join(" → ")} → ?`,

    options,
    correctIndex,

    hint:
      "ตัวเลขแต่ละตัวเป็นกำลังสองของจำนวนเต็มที่เรียงกัน",

    explanation:
      `ตัวถัดไปคือ **${next}² = ${answer}**`,
  };
}

function pickQuestion(
  game:
    PuzzleGame,

  used:
    string[],
): PuzzleQuestion {
  if (
    game ===
    "sequence"
  ) {
    return generateSequenceQuestion();
  }

  const bank =
    game ===
      "riddle"
      ? RIDDLES
      : LOGIC;

  const available =
    bank.filter(
      (
        question,
      ) =>
        !used.includes(
          question.id,
        ),
    );

  const source =
    available.length >
      0
      ? available
      : bank;

  return source[
    randomInt(
      source.length,
    )
  ]!;
}

function gameData(
  game:
    PuzzleGame,
) {
  return GAME_DATA[
    game
  ];
}

function isGame(
  value:
    string,
): value is
  PuzzleGame {
  return (
    value ===
      "sequence" ||
    value ===
      "riddle" ||
    value ===
      "logic"
  );
}

async function ensureStats(
  guildId:
    string,

  userId:
    string,
) {
  return PuzzleStats
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
        upsert:
          true,

        new:
          true,

        setDefaultsOnInsert:
          true,
      },
    );
}

async function recoverSession(
  guildId:
    string,

  userId:
    string,
) {
  await PuzzleSession
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

async function claimSession(
  guildId:
    string,

  userId:
    string,
) {
  await recoverSession(
    guildId,
    userId,
  );

  return PuzzleSession
    .findOneAndUpdate(
      {
        guildId,
        userId,

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
}

function homeButton() {
  return new ButtonBuilder()
    .setCustomId(
      `${PUZZLE_PREFIX}home`,
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

function questionPayload(
  session:
    any,

  notice?:
    string,
) {
  const question =
    session.currentQuestion as
      PuzzleQuestion;

  const game =
    gameData(
      session.game as
        PuzzleGame,
    );

  const optionButtons =
    question.options
      .slice(
        0,
        4,
      )
      .map(
        (
          option,
          index,
        ) =>
          new ButtonBuilder()
            .setCustomId(
              `${PUZZLE_PREFIX}answer:${index}`,
            )
            .setLabel(
              `${index + 1}. ${option}`.slice(
                0,
                80,
              ),
            )
            .setStyle(
              ButtonStyle.Primary,
            ),
      );

  const controls =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `${PUZZLE_PREFIX}hint`,
          )
          .setLabel(
            session.hintUsed
              ? "ใช้ Hint แล้ว"
              : "Hint",
          )
          .setEmoji(
            "💡",
          )
          .setStyle(
            ButtonStyle.Secondary,
          )
          .setDisabled(
            Boolean(
              session.hintUsed,
            ),
          ),

        new ButtonBuilder()
          .setCustomId(
            `${PUZZLE_PREFIX}end`,
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
      );

  return {
    content:
      notice ??
      null,

    embeds: [
      new EmbedBuilder()
        .setColor(
          0xf39c12,
        )
        .setTitle(
          `${game.emoji} ${game.name}`,
        )
        .setDescription(
          [
            `**ข้อ ${session.round}/${session.maxRounds}**`,
            "",
            question.prompt,
            session.hintUsed
              ? `\n💡 **Hint:** ${question.hint}`
              : null,
          ]
            .filter(
              Boolean,
            )
            .join(
              "\n",
            ),
        )
        .addFields(
          {
            name:
              "⭐ Score",

            value:
              String(
                session.score,
              ),

            inline:
              true,
          },

          {
            name:
              "🔥 Streak",

            value:
              String(
                session.streak,
              ),

            inline:
              true,
          },

          {
            name:
              "🏆 Best Streak",

            value:
              String(
                session.bestStreak,
              ),

            inline:
              true,
          },
        )
        .setFooter({
          text:
            session.hintUsed
              ? "ตอบถูกข้อนี้ได้ 1 คะแนน"
              : "ตอบถูกได้ 2 คะแนน • ใช้ Hint เหลือ 1 คะแนน",
        }),
    ],

    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          ...optionButtons,
        ),

      controls,
    ],
  };
}

function resultPayload(
  session:
    any,

  notice:
    string,
) {
  const game =
    gameData(
      session.game as
        PuzzleGame,
    );

  const maxScore =
    session.maxRounds *
    2;

  return {
    content:
      null,

    embeds: [
      new EmbedBuilder()
        .setColor(
          session.score >=
            maxScore *
              0.8
            ? 0x2ecc71
            : session.score >=
                maxScore *
                  0.5
              ? 0xf1c40f
              : 0xe67e22,
        )
        .setTitle(
          `🏁 ${game.name} • Complete`,
        )
        .setDescription(
          notice,
        )
        .addFields(
          {
            name:
              "⭐ Final Score",

            value:
              `**${session.score}/${maxScore}**`,

            inline:
              true,
          },

          {
            name:
              "🔥 Best Streak",

            value:
              `**${session.bestStreak}**`,

            inline:
              true,
          },

          {
            name:
              "🧩 จำนวนข้อ",

            value:
              `**${session.maxRounds}**`,

            inline:
              true,
          },
        )
        .setFooter({
          text:
            "NEXORA Puzzle",
        }),
    ],

    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${PUZZLE_PREFIX}start:${session.game}`,
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
              `${PUZZLE_PREFIX}stats`,
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
        ),
    ],
  };
}

export const puzzleService = {
  isGame,
  gameData,

  buildPanel() {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(
            0xf39c12,
          )
          .setTitle(
            "🧩 NEXORA • Puzzle Games",
          )
          .setDescription(
            [
              "ทดสอบสมองด้วยเกมแก้ปริศนา 3 รูปแบบ",
              "",
              "🔢 **ลำดับตัวเลข**",
              "หา Pattern และตัวเลขถัดไป",
              "",
              "❓ **ปริศนาคำทาย**",
              "ตีความคำใบ้และเลือกคำตอบ",
              "",
              "🧠 **ตรรกะ**",
              "โจทย์คิดวิเคราะห์และเหตุผล",
              "",
              "แต่ละเกมมี **5 ข้อ**",
              "ตอบถูก +2 คะแนน • ใช้ Hint แล้ว +1 คะแนน",
            ].join(
              "\n",
            ),
          )
          .setFooter({
            text:
              "NEXORA Puzzle • Interactive",
          })
          .setTimestamp(),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${PUZZLE_PREFIX}home`,
              )
              .setLabel(
                "เปิด Puzzle Games",
              )
              .setEmoji(
                "🧩",
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
      await PuzzleSession
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
            0xf39c12,
          )
          .setTitle(
            "🧩 NEXORA Puzzle",
          )
          .setDescription(
            [
              active
                ? `▶️ มีเกม **${gameData(session.game as PuzzleGame).name}** ที่เล่นค้างอยู่`
                : "เลือกเกมที่ต้องการเล่น",
              "",
              "🔢 **ลำดับตัวเลข**",
              "❓ **ปริศนาคำทาย**",
              "🧠 **ตรรกะ**",
              "",
              "หนึ่งรอบมี 5 ข้อ",
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
                `${PUZZLE_PREFIX}start:sequence`,
              )
              .setLabel(
                "ลำดับตัวเลข",
              )
              .setEmoji(
                "🔢",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${PUZZLE_PREFIX}start:riddle`,
              )
              .setLabel(
                "คำทาย",
              )
              .setEmoji(
                "❓",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${PUZZLE_PREFIX}start:logic`,
              )
              .setLabel(
                "ตรรกะ",
              )
              .setEmoji(
                "🧠",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${PUZZLE_PREFIX}resume`,
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
                `${PUZZLE_PREFIX}stats`,
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

  async start(
    guildId:
      string,

    userId:
      string,

    game:
      PuzzleGame,
  ) {
    await recoverSession(
      guildId,
      userId,
    );

    const existing =
      await PuzzleSession
        .findOne({
          guildId,
          userId,

          status:
            "active",
        });

    if (existing) {
      throw new Error(
        `มีเกม ${gameData(existing.game as PuzzleGame).name} ที่กำลังเล่นอยู่ กรุณากด เล่นต่อ หรือ ออกจากเกม ก่อน`,
      );
    }

    await ensureStats(
      guildId,
      userId,
    );

    const question =
      pickQuestion(
        game,
        [],
      );

    const session =
      await PuzzleSession
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

              round:
                1,

              maxRounds:
                MAX_ROUNDS,

              score:
                0,

              streak:
                0,

              bestStreak:
                0,

              hintUsed:
                false,

              usedQuestionIds:
                [
                  question.id,
                ],

              currentQuestion:
                question,

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
            upsert:
              true,

            new:
              true,

            setDefaultsOnInsert:
              true,
          },
        );

    await PuzzleStats
      .updateOne(
        {
          guildId,
          userId,
        },
        {
          $inc: {
            played:
              1,

            [`${game}.played`]:
              1,
          },
        },
      );

    return questionPayload(
      session,
    );
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
      await PuzzleSession
        .findOne({
          guildId,
          userId,

          status:
            "active",
        });

    if (!session) {
      throw new Error(
        "ไม่มี Puzzle ที่กำลังเล่นอยู่",
      );
    }

    return questionPayload(
      session,
    );
  },

  async hint(
    guildId:
      string,

    userId:
      string,
  ) {
    const session =
      await claimSession(
        guildId,
        userId,
      );

    if (!session) {
      throw new Error(
        "ไม่มี Puzzle ที่รอรับคำสั่ง",
      );
    }

    try {
      if (
        session.hintUsed
      ) {
        session.status =
          "active";

        session.processingStartedAt =
          null;

        await session.save();

        return questionPayload(
          session,
          "💡 คุณใช้ Hint สำหรับข้อนี้ไปแล้ว",
        );
      }

      session.hintUsed =
        true;

      session.status =
        "active";

      session.processingStartedAt =
        null;

      await session.save();

      await PuzzleStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc: {
              hints:
                1,
            },
          },
        );

      return questionPayload(
        session,
      );
    } catch (error) {
      await PuzzleSession
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

  async answer(
    guildId:
      string,

    userId:
      string,

    optionIndex:
      number,
  ) {
    if (
      optionIndex <
        0 ||
      optionIndex >
        3
    ) {
      throw new Error(
        "ตัวเลือกไม่ถูกต้อง",
      );
    }

    const session =
      await claimSession(
        guildId,
        userId,
      );

    if (!session) {
      throw new Error(
        "ไม่มี Puzzle ที่รอรับคำตอบ",
      );
    }

    try {
      const question =
        session.currentQuestion as
          PuzzleQuestion;

      if (
        optionIndex >=
        question.options.length
      ) {
        throw new Error(
          "ตัวเลือกไม่ถูกต้อง",
        );
      }

      const game =
        session.game as
          PuzzleGame;

      const correct =
        optionIndex ===
        question.correctIndex;

      const gained =
        correct
          ? session.hintUsed
            ? 1
            : 2
          : 0;

      session.score +=
        gained;

      if (correct) {
        session.streak +=
          1;

        session.bestStreak =
          Math.max(
            session.bestStreak,
            session.streak,
          );
      } else {
        session.streak =
          0;
      }

      const statsUpdate:
        Record<
          string,
          number
        > = {
          [correct
            ? "correct"
            : "wrong"]:
            1,

          [`${game}.${correct ? "correct" : "wrong"}`]:
            1,
        };

      await PuzzleStats
        .updateOne(
          {
            guildId,
            userId,
          },
          {
            $inc:
              statsUpdate,

            $max: {
              bestStreak:
                session.bestStreak,
            },
          },
        );

      const answerText =
        correct
          ? `✅ **ถูกต้อง!** +${gained} คะแนน`
          : `❌ **ยังไม่ถูก** • คำตอบคือ **${question.options[question.correctIndex]}**`;

      const explanation =
        `${answerText}\n${question.explanation}`;

      if (
        session.round >=
        session.maxRounds
      ) {
        session.status =
          "completed";

        session.finishedAt =
          new Date();

        session.processingStartedAt =
          null;

        await session.save();

        await PuzzleStats
          .updateOne(
            {
              guildId,
              userId,
            },
            {
              $inc: {
                completed:
                  1,

                [`${game}.completed`]:
                  1,
              },

              $max: {
                bestScore:
                  session.score,

                bestStreak:
                  session.bestStreak,
              },
            },
          );

        return resultPayload(
          session,
          explanation,
        );
      }

      session.round +=
        1;

      const next =
        pickQuestion(
          game,
          session.usedQuestionIds ??
            [],
        );

      session.usedQuestionIds =
        [
          ...(
            session.usedQuestionIds ??
            []
          ),
          next.id,
        ];

      session.currentQuestion =
        next;

      session.hintUsed =
        false;

      session.status =
        "active";

      session.processingStartedAt =
        null;

      session.markModified(
        "currentQuestion",
      );

      await session.save();

      return questionPayload(
        session,
        explanation,
      );
    } catch (error) {
      await PuzzleSession
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

  async end(
    guildId:
      string,

    userId:
      string,
  ) {
    const session =
      await PuzzleSession
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
        "ไม่มี Puzzle ที่กำลังเล่นอยู่",
      );
    }

    return this.home(
      guildId,
      userId,
      "🚪 ออกจาก Puzzle แล้ว",
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

    const modes:
      PuzzleGame[] = [
        "sequence",
        "riddle",
        "logic",
      ];

    const fields =
      modes.map(
        (
          game,
        ) => {
          const data =
            stats[
              game
            ] ??
            {};

          const meta =
            gameData(
              game,
            );

          return {
            name:
              `${meta.emoji} ${meta.name}`,

            value: [
              `เล่น **${Number(data.played ?? 0).toLocaleString()}**`,
              `จบเกม **${Number(data.completed ?? 0).toLocaleString()}**`,
              `ถูก **${Number(data.correct ?? 0).toLocaleString()}**`,
              `ผิด **${Number(data.wrong ?? 0).toLocaleString()}**`,
            ].join(
              "\n",
            ),

            inline:
              true,
          };
        },
      );

    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0xf39c12,
          )
          .setTitle(
            "📊 Puzzle Stats",
          )
          .setDescription(
            [
              `🎮 เล่นทั้งหมด **${Number(stats.played ?? 0).toLocaleString()}** รอบ`,
              `🏁 จบทั้งหมด **${Number(stats.completed ?? 0).toLocaleString()}** รอบ`,
              `✅ ตอบถูก **${Number(stats.correct ?? 0).toLocaleString()}**`,
              `❌ ตอบผิด **${Number(stats.wrong ?? 0).toLocaleString()}**`,
              `💡 ใช้ Hint **${Number(stats.hints ?? 0).toLocaleString()}** ครั้ง`,
              `⭐ Best Score **${Number(stats.bestScore ?? 0)}/${MAX_ROUNDS * 2}**`,
              `🔥 Best Streak **${Number(stats.bestStreak ?? 0)}**`,
            ].join(
              "\n",
            ),
          )
          .addFields(
            ...fields,
          )
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
