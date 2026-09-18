import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  type Guild,
} from "discord.js";

import {
  DUNGEONS,
  DUNGEON_SLOTS,
  DUNGEON_WEAPON_TYPES,
  DIFFICULTY_DATA,
  MATERIALS,
  RARITY_DATA,
  SLOT_NAMES,
  WEAPON_DATA,
  type DungeonDifficulty,
  type DungeonRarity,
  type DungeonSlot,
  type DungeonWeaponType,
} from "../../game/nexoDungeons/catalog.js";

import {
  dungeonService,
} from "./dungeonService.js";

import {
  communityLoggingService,
} from "../logging/communityLoggingService.js";

const COLOR = 0x5338e8;

export const DUNGEON_UI_PREFIX =
  "nexora_dungeon:";

const rarityRank = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "ancient",
  "divine",
];

function cut(
  value: string,
  max = 1024,
): string {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(
    0,
    max - 1,
  )}…`;
}

function homeButton() {
  return new ButtonBuilder()
    .setCustomId(
      `${DUNGEON_UI_PREFIX}home`,
    )
    .setLabel("หน้าหลัก")
    .setEmoji("🏠")
    .setStyle(
      ButtonStyle.Secondary,
    );
}

function inventoryButton() {
  return new ButtonBuilder()
    .setCustomId(
      `${DUNGEON_UI_PREFIX}inventory`,
    )
    .setLabel("Inventory")
    .setEmoji("🎒")
    .setStyle(
      ButtonStyle.Secondary,
    );
}

async function requireProfile(
  discordId: string,
) {
  const data =
    await dungeonService
      .getProfile(
        discordId,
      );

  if (!data) {
    throw new Error(
      "ยังไม่มีตัวละคร Dungeon",
    );
  }

  return data;
}

function starterPayload(
  displayName: string,
) {
  const weaponSelect =
    new StringSelectMenuBuilder()
      .setCustomId(
        `${DUNGEON_UI_PREFIX}create`,
      )
      .setPlaceholder(
        "เลือกอาวุธเริ่มต้น",
      )
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        ...DUNGEON_WEAPON_TYPES.map(
          (type) => ({
            label:
              `${WEAPON_DATA[type].emoji} ${WEAPON_DATA[type].name}`,

            description:
              cut(
                WEAPON_DATA[type]
                  .description,
                100,
              ),

            value:
              type,
          }),
        ),
      );

  const embed =
    new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(
        "⚔️ NEXORA Dungeons",
      )
      .setDescription(
        [
          `ยินดีต้อนรับ **${displayName}**`,
          "",
          "คุณยังไม่มีตัวละคร Dungeon",
          "เลือก Starter Weapon ด้านล่างเพื่อเริ่มเล่น",
          "",
          "ไม่มี Class ล็อกตัวละคร",
          "อาวุธที่สวมใส่จะเป็นตัวกำหนด Build",
        ].join("\n"),
      )
      .addFields({
        name:
          "🎮 Gameplay",

        value: [
          "เลือกอาวุธ",
          "→ เลือก Dungeon",
          "→ เลือก Difficulty",
          "→ Run",
          "→ รับ NEXO / EXP / Equipment / Materials",
          "→ Equip / Upgrade / Forge",
        ].join("\n"),
      })
      .setFooter({
        text:
          "NEXORA Dungeons • Interactive Mode",
      });

  return {
    content:
      null,

    embeds: [
      embed,
    ],

    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          weaponSelect,
        ),
    ],
  };
}

async function home(
  discordId: string,
  displayName: string,
  notice?: string,
) {
  const data =
    await dungeonService
      .getProfile(
        discordId,
      );

  if (!data) {
    return starterPayload(
      displayName,
    );
  }

  const {
    profile,
    stats,
    balance,
  } = data;

  const required =
    dungeonService
      .xpRequired(
        profile.level,
      );

  const weapon =
    WEAPON_DATA[
      stats.weaponType
    ];

  const unlocked =
    DUNGEONS.filter(
      (dungeon) =>
        profile.level >=
        dungeon.minLevel,
    ).length;

  const embed =
    new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(
        `⚔️ ${displayName} • Dungeon Dashboard`,
      )
      .setDescription(
        [
          `${weapon.emoji} **${weapon.name} Build**`,
          "",
          `📈 Level **${profile.level}/120**`,
          `✨ EXP **${
            profile.level >= 120
              ? "MAX"
              : `${profile.xp.toLocaleString()} / ${required.toLocaleString()}`
          }**`,
          `🌟 Ascension **${profile.ascension}**`,
          `💠 **${balance} NEXO**`,
          "",
          `🗺️ Dungeon **${unlocked}/${DUNGEONS.length}**`,
          `🏆 Clears **${profile.successfulRuns.toLocaleString()} / ${profile.totalRuns.toLocaleString()}**`,
        ].join("\n"),
      )
      .addFields(
        {
          name: "❤️ HP",
          value:
            Math.round(
              stats.maxHp,
            ).toLocaleString(),
          inline: true,
        },

        {
          name: "⚔️ ATK",
          value:
            Math.round(
              stats.attack,
            ).toLocaleString(),
          inline: true,
        },

        {
          name: "🛡️ DEF",
          value:
            Math.round(
              stats.defense,
            ).toLocaleString(),
          inline: true,
        },
      )
      .setFooter({
        text:
          "เล่นทั้งหมดผ่าน Dashboard นี้",
      })
      .setTimestamp();

  return {
    content:
      notice ??
      null,

    embeds: [
      embed,
    ],

    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}profile`,
            )
            .setLabel("Profile")
            .setEmoji("👤")
            .setStyle(
              ButtonStyle.Secondary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}dungeons`,
            )
            .setLabel(
              "เข้า Dungeon",
            )
            .setEmoji("⚔️")
            .setStyle(
              ButtonStyle.Primary,
            ),

          inventoryButton(),

          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}forge`,
            )
            .setLabel("Forge")
            .setEmoji("🔥")
            .setStyle(
              ButtonStyle.Secondary,
            ),
        ),

      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}ascend`,
            )
            .setLabel("Ascend")
            .setEmoji("✨")
            .setStyle(
              ButtonStyle.Success,
            )
            .setDisabled(
              profile.level < 120,
            ),

          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}home`,
            )
            .setLabel("Refresh")
            .setEmoji("🔄")
            .setStyle(
              ButtonStyle.Secondary,
            ),
        ),
    ],
  };
}

async function profile(
  discordId: string,
  displayName: string,
) {
  const {
    profile,
    stats,
    balance,
  } =
    await requireProfile(
      discordId,
    );

  const required =
    dungeonService
      .xpRequired(
        profile.level,
      );

  const weapon =
    WEAPON_DATA[
      stats.weaponType
    ];

  const equipped =
    (
      stats.items ??
      []
    )
      .map(
        (item: any) => {
          const rarity =
            RARITY_DATA[
              item.rarity as
                DungeonRarity
            ];

          return (
            `${rarity?.emoji ?? "▫️"} ` +
            `**${SLOT_NAMES[item.slot as DungeonSlot]}:** ` +
            `${item.name} +${item.upgradeLevel}`
          );
        },
      )
      .join("\n") ||
    "ยังไม่มี Equipment";

  const embed =
    new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(
        `👤 ${displayName} • Dungeon Profile`,
      )
      .setDescription(
        `${weapon.emoji} Build ปัจจุบัน: **${weapon.name}**`,
      )
      .addFields(
        {
          name:
            "📈 Progression",

          value: [
            `Level **${profile.level}/120**`,
            `EXP **${
              profile.level >= 120
                ? "MAX"
                : `${profile.xp.toLocaleString()} / ${required.toLocaleString()}`
            }**`,
            `Ascension **${profile.ascension}**`,
            `Ascension Points **${profile.ascensionPoints}**`,
            `💠 **${balance} NEXO**`,
          ].join("\n"),

          inline:
            true,
        },

        {
          name:
            "⚔️ Combat",

          value: [
            `❤️ HP **${Math.round(stats.maxHp).toLocaleString()}**`,
            `⚔️ ATK **${Math.round(stats.attack).toLocaleString()}**`,
            `🛡️ DEF **${Math.round(stats.defense).toLocaleString()}**`,
            `💥 CRIT **${(stats.critChance * 100).toFixed(1)}%**`,
            `💨 Dodge **${(stats.dodge * 100).toFixed(1)}%**`,
          ].join("\n"),

          inline:
            true,
        },

        {
          name:
            "🎽 Equipped",

          value:
            cut(
              equipped,
            ),
        },

        {
          name:
            "🏆 Record",

          value:
            `Runs **${profile.totalRuns.toLocaleString()}** • Clears **${profile.successfulRuns.toLocaleString()}** • Bosses **${profile.bossesDefeated.toLocaleString()}**`,
        },
      )
      .setTimestamp();

  return {
    content:
      null,

    embeds: [
      embed,
    ],

    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          inventoryButton(),
          homeButton(),
        ),
    ],
  };
}

async function runSetup(
  discordId: string,
  dungeonId?: string,
  difficulty:
    DungeonDifficulty =
      "normal",
) {
  const {
    profile,
  } =
    await requireProfile(
      discordId,
    );

  const fallback =
    [
      ...DUNGEONS,
    ]
      .reverse()
      .find(
        (dungeon) =>
          profile.level >=
          dungeon.minLevel,
      ) ??
    DUNGEONS[0]!;

  const dungeon =
    DUNGEONS.find(
      (entry) =>
        entry.id ===
        dungeonId,
    ) ??
    fallback;

  const difficultyData =
    DIFFICULTY_DATA[
      difficulty
    ];

  const requiredLevel =
    dungeon.minLevel +
    difficultyData
      .levelOffset;

  const canRun =
    profile.level >=
    requiredLevel;

  const dungeonSelect =
    new StringSelectMenuBuilder()
      .setCustomId(
        `${DUNGEON_UI_PREFIX}select_dungeon:${difficulty}`,
      )
      .setPlaceholder(
        `${dungeon.emoji} ${dungeon.name}`,
      )
      .addOptions(
        ...DUNGEONS.map(
          (entry) => ({
            label:
              `${entry.emoji} ${entry.name}`,

            description:
              `Lv.${entry.minLevel}+ • ${entry.materialName}`,

            value:
              entry.id,
          }),
        ),
      );

  const difficultySelect =
    new StringSelectMenuBuilder()
      .setCustomId(
        `${DUNGEON_UI_PREFIX}select_difficulty:${dungeon.id}`,
      )
      .setPlaceholder(
        `Difficulty: ${difficultyData.name}`,
      )
      .addOptions(
        ...Object.entries(
          DIFFICULTY_DATA,
        )
          .map(
            ([
              value,
              info,
            ]) => ({
              label:
                info.name,

              description:
                `+${info.levelOffset} Lv • ×${info.rewardMultiplier} Reward`,

              value,
            }),
          ),
      );

  const map =
    DUNGEONS.map(
      (entry) =>
        `${
          profile.level >=
          entry.minLevel
            ? "✅"
            : "🔒"
        } ${entry.emoji} **${entry.name}** • Lv.${entry.minLevel}+`,
    ).join("\n");

  const embed =
    new EmbedBuilder()
      .setColor(
        canRun
          ? COLOR
          : 0xb23cff,
      )
      .setTitle(
        `🗺️ ${dungeon.emoji} ${dungeon.name}`,
      )
      .setDescription(
        [
          `**Difficulty:** ${difficultyData.name}`,
          `**Required Level:** ${requiredLevel}`,
          `**Your Level:** ${profile.level}`,
          `**Rewards:** ×${difficultyData.rewardMultiplier}`,
          `**Material:** ${dungeon.materialName}`,
          "",
          canRun
            ? "✅ พร้อมเข้าสู่ Dungeon"
            : `🔒 ต้องการ Level ${requiredLevel}`,
        ].join("\n"),
      )
      .addFields({
        name:
          "Dungeon Map",

        value:
          map,
      })
      .setFooter({
        text:
          "เลือก Dungeon + Difficulty แล้วกด Run",
      });

  return {
    content:
      null,

    embeds: [
      embed,
    ],

    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          dungeonSelect,
        ),

      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          difficultySelect,
        ),

      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}run:${dungeon.id}:${difficulty}`,
            )
            .setLabel(
              "Run Dungeon",
            )
            .setEmoji("⚔️")
            .setStyle(
              ButtonStyle.Primary,
            )
            .setDisabled(
              !canRun,
            ),

          homeButton(),
        ),
    ],
  };
}

async function inventory(
  discordId: string,
  notice?: string,
) {
  await requireProfile(
    discordId,
  );

  const data =
    await dungeonService
      .getInventory(
        discordId,
      );

  const items =
    data.items
      .slice(
        0,
        15,
      )
      .map(
        (item: any) => {
          const rarity =
            RARITY_DATA[
              item.rarity as
                DungeonRarity
            ];

          return [
            item.equipped
              ? "✅"
              : "▫️",

            rarity?.emoji ??
              "▫️",

            `**${item.name}**`,

            `Lv.${item.itemLevel}`,

            `+${item.upgradeLevel}`,
          ].join(" ");
        },
      )
      .join("\n") ||
    "ยังไม่มี Equipment";

  const materials =
    data.materials
      .map(
        (material: any) =>
          `• **${material.name}** × ${material.quantity.toLocaleString()}`,
      )
      .join("\n") ||
    "ยังไม่มี Materials";

  const embed =
    new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(
        "🎒 Dungeon Inventory",
      )
      .addFields(
        {
          name:
            `Equipment (${data.items.length})`,

          value:
            cut(
              items,
            ),
        },

        {
          name:
            "Materials",

          value:
            cut(
              materials,
            ),
        },
      )
      .setFooter({
        text:
          "✅ = Equipped • เลือก Equipment ด้านล่างเพื่อจัดการ",
      });

  const rows:
    ActionRowBuilder<any>[] =
      [];

  if (
    data.items.length >
    0
  ) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}select_item`,
            )
            .setPlaceholder(
              "เลือก Equipment",
            )
            .addOptions(
              ...data.items
                .slice(
                  0,
                  25,
                )
                .map(
                  (item: any) => ({
                    label:
                      cut(
                        `${item.equipped ? "✓ " : ""}${item.name}`,
                        100,
                      ),

                    description:
                      cut(
                        `${SLOT_NAMES[item.slot as DungeonSlot]} • Lv.${item.itemLevel} • +${item.upgradeLevel}`,
                        100,
                      ),

                    value:
                      item.instanceId,
                  }),
                ),
            ),
        ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `${DUNGEON_UI_PREFIX}forge`,
          )
          .setLabel("Forge")
          .setEmoji("🔥")
          .setStyle(
            ButtonStyle.Primary,
          ),

        homeButton(),
      ),
  );

  return {
    content:
      notice ??
      null,

    embeds: [
      embed,
    ],

    components:
      rows,
  };
}

async function item(
  discordId: string,
  instanceId: string,
  notice?: string,
) {
  await requireProfile(
    discordId,
  );

  const inventory =
    await dungeonService
      .getInventory(
        discordId,
      );

  const selected =
    inventory.items.find(
      (entry: any) =>
        entry.instanceId ===
        instanceId,
    );

  if (!selected) {
    throw new Error(
      "ไม่พบ Equipment นี้",
    );
  }

  const rarity =
    RARITY_DATA[
      selected.rarity as
        DungeonRarity
    ];

  const baseStats =
    [
      Number(
        selected.stats
          ?.attack ??
        0,
      ) > 0
        ? `⚔️ ATK +${selected.stats.attack}`
        : null,

      Number(
        selected.stats
          ?.defense ??
        0,
      ) > 0
        ? `🛡️ DEF +${selected.stats.defense}`
        : null,

      Number(
        selected.stats
          ?.hp ??
        0,
      ) > 0
        ? `❤️ HP +${selected.stats.hp}`
        : null,

      Number(
        selected.stats
          ?.critChance ??
        0,
      ) > 0
        ? `💥 CRIT +${(selected.stats.critChance * 100).toFixed(1)}%`
        : null,

      Number(
        selected.stats
          ?.dodge ??
        0,
      ) > 0
        ? `💨 Dodge +${(selected.stats.dodge * 100).toFixed(1)}%`
        : null,
    ]
      .filter(
        Boolean,
      )
      .join("\n") ||
    "ไม่มี Base Stats";

  const affixes =
    (
      selected.affixes ??
      []
    )
      .map(
        (affix: any) =>
          `• ${affix.label}: +${affix.value}`,
      )
      .join("\n") ||
    "ไม่มี Affix";

  const embed =
    new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(
        `${rarity?.emoji ?? "▫️"} ${selected.name}`,
      )
      .setDescription(
        selected.equipped
          ? "✅ **Equipped อยู่**"
          : "▫️ ยังไม่ได้สวมใส่",
      )
      .addFields(
        {
          name:
            "Equipment",

          value: [
            `Slot **${SLOT_NAMES[selected.slot as DungeonSlot]}**`,
            `Rarity **${rarity?.name ?? selected.rarity}**`,
            `Item Level **${selected.itemLevel}**`,
            `Upgrade **+${selected.upgradeLevel}/+20**`,
            `ID \`${selected.instanceId}\``,
          ].join("\n"),

          inline:
            true,
        },

        {
          name:
            "Base Stats",

          value:
            baseStats,

          inline:
            true,
        },

        {
          name:
            "Affixes",

          value:
            cut(
              affixes,
            ),
        },
      );

  return {
    content:
      notice ??
      null,

    embeds: [
      embed,
    ],

    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}equip:${selected.instanceId}`,
            )
            .setLabel(
              selected.equipped
                ? "Equipped"
                : "Equip",
            )
            .setEmoji("✅")
            .setStyle(
              ButtonStyle.Success,
            )
            .setDisabled(
              Boolean(
                selected.equipped,
              ),
            ),

          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}upgrade:${selected.instanceId}`,
            )
            .setLabel(
              selected.upgradeLevel >=
                20
                ? "MAX +20"
                : `Upgrade +${selected.upgradeLevel + 1}`,
            )
            .setEmoji("🔨")
            .setStyle(
              ButtonStyle.Primary,
            )
            .setDisabled(
              selected.upgradeLevel >=
              20,
            ),

          inventoryButton(),

          homeButton(),
        ),
    ],
  };
}

async function forge(
  discordId: string,
  slot:
    DungeonSlot =
      "weapon",
  materialId?:
    string,
  weaponType:
    DungeonWeaponType =
      "sword",
) {
  const {
    profile,
  } =
    await requireProfile(
      discordId,
    );

  const inventory =
    await dungeonService
      .getInventory(
        discordId,
      );

  const quantities =
    new Map<string, number>(
      inventory.materials
        .map(
          (material: any) => [
            String(
              material.materialId,
            ),
            Number(
              material.quantity ??
              0,
            ),
          ],
        ),
    );

  const selectedMaterial =
    MATERIALS.find(
      (material) =>
        material.id ===
        materialId,
    ) ??
    MATERIALS[0]!;

  const quantity =
    quantities.get(
      selectedMaterial.id,
    ) ??
    0;

  const materialCost =
    12;

  const nexoCost =
    Math.floor(
      500 +
      profile.level *
        75 +
      profile.ascension *
        500,
    );

  const rows:
    ActionRowBuilder<any>[] =
      [
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `${DUNGEON_UI_PREFIX}forge_slot:${selectedMaterial.id}:${weaponType}`,
              )
              .setPlaceholder(
                `Slot: ${SLOT_NAMES[slot]}`,
              )
              .addOptions(
                ...DUNGEON_SLOTS
                  .map(
                    (value) => ({
                      label:
                        SLOT_NAMES[value],

                      value,
                    }),
                  ),
              ),
          ),

        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(
                `${DUNGEON_UI_PREFIX}forge_material:${slot}:${weaponType}`,
              )
              .setPlaceholder(
                `Material: ${selectedMaterial.name}`,
              )
              .addOptions(
                ...MATERIALS
                  .map(
                    (material) => ({
                      label:
                        material.name,

                      description:
                        `มี ${quantities.get(material.id) ?? 0} • ใช้ 12`,

                      value:
                        material.id,
                    }),
                  ),
              ),
          ),
      ];

  if (
    slot ===
    "weapon"
  ) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}forge_weapon:${selectedMaterial.id}`,
            )
            .setPlaceholder(
              `Weapon: ${WEAPON_DATA[weaponType].name}`,
            )
            .addOptions(
              ...DUNGEON_WEAPON_TYPES
                .map(
                  (type) => ({
                    label:
                      `${WEAPON_DATA[type].emoji} ${WEAPON_DATA[type].name}`,

                    description:
                      cut(
                        WEAPON_DATA[type]
                          .description,
                        100,
                      ),

                    value:
                      type,
                  }),
                ),
            ),
        ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `${DUNGEON_UI_PREFIX}forge_submit:${slot}:${selectedMaterial.id}:${slot === "weapon" ? weaponType : "none"}`,
          )
          .setLabel(
            "Forge Equipment",
          )
          .setEmoji("🔥")
          .setStyle(
            ButtonStyle.Primary,
          )
          .setDisabled(
            quantity <
            materialCost,
          ),

        inventoryButton(),

        homeButton(),
      ),
  );

  const embed =
    new EmbedBuilder()
      .setColor(
        quantity >=
          materialCost
          ? 0xff8c32
          : 0x6b7280,
      )
      .setTitle(
        "🔥 Dungeon Forge",
      )
      .setDescription(
        [
          `**Slot:** ${SLOT_NAMES[slot]}`,
          slot === "weapon"
            ? `**Weapon:** ${WEAPON_DATA[weaponType].emoji} ${WEAPON_DATA[weaponType].name}`
            : null,
          `**Material:** ${selectedMaterial.name}`,
          `**มี:** ${quantity}/${materialCost}`,
          `**NEXO Cost:** ${nexoCost.toLocaleString()}`,
          "",
          quantity >=
            materialCost
            ? "✅ Materials เพียงพอ"
            : `❌ ขาด ${materialCost - quantity} ${selectedMaterial.name}`,
        ]
          .filter(
            Boolean,
          )
          .join("\n"),
      )
      .setFooter({
        text:
          "Forge จะสุ่ม Rarity และ Affixes",
      });

  return {
    content:
      null,

    embeds: [
      embed,
    ],

    components:
      rows,
  };
}

async function run(
  discordId: string,
  dungeonId: string,
  difficulty:
    DungeonDifficulty,
  guild:
    Guild |
    null,
) {
  const result =
    await dungeonService
      .run(
        discordId,
        dungeonId,
        difficulty,
      );

  const roomText =
    result.rooms
      .map(
        (
          room: any,
          index: number,
        ) =>
          `**${index + 1}.** ${String(room.result ?? room.type)}`,
      )
      .join("\n");

  const items =
    result.items.length >
    0
      ? result.items
          .map(
            (item: any) => {
              const rarity =
                RARITY_DATA[
                  item.rarity as
                    DungeonRarity
                ];

              return (
                `${rarity?.emoji ?? "▫️"} **${item.name}** ` +
                `• Lv.${item.itemLevel}`
              );
            },
          )
          .join("\n")
      : "ไม่มี";

  const materials =
    result.materials
      .filter(
        (material: any) =>
          material.quantity >
          0,
      )
      .map(
        (material: any) =>
          `• ${material.name} × **${material.quantity}**`,
      )
      .join("\n") ||
    "ไม่มี";

  const embed =
    new EmbedBuilder()
      .setColor(
        result.success
          ? 0x00d9ff
          : 0xb23cff,
      )
      .setTitle(
        result.success
          ? `🏆 CLEARED • ${result.dungeon.name}`
          : `💀 FAILED • ${result.dungeon.name}`,
      )
      .setDescription(
        cut(
          roomText,
          4000,
        ),
      )
      .addFields(
        {
          name:
            "Difficulty",

          value:
            result.difficultyData
              .name,

          inline:
            true,
        },

        {
          name:
            "HP",

          value:
            `${result.hp.toLocaleString()} / ${result.maxHp.toLocaleString()}`,

          inline:
            true,
        },

        {
          name:
            "Level",

          value:
            `${result.profile.level}${
              result.levelsGained >
              0
                ? ` ⬆️ +${result.levelsGained}`
                : ""
            }`,

          inline:
            true,
        },

        {
          name:
            "Rewards",

          value: [
            `✨ **${result.xp.toLocaleString()} EXP**`,
            `💠 **${result.nexo.toLocaleString()} NEXO**`,
          ].join("\n"),

          inline:
            true,
        },

        {
          name:
            "Materials",

          value:
            cut(
              materials,
            ),

          inline:
            true,
        },

        {
          name:
            "Equipment Drops",

          value:
            cut(
              items,
            ),
        },
      )
      .setFooter({
        text:
          `Run ${result.run.runId}`,
      });

  if (guild) {
    await communityLoggingService
      .rpg(
        guild,
        {
          event:
            "dungeon_run",

          title:
            result.success
              ? "Dungeon Cleared"
              : "Dungeon Failed",

          severity:
            result.success
              ? "success"
              : "info",

          userId:
            discordId,

          fields: [
            {
              name:
                "Dungeon",

              value:
                result.dungeon.name,

              inline:
                true,
            },

            {
              name:
                "Difficulty",

              value:
                result.difficultyData
                  .name,

              inline:
                true,
            },

            {
              name:
                "EXP",

              value:
                result.xp
                  .toLocaleString(),

              inline:
                true,
            },
          ],

          metadata: {
            runId:
              result.run.runId,

            dungeonId:
              result.dungeon.id,

            difficulty,

            success:
              result.success,
          },
        },
      )
      .catch(
        () =>
          undefined,
      );

    for (
      const dropped of
      result.items
    ) {
      const rank =
        rarityRank.indexOf(
          String(
            dropped.rarity,
          ),
        );

      if (
        rank <
        rarityRank.indexOf(
          "legendary",
        )
      ) {
        continue;
      }

      await communityLoggingService
        .rpg(
          guild,
          {
            event:
              "rare_drop",

            title:
              "Rare Equipment Drop",

            severity:
              "success",

            userId:
              discordId,

            fields: [
              {
                name:
                  "Item",

                value:
                  `${RARITY_DATA[dropped.rarity as DungeonRarity].emoji} **${dropped.name}**`,
              },

              {
                name:
                  "Rarity",

                value:
                  String(
                    dropped.rarity,
                  ),

                inline:
                  true,
              },
            ],

            metadata: {
              instanceId:
                dropped.instanceId,

              dungeonId:
                result.dungeon.id,
            },
          },
        )
        .catch(
          () =>
            undefined,
        );
    }
  }

  return {
    content:
      null,

    embeds: [
      embed,
    ],

    components: [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}run:${result.dungeon.id}:${difficulty}`,
            )
            .setLabel(
              "Run Again",
            )
            .setEmoji("🔁")
            .setStyle(
              ButtonStyle.Primary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `${DUNGEON_UI_PREFIX}dungeons:${result.dungeon.id}:${difficulty}`,
            )
            .setLabel(
              "เปลี่ยนด่าน",
            )
            .setEmoji("🗺️")
            .setStyle(
              ButtonStyle.Secondary,
            ),

          inventoryButton(),

          homeButton(),
        ),
    ],
  };
}

export const dungeonUiService = {
  async home(
    discordId:
      string,

    displayName:
      string,

    notice?:
      string,
  ) {
    return home(
      discordId,
      displayName,
      notice,
    );
  },

  async profile(
    discordId:
      string,

    displayName:
      string,
  ) {
    return profile(
      discordId,
      displayName,
    );
  },

  async runSetup(
    discordId:
      string,

    dungeonId?:
      string,

    difficulty:
      DungeonDifficulty =
        "normal",
  ) {
    return runSetup(
      discordId,
      dungeonId,
      difficulty,
    );
  },

  async inventory(
    discordId:
      string,
  ) {
    return inventory(
      discordId,
    );
  },

  async item(
    discordId:
      string,

    instanceId:
      string,
  ) {
    return item(
      discordId,
      instanceId,
    );
  },

  async forge(
    discordId:
      string,

    slot:
      DungeonSlot =
        "weapon",

    materialId?:
      string,

    weaponType:
      DungeonWeaponType =
        "sword",
  ) {
    return forge(
      discordId,
      slot,
      materialId,
      weaponType,
    );
  },

  async createCharacter(
    discordId:
      string,

    displayName:
      string,

    weaponType:
      DungeonWeaponType,
  ) {
    const result =
      await dungeonService
        .createCharacter(
          discordId,
          weaponType,
        );

    return home(
      discordId,
      displayName,
      `⚔️ สร้างตัวละครสำเร็จ • **${result.starter.name}**`,
    );
  },

  async equip(
    discordId:
      string,

    instanceId:
      string,
  ) {
    const equipped =
      await dungeonService
        .equip(
          discordId,
          instanceId,
        );

    return item(
      discordId,
      instanceId,
      `✅ สวมใส่ **${equipped.name}** แล้ว`,
    );
  },

  async upgrade(
    discordId:
      string,

    instanceId:
      string,
  ) {
    const result =
      await dungeonService
        .upgradeItem(
          discordId,
          instanceId,
        );

    return item(
      discordId,
      instanceId,
      `🔨 **${result.item.name} +${result.item.upgradeLevel}** • ใช้ ${result.cost.toLocaleString()} NEXO`,
    );
  },

  async forgeSubmit(
    discordId:
      string,

    slot:
      DungeonSlot,

    materialId:
      string,

    weaponType:
      DungeonWeaponType |
      null,
  ) {
    const result =
      await dungeonService
        .forgeItem(
          discordId,
          slot,
          materialId,
          weaponType,
        );

    const rarity =
      RARITY_DATA[
        result.item.rarity as
          DungeonRarity
      ];

    return item(
      discordId,
      result.item.instanceId,
      `🔥 Forge สำเร็จ • ${rarity.emoji} **${result.item.name}** • ${result.nexoCost.toLocaleString()} NEXO`,
    );
  },

  async run(
    discordId:
      string,

    dungeonId:
      string,

    difficulty:
      DungeonDifficulty,

    guild:
      Guild |
      null,
  ) {
    return run(
      discordId,
      dungeonId,
      difficulty,
      guild,
    );
  },

  async ascend(
    discordId:
      string,

    displayName:
      string,

    guild:
      Guild |
      null,
  ) {
    const profile =
      await dungeonService
        .ascend(
          discordId,
        );

    if (guild) {
      await communityLoggingService
        .rpg(
          guild,
          {
            event:
              "ascension",

            title:
              "Player Ascended",

            severity:
              "success",

            userId:
              discordId,

            fields: [
              {
                name:
                  "Ascension",

                value:
                  String(
                    profile.ascension,
                  ),

                inline:
                  true,
              },

              {
                name:
                  "Points",

                value:
                  String(
                    profile.ascensionPoints,
                  ),

                inline:
                  true,
              },
            ],
          },
        )
        .catch(
          () =>
            undefined,
        );
    }

    return home(
      discordId,
      displayName,
      `✨ Ascension **${profile.ascension}** สำเร็จ • Level รีเซ็ตเป็น 1`,
    );
  },
};
