import {
  minerUiPreferenceService,
} from "./minerUiPreferenceService.js";

import {
  minerUpgradeQuantityModeService,
} from "./minerUpgradeQuantityModeService.js";

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
  minerPickaxeShopService,
} from "../minerPickaxeShopService.js";

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
  minerProgressionService,
} from "../minerProgressionService.js";

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
  minerOreVariantService,
} from "../minerOreVariantService.js";

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
  | "progression"
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

    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        button(
          ownerId,
          "progression",
          "Progress",
          "⭐",
          style("progression"),
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

    const [
      balance,
      progression,
    ] =
      await Promise.all([
        economyService.getBalance(
          ownerId,
        ),
        minerProgressionService
          .getStatus(
            ownerId,
          ),
      ]);

    const {
      profile,
      pickaxe,
      stats,
    } = summary;

    const pickaxeDefinition =
      PICKAXE_MAP.get(
        pickaxe.definitionId,
      );

    const miningStatus =
      profile.pausedReason ===
      "bag_full"
        ? "⏸️ BAG FULL"
        : "🟢 AUTO MINING";

    const cycleMs =
      minerMathService
        .getMiningCycleMs(
          stats.power,
          stats.speedMulti,
        );

    const mineText =
      progression
        ? `${progression.area.emoji} **${progression.area.name}**`
        : "⛏️ Mining";

    const levelText =
      progression
        ? `**Lv.${progression.level}**\n${toSuffix(progression.xp)} / ${toSuffix(progression.xpRequired)} XP`
        : `**Lv.${profile.minerLevel ?? 1}**`;

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "⛏️ NEXO Miner",
          )
          .setDescription(
            [
              `**${miningStatus}**`,
              mineText,
            ].join("\n"),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "💰 Wallet",
              value:
                `**${toSuffix(balance)} NEXO**`,
              inline: true,
            },
            {
              name: "⛏️ Pickaxe",
              value:
                `**${pickaxeDefinition?.name ?? pickaxe.definitionId}**\n${rarityText(pickaxe.rarity)}`,
              inline: true,
            },
            {
              name: "⭐ Level",
              value:
                levelText,
              inline: true,
            },
            {
              name: "🎒 Bag",
              value:
                `**${toSuffix(profile.bagWeight)} / ${stats.maxWeight.toSuffix()} kg**`,
              inline: false,
            },
            {
              name: "⚡ Mining",
              value:
                `**${toSuffix(String(cycleMs / 1000))}s / roll**`,
              inline: true,
            },
            {
              name: "✨ Stats",
              value: [
                `💪 ${stats.power.toSuffix()}  •  🍀 ${stats.luck.toSuffix()}`,
                `💰 Sell ×${stats.sellMulti.toSuffix()}  •  📏 Size ×${stats.sizeMulti.toSuffix()}`,
              ].join("\n"),
              inline: true,
            },
          )
          .setFooter({
            text:
              "NEXORA • NEXO Miner",
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

    const visible =
      stacks.slice(
        0,
        15,
      );

    const lines =
      visible.map(
        (stack) => {
          const info =
            minerOreVariantService
              .getDisplayInfo(
                stack.definitionId,
              );

          const quantityText =
            stack.quantity > 1
              ? ` ×${toSuffix(String(stack.quantity))}`
              : "";

          return (
            `${info.name} ` +
            `(${toSuffix(stack.largestWeight)}kg)` +
            quantityText
          );
        },
      );

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
              "refresh_bag",
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
                "💎 เก็บ Legendary+ เข้า Chest",
              )
              .addOptions(
                chestEligible.map(
                  (stack) => {
                    const info =
                      minerOreVariantService
                        .getDisplayInfo(
                          stack.definitionId,
                        );

                    return {
                      label:
                        info.name.slice(
                          0,
                          100,
                        ),

                      value:
                        stack.definitionId,

                      description:
                        `${toSuffix(stack.largestWeight)}kg • ×${toSuffix(String(stack.quantity))}`
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
            "🎒 Bag",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n",
                )
              : "กระเป๋ายังว่าง • Auto Mining กำลังทำงาน",
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
              stacks.length > 15
                ? `${stacks.length} ore types • showing 15`
                : `${stacks.length} ore types`,
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

    const upgradeQuantity =
      minerUiPreferenceService
        .getUpgradeQuantity(
          ownerId,
        );

    const upgradeMax =
      minerUpgradeQuantityModeService
        .isMax(
          ownerId,
        );

    const upgradeQuantityText =
      upgradeMax
        ? "MAX"
        : `×${upgradeQuantity}`;

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
        label: "Bag",
        emoji: "🎒",
        level:
          profile.maxWeightLevel,
      },
      {
        id: "sellmulti",
        label: "Sell",
        emoji: "💰",
        level:
          profile.sellMultiLevel,
      },
      {
        id: "sizemulti",
        label: "Size",
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

          return (
            `${upgrade.emoji} **${upgrade.label}**` +
            ` · Lv.${toSuffix(String(upgrade.level))}` +
            ` · Next **${price.toSuffix()} NEXO**`
          );
        },
      );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "📈 Upgrades",
          )
          .setDescription(
            lines.join(
              "\n",
            ),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "🧮 Buy Qty",
              value:
                `**${upgradeQuantityText}**`,
              inline: true,
            },
            {
              name: "💰 Wallet",
              value:
                `**${toSuffix(balance)} NEXO**`,
              inline: true,
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

        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            button(
              ownerId,
              "set_upgrade_qty",
              `Buy ${upgradeQuantityText}`,
              "🧮",
              ButtonStyle.Primary,
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

    const equipped =
      pickaxes.find(
        (pickaxe) =>
          pickaxe.equipped,
      ) ??
      pickaxes[0];

    const equippedDefinition =
      PICKAXE_MAP.get(
        equipped.definitionId,
      );

    const grouped =
      new Map<
        string,
        {
          name: string;
          count: number;
        }
      >();

    for (
      const pickaxe
      of pickaxes
    ) {
      const definition =
        PICKAXE_MAP.get(
          pickaxe.definitionId,
        );

      const current =
        grouped.get(
          pickaxe.definitionId,
        );

      if (current) {
        current.count++;
      } else {
        grouped.set(
          pickaxe.definitionId,
          {
            name:
              definition?.name ??
              pickaxe.definitionId,
            count: 1,
          },
        );
      }
    }

    const collectionLines =
      Array.from(
        grouped.values(),
      )
        .slice(
          0,
          12,
        )
        .map(
          (entry) =>
            `• ${entry.name}${entry.count > 1 ? ` ×${entry.count}` : ""}`,
        );

    if (
      grouped.size >
      12
    ) {
      collectionLines.push(
        `• +${grouped.size - 12} more types`,
      );
    }

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
                "⛏️ เลือก Pickaxe เพื่อ Equip",
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
                        `${rarityText(pickaxe.rarity)} • Power Lv.${toSuffix(String(pickaxe.powerLevel))} • Luck Lv.${toSuffix(String(pickaxe.luckLevel))}`
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

    components.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          button(
            ownerId,
            "pickaxe_shop",
            "Pickaxe Shop",
            "🛒",
            ButtonStyle.Primary,
          ),
        ),
    );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "⛏️ Pickaxes",
          )
          .setDescription(
            [
              "**Equipped**",
              `✅ ${rarityText(equipped.rarity)} **${equippedDefinition?.name ?? equipped.definitionId}**`,
              `Power Lv.${toSuffix(String(equipped.powerLevel))} • Luck Lv.${toSuffix(String(equipped.luckLevel))}`,
              `Value ${toSuffix(equipped.baseNetWorth)}`,
              "",
              `**Collection • ${pickaxes.length} owned**`,
              ...collectionLines,
            ].join(
              "\n",
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

  async pickaxeShop(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const catalog =
      await minerPickaxeShopService
        .getCatalog(
          ownerId,
        );

    const balance =
      await economyService
        .getBalance(
          ownerId,
        );

    const lines =
      catalog.rows
        .slice(
          0,
          15,
        )
        .map(
          (row) => {
            const pickaxe =
              row.definition as any;

            return row.unlocked
              ? `🟢 **${pickaxe.name}** — ${toSuffix(row.price)} NEXO`
              : `🔒 **${pickaxe.name}** — Power Lv.${toSuffix(String(row.requiredPowerLevel))}`;
          },
        );

    const available =
      catalog.rows
        .filter(
          (row) =>
            row.unlocked,
        )
        .slice(
          0,
          25,
        );

    const components:
      ActionRowBuilder<any>[] = [
        ...nav(
          ownerId,
          "pickaxes",
        ),
      ];

    if (
      available.length >
      0
    ) {
      components.push(
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:buy-pickaxe:${ownerId}`,
              )
              .setPlaceholder(
                "🛒 เลือก Pickaxe ที่ต้องการซื้อ",
              )
              .addOptions(
                available.map(
                  (row) => {
                    const pickaxe =
                      row.definition as any;

                    return {
                      label:
                        String(
                          pickaxe.name,
                        ).slice(
                          0,
                          100,
                        ),

                      value:
                        pickaxe.id,

                      description:
                        `${rarityText(pickaxe.rarity)} • ${toSuffix(row.price)} NEXO`
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
            "🛒 Pickaxe Shop",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n",
                )
              : "ยังไม่มี Pickaxe ในร้าน",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "💰 Wallet",
              value:
                `**${toSuffix(balance)} NEXO**`,
              inline: true,
            },
            {
              name: "💪 Power",
              value:
                `**Lv.${toSuffix(String(catalog.highestPowerLevel))}**`,
              inline: true,
            },
          )
          .setFooter({
            text:
              "Legendary+ หาได้จาก Mining Drop หรือ Trade",
          }),
      ],

      components,
    };
  },

  async items(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const itemUseQuantity =
      minerUiPreferenceService
        .getItemUseQuantity(
          ownerId,
        );

    const inventory =
      await MinerInventoryItem
        .find({
          discordId:
            ownerId,

          quantity: {
            $gt: 0,
          },
        });

    const visible =
      inventory.slice(
        0,
        20,
      );

    const lines =
      visible.map(
        (entry) => {
          const item =
            MINER_ITEM_MAP.get(
              entry.itemId,
            );

          return (
            `${item?.emoji ?? "📦"} ` +
            `**${item?.name ?? entry.itemId}** ` +
            `×${toSuffix(String(entry.quantity))}`
          );
        },
      );

    const usable =
      inventory
        .filter((entry) => {
          const item =
            MINER_ITEM_MAP.get(
              entry.itemId,
            );

          return Boolean(
            item?.effect &&
            (
              item.type === "boost" ||
              item.effect.infiniteBag ||
              item.effect.timeWarpSeconds ||
              item.effect.maxWeightLevels ||
              item.effect.chestSlots ||
              item.effect.prestigeStars
            ),
          );
        })
        .slice(0, 25);

    const components:
      ActionRowBuilder<any>[] = [
        ...nav(
          ownerId,
          "items",
        ),

        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            button(
              ownerId,
              "set_item_qty",
              `Use ×${itemUseQuantity}`,
              "🧮",
              ButtonStyle.Primary,
            ),
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
                `🧪 เลือก Item เพื่อใช้ ×${itemUseQuantity}`,
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
                        `${rarityText(item.rarity)} • Owned ×${toSuffix(String(entry.quantity))}`
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
            "🧪 Items",
          )
          .setDescription(
            lines.length
              ? lines.join(
                  "\n",
                )
              : "ยังไม่มี Miner Item",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "🧮 Use Qty",
              value:
                `**×${itemUseQuantity}**`,
              inline: true,
            },
          )
          .setFooter({
            text:
              inventory.length > 20
                ? `${inventory.length} item types • showing 20`
                : `${inventory.length} item types`,
          }),
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

    const labels:
      Record<string, string> = {
        power: "Power",
        luck: "Luck",
        size: "Size",
        sell: "Sell",
        speed: "Mining Speed",
        xp: "XP",
        drop: "Drop Rate",
        mutation: "Mutation Chance",
        all: "All Stats",
      };

    const lines =
      boosts.map(
        (boost) => {
          const label =
            labels[
              boost.stat
            ] ??
            boost.stat;

          return (
            `⚡ **${label} ×${toSuffix(boost.multiplier)}**` +
            ` · <t:${Math.floor(boost.expiresAt.getTime() / 1000)}:R>`
          );
        },
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
                  "\n",
                )
              : "ไม่มี Boost ที่กำลังทำงาน",
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
    const shopQuantity =
      minerUiPreferenceService
        .getShopQuantity(
          ownerId,
        );

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
            `${item.emoji} **${item.name}** — ${toSuffix(item.shopPrice!)} NEXO`,
        );

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🛒 Shop",
          )
          .setDescription(
            lines.join(
              "\n",
            ),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "🧮 Buy Qty",
              value:
                `**×${shopQuantity}**`,
              inline: true,
            },
            {
              name: "💰 Wallet",
              value:
                `**${toSuffix(balance)} NEXO**`,
              inline: true,
            },
          )
          .setFooter({
            text:
              `เลือก Item ด้านล่างเพื่อซื้อ • ×${shopQuantity} ต่อครั้ง`,
          }),
      ],

      components: [
        ...nav(
          ownerId,
          "shop",
        ),

        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            button(
              ownerId,
              "set_shop_qty",
              `Buy ×${shopQuantity}`,
              "🧮",
              ButtonStyle.Primary,
            ),
          ),

        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `nexo_miner_select:buy:${ownerId}`,
              )
              .setPlaceholder(
                `🛒 เลือก Item เพื่อซื้อ ×${shopQuantity}`,
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

    const visible =
      stacks.slice(
        0,
        20,
      );

    const lines =
      visible.map(
        (stack) => {
          const info =
            minerOreVariantService
              .getDisplayInfo(
                stack.definitionId,
              );

          const quantityText =
            stack.quantity > 1
              ? ` ×${toSuffix(String(stack.quantity))}`
              : "";

          return (
            `${info.name} ` +
            `(${toSuffix(stack.largestWeight)}kg)` +
            quantityText
          );
        },
      );

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
                "🎒 เลือกแร่เพื่อนำกลับเข้า Bag",
              )
              .addOptions(
                stacks
                  .slice(0, 25)
                  .map((stack) => {
                    const info =
                      minerOreVariantService
                        .getDisplayInfo(
                          stack.definitionId,
                        );

                    return {
                      label:
                        info.name.slice(
                          0,
                          100,
                        ),

                      value:
                        stack.definitionId,

                      description:
                        `${toSuffix(stack.largestWeight)}kg • ×${toSuffix(String(stack.quantity))}`
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
                  "\n",
                )
              : "Rare Chest ยังว่างอยู่",
          )
          .addFields(
            ...noticeField(
              notice,
            ),
          )
          .setFooter({
            text:
              stacks.length > 20
                ? `${stacks.length} ore types • showing 20`
                : `${stacks.length} ore types`,
          }),
      ],

      components,
    };
  },

  async progression(
    ownerId: string,
    notice?: string,
  ): Promise<InteractionEditReplyOptions> {
    const status =
      await minerProgressionService
        .getStatus(
          ownerId,
        );

    if (!status) {
      return missingProfile(
        ownerId,
      );
    }

    const profile =
      status.profile;

    const next =
      status.nextArea;

    const nextMineText =
      next
        ? `${next.emoji} **${next.name}** · Lv.${next.requiredLevel}`
        : "Ω **All Mine Areas unlocked**";

    return {
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "⭐ Progress",
          )
          .setDescription(
            [
              "🌍 **Current Mine**",
              `${status.area.emoji} ${status.area.name}`,
              "",
              "🔓 **Next Mine**",
              nextMineText,
            ].join(
              "\n",
            ),
          )
          .addFields(
            ...noticeField(
              notice,
            ),
            {
              name: "⭐ Level",
              value:
                `**Lv.${status.level}**\n${toSuffix(status.xp)} / ${toSuffix(status.xpRequired)} XP`,
              inline: true,
            },
            {
              name: "🌟 Prestige",
              value:
                `**${profile.prestigeCount ?? 0} times • ${profile.prestigeStars ?? 0} stars**\nNext at Lv.${status.prestigeRequiredLevel}`,
              inline: true,
            },
            {
              name: "🔥 Ultra",
              value:
                `**${profile.ultraPrestigeCount ?? 0} times • ${profile.ultraCores ?? 0} cores**\nNeed Prestige ${status.ultraRequiredPrestiges} + Lv.${status.ultraRequiredLevel}`,
              inline: true,
            },
          )
          .setFooter({
            text:
              "Prestige keeps Pickaxes • Chest • Items • Wallet",
          }),
      ],

      components: [
        ...nav(
          ownerId,
          "progression",
        ),

        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            button(
              ownerId,
              "prestige",
              "Prestige",
              "⭐",
              ButtonStyle.Success,
            ),
            button(
              ownerId,
              "ultra_prestige",
              "Ultra Prestige",
              "🔥",
              ButtonStyle.Danger,
            ),
          ),
      ],
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
    const tradeItemQuantity =
      minerUiPreferenceService
        .getTradeItemQuantity(
          ownerId,
        );

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
          `⛏️ ${minerOreVariantService.getDisplayInfo(ore.definitionId).name} • ${toSuffix(ore.totalNetWorth)} NW`,
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

          definitionId: {
            $not: /~/,
          },
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

            new ButtonBuilder()
              .setCustomId(
                `nexo_miner:set_trade_item_qty:${ownerId}:${tradeId}`,
              )
              .setLabel(
                `Item ×${tradeItemQuantity}`,
              )
              .setEmoji("🧮")
              .setStyle(
                ButtonStyle.Secondary,
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
                `📦 เพิ่ม Item ×${tradeItemQuantity} เข้า Offer`,
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
                        minerOreVariantService.getDisplayInfo(
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

      case "progression":
        return this.progression(
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
