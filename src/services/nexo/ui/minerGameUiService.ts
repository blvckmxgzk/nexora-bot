import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  type InteractionEditReplyOptions,
} from "discord.js";

import {
  minerService,
} from "../minerService.js";

import {
  minerMathService,
  type MinerUpgrade,
} from "../minerMathService.js";

import {
  minerPickaxeService,
} from "../minerPickaxeService.js";

import {
  minerBoostService,
} from "../minerBoostService.js";

import {
  minerShopService,
} from "../minerShopService.js";

import {
  minerTradeService,
} from "../minerTradeService.js";

import {
  economyService,
} from "../../economyService.js";

import {
  MinerInventoryItem,
} from "../../../models/MinerInventoryItem.js";

import {
  MinerOreStack,
} from "../../../models/MinerOreStack.js";

import {
  MinerPickaxe,
} from "../../../models/MinerPickaxe.js";

import {
  MinerTrade,
} from "../../../models/MinerTrade.js";

import {
  ORE_MAP,
} from "../../../game/nexoMiner/oreCatalog.js";

import {
  PICKAXE_MAP,
} from "../../../game/nexoMiner/pickaxeCatalog.js";

import {
  MINER_ITEM_MAP,
} from "../../../game/nexoMiner/itemCatalog.js";

import {
  MINER_RARITY_MAP,
} from "../../../game/nexoMiner/rarityCatalog.js";

import {
  NexoNumber,
  toSuffix,
} from "../NexoNumber.js";

export type MinerUiPage =
  | "home"
  | "bag"
  | "upgrades"
  | "pickaxes"
  | "items"
  | "shop"
  | "boosts"
  | "chest"
  | "leaderboard"
  | "trade";

function button(
  ownerId: string,
  action: string,
  label: string,
  emoji: string,
  style: ButtonStyle =
    ButtonStyle.Secondary,
) {
  return new ButtonBuilder()
    .setCustomId(
      `nexo_miner:${action}:${ownerId}`,
    )
    .setLabel(label)
    .setEmoji(emoji)
    .setStyle(style);
}

function nav(
  ownerId: string,
  active?: MinerUiPage,
) {
  const style = (
    page: MinerUiPage,
  ) =>
    page === active
      ? ButtonStyle.Primary
      : ButtonStyle.Secondary;

  return [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        button(
          ownerId,
          "home",
          "Home",
          "🏠",
          style("home"),
        ),
        button(
          ownerId,
          "bag",
          "Bag",
          "🎒",
          style("bag"),
        ),
        button(
          ownerId,
          "upgrades",
          "Upgrade",
          "📈",
          style("upgrades"),
        ),
        button(
          ownerId,
          "pickaxes",
          "Pickaxe",
          "⛏️",
          style("pickaxes"),
        ),
        button(
          ownerId,
          "items",
          "Items",
          "🧪",
          style("items"),
        ),
      ),

    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        button(
          ownerId,
          "shop",
          "Shop",
          "🛒",
          style("shop"),
        ),
        button(
          ownerId,
          "boosts",
          "Boosts",
          "⚡",
          style("boosts"),
        ),
        button(
          ownerId,
          "chest",
          "Chest",
          "💎",
          style("chest"),
        ),
        button(
          ownerId,
          "leaderboard",
          "Ranking",
          "🏆",
          style("leaderboard"),
        ),
        button(
          ownerId,
          "trade",
          "Trade",
          "🤝",
          style("trade"),
        ),
      ),
  ];
}

function rarityText(
  rarityId: string,
) {
  const rarity =
    MINER_RARITY_MAP.get(
      rarityId as any,
    );

  return rarity
    ? `${rarity.emoji} ${rarity.name}`
    : rarityId;
}

function noticeField(
  notice?: string,
) {
  return notice
    ? [
        {
          name: "✨ Result",
          value: notice,
          inline: false,
        },
      ]
    : [];
}

async function missingProfile(
  ownerId: string,
): Promise<InteractionEditReplyOptions> {
  return {
    embeds: [
      new EmbedBuilder()
        .setTitle(
          "⛏️ NEXO Miner",
        )
        .setDescription(
          [
            "คุณยังไม่มี Miner Profile",
            "",
            "กดปุ่มด้านล่างเพื่อเริ่มเล่นได้เลย",
            "เมื่อสร้างแล้วระบบ **Auto Mining จะเริ่มทันที**",
          ].join("\n"),
        ),
    ],

    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          button(
            ownerId,
            "create",
            "Create Miner",
            "⛏️",
            ButtonStyle.Success,
          ),
        ),
    ],
  };
}

export const minerGameUiService = {
  async home(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const summary =
      await minerService.getSummary(
        ownerId,
      );

    if (!summary) {
      return missingProfile(
        ownerId,
      );
    }

    const balance =
      await economyService.getBalance(
        ownerId,
      );

    const {
      profile,
      pickaxe,
      stats,
    } = summary;

    const pickaxeDefinition =
      PICKAXE_MAP.get(
        pickaxe.definitionId,
      );

    const status =
      profile.pausedReason ===
      "bag_full"
        ? "⏸️ BAG FULL"
        : "🟢 AUTO MINING";

    const cycleMs =
      minerMathService
        .getMiningCycleMs(
          stats.power,
        );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "⛏️ NEXO MINER",
          )
          .setDescription(
            [
              `**${status}**`,
              "",
              "ขุดอัตโนมัติอยู่ตลอดเวลา",
              "ใช้เมนูด้านล่างเพื่อเล่นเกมได้เลย",
            ].join("\n"),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "💰 NEXO",
              value:
                `**${toSuffix(balance)}**`,
              inline: true,
            },
            {
              name: "⛏️ Pickaxe",
              value:
                `**${pickaxeDefinition?.name ?? pickaxe.definitionId}**\n${rarityText(pickaxe.rarity)}`,
              inline: true,
            },
            {
              name: "⏱️ Mining Speed",
              value:
                `**${toSuffix(String(cycleMs / 1000))}s / roll**`,
              inline: true,
            },
            {
              name: "💪 Power",
              value:
                `**${stats.power.toSuffix()}**`,
              inline: true,
            },
            {
              name: "🍀 Luck",
              value:
                `**${stats.luck.toSuffix()}**`,
              inline: true,
            },
            {
              name: "🎒 Bag",
              value:
                `**${toSuffix(profile.bagWeight)} / ${stats.maxWeight.toSuffix()} kg**`,
              inline: true,
            },
            {
              name: "💸 Sell Multi",
              value:
                `**×${stats.sellMulti.toSuffix()}**`,
              inline: true,
            },
            {
              name: "📏 Size Multi",
              value:
                `**×${stats.sizeMulti.toSuffix()}**`,
              inline: true,
            },
            {
              name: "💎 Overtime Networth",
              value:
                `**${toSuffix(profile.allTimeMinedNetworth)}**`,
              inline: true,
            },
          )
          .setFooter({
            text:
              "NEXORA • NEXO Miner • Interactive UI",
          })
          .setTimestamp(),
      ],

      components: nav(
        ownerId,
        "home",
      ),
    };
  },

  async bag(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const summary =
      await minerService.getSummary(
        ownerId,
      );

    if (!summary) {
      return missingProfile(
        ownerId,
      );
    }

    const stacks =
      await minerService.getInventory(
        ownerId,
      );

    stacks.sort(
      (a, b) =>
        new NexoNumber(
          b.totalNetWorth,
        ).cmp(
          a.totalNetWorth,
        ),
    );

    const lines =
      stacks
        .slice(0, 15)
        .map((stack) => {
          const ore =
            ORE_MAP.get(
              stack.definitionId,
            );

          return [
            `${rarityText(stack.rarity)} **${ore?.name ?? stack.definitionId}** ×${toSuffix(String(stack.quantity))}`,
            `> ⚖️ ${toSuffix(stack.totalWeight)}kg • 💎 ${toSuffix(stack.totalNetWorth)}`,
            `> Biggest ${toSuffix(stack.largestWeight)}kg • ${stack.largestSizeClass}`,
          ].join("\n");
        });

    const components:
      ActionRowBuilder<any>[] = [
        ...nav(
          ownerId,
          "bag",
        ),

        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            button(
              ownerId,
              "sell",
              "Sell All",
              "💰",
              ButtonStyle.Success,
            ),
            button(
              ownerId,
              "home",
              "Refresh",
              "🔄",
            ),
          ),
      ];

    const chestEligible =
      stacks
        .filter((stack) => {
          const rarity =
            MINER_RARITY_MAP.get(
              stack.rarity as any,
            );

          return (
            (rarity?.tier ?? 0) >=
            6
          );
        })
        .slice(0, 25);

    if (
      chestEligible.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:store:${ownerId}`,
              )
              .setPlaceholder(
                "💎 ย้ายแร่ Legendary+ เข้า Rare Chest",
              )
              .addOptions(
                chestEligible.map(
                  (stack) => {
                    const ore =
                      ORE_MAP.get(
                        stack.definitionId,
                      );

                    return {
                      label:
                        (
                          ore?.name ??
                          stack.definitionId
                        ).slice(0, 100),

                      value:
                        stack.definitionId,

                      description:
                        `${toSuffix(stack.totalWeight)}kg • ${toSuffix(stack.totalNetWorth)} NW`
                          .slice(
                            0,
                            100,
                          ),
                    };
                  },
                ),
              ),
          ),
      );
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🎒 Miner Bag",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n\n",
                )
              : "กระเป๋ายังว่างอยู่ — ระบบกำลังขุดให้อัตโนมัติ",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "⚖️ Capacity",
              value:
                `**${toSuffix(summary.profile.bagWeight)} / ${summary.stats.maxWeight.toSuffix()} kg**`,
            },
          )
          .setFooter({
            text:
              `${stacks.length} ore type(s)`,
          }),
      ],

      components,
    };
  },

  async upgrades(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const summary =
      await minerService.getSummary(
        ownerId,
      );

    if (!summary) {
      return missingProfile(
        ownerId,
      );
    }

    const balance =
      await economyService.getBalance(
        ownerId,
      );

    const {
      profile,
      pickaxe,
    } = summary;

    const upgrades: Array<{
      id: MinerUpgrade;
      label: string;
      emoji: string;
      level: number;
    }> = [
      {
        id: "power",
        label: "Power",
        emoji: "💪",
        level:
          pickaxe.powerLevel,
      },
      {
        id: "luck",
        label: "Luck",
        emoji: "🍀",
        level:
          pickaxe.luckLevel,
      },
      {
        id: "maxweight",
        label: "Max Weight",
        emoji: "🎒",
        level:
          profile.maxWeightLevel,
      },
      {
        id: "sellmulti",
        label: "Sell Multi",
        emoji: "💰",
        level:
          profile.sellMultiLevel,
      },
      {
        id: "sizemulti",
        label: "Size Multi",
        emoji: "📏",
        level:
          profile.sizeMultiLevel,
      },
    ];

    const lines =
      upgrades.map(
        (upgrade) => {
          const price =
            minerMathService
              .getUpgradePrice(
                upgrade.id,
                upgrade.level,
              );

          return `${upgrade.emoji} **${upgrade.label} Lv.${toSuffix(String(upgrade.level))}**\n> Next: **${price.toSuffix()} NEXO**`;
        },
      );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "📈 Miner Upgrades",
          )
          .setDescription(
            lines.join(
              "\n\n",
            ),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "💰 Wallet",
              value:
                `**${toSuffix(balance)} NEXO**`,
            },
          ),
      ],

      components: [
        ...nav(
          ownerId,
          "upgrades",
        ),

        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            button(
              ownerId,
              "upgrade_power",
              "Power",
              "💪",
              ButtonStyle.Success,
            ),
            button(
              ownerId,
              "upgrade_luck",
              "Luck",
              "🍀",
              ButtonStyle.Success,
            ),
            button(
              ownerId,
              "upgrade_maxweight",
              "Bag",
              "🎒",
              ButtonStyle.Success,
            ),
            button(
              ownerId,
              "upgrade_sellmulti",
              "Sell",
              "💰",
              ButtonStyle.Success,
            ),
            button(
              ownerId,
              "upgrade_sizemulti",
              "Size",
              "📏",
              ButtonStyle.Success,
            ),
          ),
      ],
    };
  },

  async pickaxes(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const pickaxes =
      await minerPickaxeService.list(
        ownerId,
      );

    if (
      pickaxes.length ===
      0
    ) {
      return missingProfile(
        ownerId,
      );
    }

    const lines =
      pickaxes
        .slice(0, 15)
        .map((pickaxe) => {
          const definition =
            PICKAXE_MAP.get(
              pickaxe.definitionId,
            );

          return [
            `${pickaxe.equipped ? "✅" : "⛏️"} ${rarityText(pickaxe.rarity)} **${definition?.name ?? pickaxe.definitionId}**`,
            `> Power Lv.${toSuffix(String(pickaxe.powerLevel))} • Luck Lv.${toSuffix(String(pickaxe.luckLevel))}`,
            `> 💎 ${toSuffix(pickaxe.baseNetWorth)}`,
          ].join("\n");
        });

    const choices =
      pickaxes
        .filter(
          (pickaxe) =>
            !pickaxe.equipped,
        )
        .slice(0, 25);

    const components:
      ActionRowBuilder<any>[] = [
        ...nav(
          ownerId,
          "pickaxes",
        ),
      ];

    if (
      choices.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:equip:${ownerId}`,
              )
              .setPlaceholder(
                "⛏️ เลือก Pickaxe ที่ต้องการ Equip",
              )
              .addOptions(
                choices.map(
                  (pickaxe) => {
                    const definition =
                      PICKAXE_MAP.get(
                        pickaxe.definitionId,
                      );

                    return {
                      label:
                        (
                          definition?.name ??
                          pickaxe.definitionId
                        ).slice(0, 100),

                      value:
                        pickaxe.pickaxeInstanceId,

                      description:
                        `${rarityText(pickaxe.rarity)} • ${toSuffix(pickaxe.baseNetWorth)} NW`
                          .slice(
                            0,
                            100,
                          ),
                    };
                  },
                ),
              ),
          ),
      );
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "⛏️ Pickaxe Collection",
          )
          .setDescription(
            lines.join(
              "\n\n",
            ),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
          ),
      ],

      components,
    };
  },

  async items(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const inventory =
      await MinerInventoryItem
        .find({
          discordId:
            ownerId,

          quantity: {
            $gt: 0,
          },
        });

    const lines =
      inventory
        .slice(0, 20)
        .map((entry) => {
          const item =
            MINER_ITEM_MAP.get(
              entry.itemId,
            );

          return `${item?.emoji ?? "📦"} ${item ? rarityText(item.rarity) : ""} **${item?.name ?? entry.itemId} ×${toSuffix(String(entry.quantity))}**\n> 💎 ${item ? toSuffix(item.netWorth) : "?"}`;
        });

    const usable =
      inventory
        .filter((entry) => {
          const item =
            MINER_ITEM_MAP.get(
              entry.itemId,
            );

          return (
            item?.type ===
              "boost" ||
            (
              item?.type ===
                "token" &&
              item.effect
                ?.infiniteBag
            )
          );
        })
        .slice(0, 25);

    const components:
      ActionRowBuilder<any>[] = [
        ...nav(
          ownerId,
          "items",
        ),
      ];

    if (
      usable.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:use:${ownerId}`,
              )
              .setPlaceholder(
                "🧪 เลือก Item ที่ต้องการใช้",
              )
              .addOptions(
                usable.map(
                  (entry) => {
                    const item =
                      MINER_ITEM_MAP.get(
                        entry.itemId,
                      )!;

                    return {
                      label:
                        item.name.slice(
                          0,
                          100,
                        ),

                      value:
                        item.id,

                      description:
                        `${rarityText(item.rarity)} • ×${entry.quantity}`
                          .slice(
                            0,
                            100,
                          ),
                    };
                  },
                ),
              ),
          ),
      );
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🧪 Miner Items",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n\n",
                )
              : "ยังไม่มี Miner Item",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
          ),
      ],

      components,
    };
  },

  async boosts(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const boosts =
      await minerBoostService.getActive(
        ownerId,
      );

    const lines =
      boosts.map(
        (boost) =>
          `🧪 **${boost.stat.toUpperCase()} ×${toSuffix(boost.multiplier)}**\n> หมดเวลา <t:${Math.floor(boost.expiresAt.getTime() / 1000)}:R>`,
      );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "⚡ Active Boosts",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n\n",
                )
              : "ตอนนี้ไม่มี Boost ที่กำลังทำงาน",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
          ),
      ],

      components: nav(
        ownerId,
        "boosts",
      ),
    };
  },

  async shop(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const balance =
      await economyService.getBalance(
        ownerId,
      );

    const catalog =
      minerShopService
        .getCatalog()
        .slice(0, 25);

    const lines =
      catalog
        .slice(0, 15)
        .map(
          (item) =>
            `${item.emoji} ${rarityText(item.rarity)} **${item.name}**\n> 💰 ${toSuffix(item.shopPrice!)} NEXO • 💎 ${toSuffix(item.netWorth)}`,
        );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🛒 NEXO Miner Shop",
          )
          .setDescription(
            lines.join(
              "\n\n",
            ),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "💰 Wallet",
              value:
                `**${toSuffix(balance)} NEXO**`,
            },
          )
          .setFooter({
            text:
              "เลือก Item ด้านล่างเพื่อซื้อ 1 ชิ้น • Slash command ใช้ซื้อจำนวนมากได้",
          }),
      ],

      components: [
        ...nav(
          ownerId,
          "shop",
        ),

        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:buy:${ownerId}`,
              )
              .setPlaceholder(
                "🛒 เลือก Item เพื่อซื้อ ×1",
              )
              .addOptions(
                catalog.map(
                  (item) => ({
                    label:
                      item.name.slice(
                        0,
                        100,
                      ),

                    value:
                      item.id,

                    description:
                      `${toSuffix(item.shopPrice!)} NEXO • ${rarityText(item.rarity)}`
                        .slice(
                          0,
                          100,
                        ),
                  }),
                ),
              ),
          ),
      ],
    };
  },

  async chest(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const stacks =
      await minerService.getChest(
        ownerId,
      );

    const lines =
      stacks.map((stack) => {
        const ore =
          ORE_MAP.get(
            stack.definitionId,
          );

        return `${rarityText(stack.rarity)} **${ore?.name ?? stack.definitionId} ×${toSuffix(String(stack.quantity))}**\n> ⚖️ ${toSuffix(stack.totalWeight)}kg • 💎 ${toSuffix(stack.totalNetWorth)}`;
      });

    const components:
      ActionRowBuilder<any>[] = [
        ...nav(
          ownerId,
          "chest",
        ),
      ];

    if (
      stacks.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:take:${ownerId}`,
              )
              .setPlaceholder(
                "🎒 เลือกแร่เพื่อนำกลับเข้ากระเป๋า",
              )
              .addOptions(
                stacks
                  .slice(0, 25)
                  .map((stack) => {
                    const ore =
                      ORE_MAP.get(
                        stack.definitionId,
                      );

                    return {
                      label:
                        (
                          ore?.name ??
                          stack.definitionId
                        ).slice(
                          0,
                          100,
                        ),

                      value:
                        stack.definitionId,

                      description:
                        `${toSuffix(stack.totalWeight)}kg • ${toSuffix(stack.totalNetWorth)} NW`
                          .slice(
                            0,
                            100,
                          ),
                    };
                  }),
              ),
          ),
      );
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "💎 Rare Chest",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n\n",
                )
              : "Rare Chest ยังว่างอยู่",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
          ),
      ],

      components,
    };
  },

  async leaderboard(
    ownerId: string,
  ): Promise<InteractionEditReplyOptions> {
    const board =
      await minerService.leaderboard(
        10,
      );

    const lines =
      board.map(
        (profile, index) => {
          const medal =
            index === 0
              ? "🥇"
              : index === 1
                ? "🥈"
                : index === 2
                  ? "🥉"
                  : `**${index + 1}.**`;

          return `${medal} <@${profile.discordId}> — **${toSuffix(profile.allTimeMinedNetworth)}**`;
        },
      );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🏆 NEXO Miner — Overtime Networth",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n",
                )
              : "ยังไม่มี Miner",
          )
          .setFooter({
            text:
              "ใช้ Overtime Networth • Trade ไม่สามารถปั่นอันดับได้",
          }),
      ],

      components: nav(
        ownerId,
        "leaderboard",
      ),
    };
  },

  async trade(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const openTrades =
      await MinerTrade
        .find({
          status: "open",

          $or: [
            {
              initiatorId:
                ownerId,
            },
            {
              partnerId:
                ownerId,
            },
          ],
        })
        .sort({
          createdAt: -1,
        })
        .limit(25);

    const lines =
      openTrades.map(
        (trade) => {
          const partner =
            trade.initiatorId ===
            ownerId
              ? trade.partnerId
              : trade.initiatorId;

          return `🤝 \`${trade.tradeId}\` • <@${partner}> • <t:${Math.floor(trade.expiresAt.getTime() / 1000)}:R>`;
        },
      );

    const components:
      ActionRowBuilder<any>[] = [
        ...nav(
          ownerId,
          "trade",
        ),

        new ActionRowBuilder<UserSelectMenuBuilder>()
          .addComponents(
            new UserSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:trade-user:${ownerId}`,
              )
              .setPlaceholder(
                "🤝 เลือกสมาชิกเพื่อสร้าง Trade",
              )
              .setMinValues(1)
              .setMaxValues(1),
          ),
      ];

    if (
      openTrades.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:trade-view:${ownerId}`,
              )
              .setPlaceholder(
                "📄 เปิด Trade ที่กำลังดำเนินการ",
              )
              .addOptions(
                openTrades.map(
                  (trade) => {
                    const partner =
                      trade.initiatorId ===
                      ownerId
                        ? trade.partnerId
                        : trade.initiatorId;

                    return {
                      label:
                        trade.tradeId.slice(
                          0,
                          100,
                        ),

                      value:
                        trade.tradeId,

                      description:
                        `Trade with ${partner}`
                          .slice(
                            0,
                            100,
                          ),
                    };
                  },
                ),
              ),
          ),
      );
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🤝 NEXO Trade Center",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n",
                )
              : "ยังไม่มี Trade ที่เปิดอยู่",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "🛡️ Fair Trade",
              value:
                "ระบบอนุญาตส่วนต่าง Intrinsic Networth สูงสุด **10%**",
            },
          ),
      ],

      components,
    };
  },

  async tradeDetail(
    ownerId: string,
    tradeId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const result =
      await minerTradeService.get(
        tradeId,
        ownerId,
      );

    const {
      trade,
      sideAValue,
      sideBValue,
    } = result;

    const formatSide = (
      side: any,
      value: NexoNumber,
    ) => {
      const lines = [
        `💰 ${toSuffix(side.nexo)} NEXO`,
      ];

      for (
        const item
        of side.items
      ) {
        lines.push(
          `📦 ${item.itemId} ×${toSuffix(String(item.quantity))}`,
        );
      }

      for (
        const ore
        of side.ores
      ) {
        lines.push(
          `⛏️ ${ore.definitionId} • ${toSuffix(ore.totalNetWorth)} NW`,
        );
      }

      for (
        const pickaxe
        of side.pickaxes
      ) {
        lines.push(
          `⛏️ ${pickaxe.definitionId} • ${toSuffix(pickaxe.netWorth)} NW`,
        );
      }

      lines.push(
        "",
        `💎 **${value.toSuffix()} Total**`,
        side.confirmedAt
          ? "✅ Confirmed"
          : "⌛ Waiting",
      );

      return lines.join(
        "\n",
      );
    };

    const itemInventory =
      await MinerInventoryItem
        .find({
          discordId:
            ownerId,

          quantity: {
            $gt: 0,
          },
        });

    const items =
      itemInventory
        .filter((entry) => {
          const item =
            MINER_ITEM_MAP.get(
              entry.itemId,
            );

          return (
            item?.tradeable &&
            entry.quantity >
              entry.tradeLockedQuantity
          );
        })
        .slice(0, 25);

    const ores =
      await MinerOreStack
        .find({
          discordId:
            ownerId,

          location:
            "bag",

          tradeLocked:
            false,
        })
        .limit(25);

    const pickaxes =
      await MinerPickaxe
        .find({
          discordId:
            ownerId,

          equipped:
            false,

          tradeLocked:
            false,

          source: {
            $ne: "starter",
          },
        })
        .limit(25);

    const components:
      ActionRowBuilder<any>[] = [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `nexo_miner:trade_confirm:${ownerId}:${tradeId}`,
              )
              .setLabel(
                "Confirm",
              )
              .setEmoji("✅")
              .setStyle(
                ButtonStyle.Success,
              ),

            new ButtonBuilder()
              .setCustomId(
                `nexo_miner:trade_nexo:${ownerId}:${tradeId}`,
              )
              .setLabel(
                "Offer NEXO",
              )
              .setEmoji("💰")
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `nexo_miner:trade_clear:${ownerId}:${tradeId}`,
              )
              .setLabel(
                "Clear",
              )
              .setEmoji("🧹")
              .setStyle(
                ButtonStyle.Secondary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `nexo_miner:trade_cancel:${ownerId}:${tradeId}`,
              )
              .setLabel(
                "Cancel",
              )
              .setEmoji("❌")
              .setStyle(
                ButtonStyle.Danger,
              ),

            button(
              ownerId,
              "trade",
              "Back",
              "↩️",
            ),
          ),
      ];

    if (
      items.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:trade-item:${ownerId}:${tradeId}`,
              )
              .setPlaceholder(
                "📦 เพิ่ม Item ×1 เข้า Offer",
              )
              .addOptions(
                items.map(
                  (entry) => {
                    const item =
                      MINER_ITEM_MAP.get(
                        entry.itemId,
                      )!;

                    return {
                      label:
                        item.name.slice(
                          0,
                          100,
                        ),

                      value:
                        item.id,

                      description:
                        `${toSuffix(item.netWorth)} NW • available ${entry.quantity - entry.tradeLockedQuantity}`
                          .slice(
                            0,
                            100,
                          ),
                    };
                  },
                ),
              ),
          ),
      );
    }

    if (
      ores.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:trade-ore:${ownerId}:${tradeId}`,
              )
              .setPlaceholder(
                "⛏️ เพิ่ม Ore Stack เข้า Offer",
              )
              .addOptions(
                ores.map(
                  (ore) => ({
                    label:
                      (
                        ORE_MAP.get(
                          ore.definitionId,
                        )?.name ??
                        ore.definitionId
                      ).slice(
                        0,
                        100,
                      ),

                    value:
                      ore.definitionId,

                    description:
                      `${toSuffix(ore.totalNetWorth)} NW`
                        .slice(
                          0,
                          100,
                        ),
                  }),
                ),
              ),
          ),
      );
    }

    if (
      pickaxes.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:trade-pickaxe:${ownerId}:${tradeId}`,
              )
              .setPlaceholder(
                "⛏️ เพิ่ม Pickaxe เข้า Offer",
              )
              .addOptions(
                pickaxes.map(
                  (pickaxe) => ({
                    label:
                      (
                        PICKAXE_MAP.get(
                          pickaxe.definitionId,
                        )?.name ??
                        pickaxe.definitionId
                      ).slice(
                        0,
                        100,
                      ),

                    value:
                      pickaxe.pickaxeInstanceId,
                  }),
                ),
              ),
          ),
      );
    }

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `🤝 Trade ${tradeId}`,
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name:
                `🅰️ <@${trade.sideA.userId}>`,
              value:
                formatSide(
                  trade.sideA,
                  sideAValue,
                ),
            },
            {
              name:
                `🅱️ <@${trade.sideB.userId}>`,
              value:
                formatSide(
                  trade.sideB,
                  sideBValue,
                ),
            },
          )
          .setFooter({
            text:
              "Offer เปลี่ยนเมื่อไร Confirmation ของทั้งสองฝ่ายจะ Reset",
          }),
      ],

      components,
    };
  },

  async render(
    page: MinerUiPage,
    ownerId: string,
    notice?: string,
  ) {
    switch (page) {
      case "bag":
        return this.bag(
          ownerId,
          notice,
        );

      case "upgrades":
        return this.upgrades(
          ownerId,
          notice,
        );

      case "pickaxes":
        return this.pickaxes(
          ownerId,
          notice,
        );

      case "items":
        return this.items(
          ownerId,
          notice,
        );

      case "shop":
        return this.shop(
          ownerId,
          notice,
        );

      case "boosts":
        return this.boosts(
          ownerId,
          notice,
        );

      case "chest":
        return this.chest(
          ownerId,
          notice,
        );

      case "leaderboard":
        return this.leaderboard(
          ownerId,
        );

      case "trade":
        return this.trade(
          ownerId,
          notice,
        );

      default:
        return this.home(
          ownerId,
          notice,
        );
    }
  },
};
