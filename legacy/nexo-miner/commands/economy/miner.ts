import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  minerService,
} from "../../services/nexo/minerService.js";

import {
  minerMathService,
} from "../../services/nexo/minerMathService.js";

import {
  economyService,
} from "../../services/economyService.js";

import {
  toSuffix,
  NexoNumber,
} from "../../services/nexo/NexoNumber.js";


import {
  minerGameUiService,
} from "../../services/nexo/ui/minerGameUiService.js";

import {
  ORE_MAP,
} from "../../game/nexoMiner/oreCatalog.js";

import {
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

function rarityText(
  rarity:
    string,
) {
  const data =
    MINER_RARITY_MAP.get(
      rarity as
        any,
    );

  return data
    ? `${data.emoji} ${data.name}`
    : rarity;
}

export const data =
  new SlashCommandBuilder()
    .setName(
      "miner",
    )
    .setDescription(
      "NEXO Miner",
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "play",
          )
          .setDescription(
            "เปิดหน้า NEXO Miner แบบ Interactive",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "create",
          )
          .setDescription(
            "สร้าง NEXO Miner Profile",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "profile",
          )
          .setDescription(
            "ดู Miner Profile",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "status",
          )
          .setDescription(
            "ดูสถานะ Auto Mining",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "inventory",
          )
          .setDescription(
            "ดูแร่ในกระเป๋า",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "sell",
          )
          .setDescription(
            "ขายแร่ทั้งหมดในกระเป๋า",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "upgrade",
          )
          .setDescription(
            "Upgrade Miner",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "stat",
                )
                .setDescription(
                  "Stat ที่ต้องการ Upgrade",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  {
                    name:
                      "Power",

                    value:
                      "power",
                  },
                  {
                    name:
                      "Luck",

                    value:
                      "luck",
                  },
                  {
                    name:
                      "Max Weight",

                    value:
                      "maxweight",
                  },
                  {
                    name:
                      "Sell Multi",

                    value:
                      "sellmulti",
                  },
                  {
                    name:
                      "Size Multi",

                    value:
                      "sizemulti",
                  },
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "chest",
          )
          .setDescription(
            "ดู Rare Chest",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "store",
          )
          .setDescription(
            "ย้ายแร่ Legendary+ เข้า Rare Chest",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "ore",
                )
                .setDescription(
                  "Ore ID เช่น uranium",
                )
                .setRequired(
                  true,
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "take",
          )
          .setDescription(
            "นำแร่ออกจาก Rare Chest",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "ore",
                )
                .setDescription(
                  "Ore ID",
                )
                .setRequired(
                  true,
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "leaderboard",
          )
          .setDescription(
            "Overtime Miner Networth",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
) {
  const sub =
    interaction.options
      .getSubcommand();

  const userId =
    interaction.user.id;

  await interaction
    .deferReply();


  if (
    sub ===
    "play"
  ) {
    await interaction.editReply(
      await minerGameUiService.home(
        userId,
      ),
    );

    return;
  }

  try {
    if (
      sub ===
      "create"
    ) {
      await minerService
        .createProfile(
          userId,
        );

      await interaction.editReply(
        await minerGameUiService.home(
          userId,
          "🎉 Miner Profile ถูกสร้างแล้ว — Auto Mining เริ่มทำงาน!",
        ),
      );

      return;
    }

    const summary =
      await minerService
        .getSummary(
          userId,
        );

    if (
      !summary
    ) {
      await interaction
        .editReply(
          "❌ ยังไม่มี Miner Profile — ใช้ `/miner create` ก่อน",
        );

      return;
    }

    if (
      sub ===
      "profile"
    ) {
      const balance =
        await economyService
          .getBalance(
            userId,
          );

      const {
        profile,
        pickaxe,
        stats,
      } =
        summary;

      await interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "⛏️ NEXO Miner Profile",
              )
              .setThumbnail(
                interaction.user
                  .displayAvatarURL(),
              )
              .addFields(
                {
                  name:
                    "💰 NEXO",

                  value:
                    `**${toSuffix(balance)}**`,

                  inline:
                    true,
                },
                {
                  name:
                    "⛏️ Pickaxe",

                  value:
                    `**${pickaxe.definitionId}**\n${rarityText(pickaxe.rarity)}`,

                  inline:
                    true,
                },
                {
                  name:
                    "💪 Power",

                  value:
                    `**${stats.power.toSuffix()}**`,

                  inline:
                    true,
                },
                {
                  name:
                    "🍀 Luck",

                  value:
                    `**${stats.luck.toSuffix()}**`,

                  inline:
                    true,
                },
                {
                  name:
                    "🎒 Bag",

                  value:
                    `**${toSuffix(profile.bagWeight)} / ${stats.maxWeight.toSuffix()} kg**`,

                  inline:
                    true,
                },
                {
                  name:
                    "💸 Sell Multi",

                  value:
                    `**×${stats.sellMulti.toSuffix()}**`,

                  inline:
                    true,
                },
                {
                  name:
                    "📏 Size Multi",

                  value:
                    `**×${stats.sizeMulti.toSuffix()}**`,

                  inline:
                    true,
                },
                {
                  name:
                    "💎 Overtime Networth",

                  value:
                    `**${toSuffix(profile.allTimeMinedNetworth)}**`,

                  inline:
                    true,
                },
                {
                  name:
                    "🪨 Ores Mined",

                  value:
                    `**${toSuffix(profile.totalOresMined)}**`,

                  inline:
                    true,
                },
              )
              .setTimestamp(),
          ],
        });

      return;
    }

    if (
      sub ===
      "status"
    ) {
      const cycle =
        minerMathService
          .getMiningCycleMs(
            summary
              .stats
              .power,
          );

      const status =
        summary
          .profile
          .pausedReason ===
          "bag_full"
          ? "⏸️ PAUSED — BAG FULL"
          : "🟢 AUTO MINING";

      await interaction
        .editReply({
          content: [
            `⛏️ **${status}**`,
            "",
            `รอบขุด: **${toSuffix(String(cycle / 1000))}s**`,
            `Bag: **${toSuffix(summary.profile.bagWeight)} / ${summary.stats.maxWeight.toSuffix()} kg**`,
            `Power: **${summary.stats.power.toSuffix()}**`,
            `Luck: **${summary.stats.luck.toSuffix()}**`,
          ].join(
            "\n",
          ),
        });

      return;
    }

    if (
      sub ===
      "inventory"
    ) {
      const stacks =
        await minerService
          .getInventory(
            userId,
          );

      stacks.sort(
        (a: any, b: any) =>
          new NexoNumber(
            b.totalNetWorth,
          ).cmp(
            a.totalNetWorth,
          ),
      );

      if (
        stacks.length ===
        0
      ) {
        await interaction
          .editReply(
            "🎒 กระเป๋ายังไม่มีแร่",
          );

        return;
      }

      const lines =
        stacks
          .slice(
            0,
            15,
          )
          .map(
            (stack: any) => {
              const ore =
                ORE_MAP.get(
                  stack.definitionId,
                );

              return [
                `${rarityText(stack.rarity)} **${ore?.name ?? stack.definitionId}**`,
                `> ×${toSuffix(String(stack.quantity))} • ${toSuffix(stack.totalWeight)}kg • 💎 ${toSuffix(stack.totalNetWorth)}`,
                `> Biggest: ${toSuffix(stack.largestWeight)}kg (${stack.largestSizeClass}) • ID: \`${stack.definitionId}\``,
              ].join(
                "\n",
              );
            },
          )
          .join(
            "\n\n",
          );

      await interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🎒 Miner Bag",
              )
              .setDescription(
                lines,
              )
              .setFooter({
                text:
                  `${stacks.length} ore type(s)`,
              }),
          ],
        });

      return;
    }

    if (
      sub ===
      "sell"
    ) {
      const result =
        await minerService
          .sellAll(
            userId,
          );

      await interaction
        .editReply({
          content: [
            "💰 **ขายแร่สำเร็จ!**",
            "",
            `Intrinsic Networth: **${toSuffix(result.intrinsic)}**`,
            `Sell Multi: **×${toSuffix(result.sellMulti)}**`,
            `ได้รับ: **${toSuffix(result.payout)} NEXO**`,
            `Wallet: **${toSuffix(result.balance)} NEXO**`,
            "",
            "⛏️ Auto Mining ทำงานต่อแล้ว",
          ].join(
            "\n",
          ),
        });

      return;
    }

    if (
      sub ===
      "upgrade"
    ) {
      const stat =
        interaction.options
          .getString(
            "stat",
            true,
          ) as
            | "power"
            | "luck"
            | "maxweight"
            | "sellmulti"
            | "sizemulti";

      const result =
        await minerService
          .upgrade(
            userId,
            stat,
          );

      await interaction
        .editReply({
          content: [
            "📈 **Upgrade สำเร็จ!**",
            "",
            `Stat: **${stat}**`,
            `Level: **${toSuffix(String(result.level))}**`,
            `ราคา: **${toSuffix(result.price)} NEXO**`,
            `Wallet: **${toSuffix(result.balance)} NEXO**`,
          ].join(
            "\n",
          ),
        });

      return;
    }

    if (
      sub ===
      "chest"
    ) {
      const stacks =
        await minerService
          .getChest(
            userId,
          );

      if (
        stacks.length ===
        0
      ) {
        await interaction
          .editReply(
            "💎 Rare Chest ยังว่างอยู่",
          );

        return;
      }

      const lines =
        stacks.map(
          (stack: any) => {
            const ore =
              ORE_MAP.get(
                stack.definitionId,
              );

            return `${rarityText(stack.rarity)} **${ore?.name ?? stack.definitionId}** ×${toSuffix(String(stack.quantity))}\n> ${toSuffix(stack.totalWeight)}kg • 💎 ${toSuffix(stack.totalNetWorth)} • \`${stack.definitionId}\``;
          },
        );

      await interaction
        .editReply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                `💎 Rare Chest (${stacks.length}/${summary.profile.chestSlots})`,
              )
              .setDescription(
                lines.join(
                  "\n\n",
                ),
              ),
          ],
        });

      return;
    }

    if (
      sub ===
      "store"
    ) {
      const ore =
        interaction.options
          .getString(
            "ore",
            true,
          )
          .trim()
          .toLowerCase();

      await minerService
        .storeOre(
          userId,
          ore,
        );

      await interaction
        .editReply(
          `💎 ย้าย \`${ore}\` เข้า Rare Chest แล้ว`,
        );

      return;
    }

    if (
      sub ===
      "take"
    ) {
      const ore =
        interaction.options
          .getString(
            "ore",
            true,
          )
          .trim()
          .toLowerCase();

      await minerService
        .takeOre(
          userId,
          ore,
        );

      await interaction
        .editReply(
          `🎒 ย้าย \`${ore}\` กลับเข้ากระเป๋าแล้ว`,
        );

      return;
    }

    const leaderboard =
      await minerService
        .leaderboard(
          10,
        );

    const lines =
      leaderboard.map(
        (profile: any, index: number) => {
          const rank =
            index ===
            0
              ? "🥇"
              : index ===
                1
                ? "🥈"
                : index ===
                  2
                  ? "🥉"
                  : `**${index + 1}.**`;

          return `${rank} <@${profile.discordId}> — **${toSuffix(profile.allTimeMinedNetworth)}**`;
        },
      );

    await interaction
      .editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "🏆 NEXO Miner — Overtime Networth",
            )
            .setDescription(
              lines.length >
              0
                ? lines.join(
                    "\n",
                  )
                : "ยังไม่มี Miner",
            ),
        ],
      });
  } catch (
    error
  ) {
    console.error(
      "❌ /miner failed:",
      error,
    );

    await interaction
      .editReply(
        `❌ ${error instanceof Error ? error.message : "เกิดข้อผิดพลาด"}`,
      );
  }
}
