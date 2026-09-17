import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  DUNGEONS,
  DIFFICULTY_DATA,
  MATERIALS,
  RARITY_DATA,
  SLOT_NAMES,
  WEAPON_DATA,
  type DungeonDifficulty,
  type DungeonSlot,
  type DungeonWeaponType,
} from "../game/nexoDungeons/catalog.js";

import {
  dungeonService,
} from "../services/dungeons/dungeonService.js";

import {
  communityLoggingService,
} from "../services/logging/communityLoggingService.js";

const COLOR =
  0x5338e8;

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
  if (
    value.length <=
    max
  ) {
    return value;
  }

  return (
    value.slice(
      0,
      max - 1,
    ) +
    "…"
  );
}

function errorMessage(
  error: unknown,
): string {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  return String(
    error,
  );
}

const weaponChoices =
  Object.entries(
    WEAPON_DATA,
  ).map(
    ([
      value,
      weapon,
    ]) => ({
      name:
        `${weapon.emoji} ${weapon.name}`,

      value,
    }),
  );

const dungeonChoices =
  DUNGEONS.map(
    (dungeon) => ({
      name:
        `${dungeon.emoji} ${dungeon.name}`,

      value:
        dungeon.id,
    }),
  );

const materialChoices =
  MATERIALS.map(
    (material) => ({
      name:
        material.name,

      value:
        material.id,
    }),
  );

export const data =
  new SlashCommandBuilder()
    .setName(
      "dungeon",
    )
    .setDescription(
      "⚔️ เล่น NEXORA Dungeons",
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "create",
          )
          .setDescription(
            "สร้างตัวละครและเลือกอาวุธเริ่มต้น",
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "weapon",
                )
                .setDescription(
                  "อาวุธเริ่มต้น",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  ...weaponChoices,
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "profile",
          )
          .setDescription(
            "ดูตัวละคร NEXORA Dungeons ของคุณ",
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "list",
          )
          .setDescription(
            "ดู Dungeon ทั้งหมด",
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "run",
          )
          .setDescription(
            "เข้าสู่ Dungeon",
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "dungeon",
                )
                .setDescription(
                  "Dungeon ที่ต้องการเข้า ถ้าไม่เลือกจะใช้ด่านสูงสุดที่เข้าได้",
                )
                .setRequired(
                  false,
                )
                .addChoices(
                  ...dungeonChoices,
                ),
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "difficulty",
                )
                .setDescription(
                  "ระดับความยาก",
                )
                .setRequired(
                  false,
                )
                .addChoices(
                  {
                    name:
                      "⚔️ Normal",
                    value:
                      "normal",
                  },

                  {
                    name:
                      "🔥 Hard",
                    value:
                      "hard",
                  },

                  {
                    name:
                      "💀 Nightmare",
                    value:
                      "nightmare",
                  },

                  {
                    name:
                      "🌌 Abyss",
                    value:
                      "abyss",
                  },
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "inventory",
          )
          .setDescription(
            "ดู Equipment และ Materials",
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "equip",
          )
          .setDescription(
            "สวมใส่ Equipment",
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "item",
                )
                .setDescription(
                  "Item ID เช่น ITEM-XXXXXXXX",
                )
                .setRequired(
                  true,
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "upgrade",
          )
          .setDescription(
            "อัปเกรด Equipment ด้วย NEXO",
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "item",
                )
                .setDescription(
                  "Item ID",
                )
                .setRequired(
                  true,
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "forge",
          )
          .setDescription(
            "สร้าง Equipment จาก Materials + NEXO",
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "slot",
                )
                .setDescription(
                  "ประเภท Equipment",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  {
                    name:
                      "⚔️ Weapon",
                    value:
                      "weapon",
                  },

                  {
                    name:
                      "🪖 Helmet",
                    value:
                      "helmet",
                  },

                  {
                    name:
                      "🛡️ Armor",
                    value:
                      "armor",
                  },

                  {
                    name:
                      "🧤 Gloves",
                    value:
                      "gloves",
                  },

                  {
                    name:
                      "🥾 Boots",
                    value:
                      "boots",
                  },

                  {
                    name:
                      "💍 Ring",
                    value:
                      "ring",
                  },

                  {
                    name:
                      "📿 Necklace",
                    value:
                      "necklace",
                  },

                  {
                    name:
                      "🔮 Artifact",
                    value:
                      "artifact",
                  },
                ),
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "material",
                )
                .setDescription(
                  "Material หลักที่ใช้",
                )
                .setRequired(
                  true,
                )
                .addChoices(
                  ...materialChoices,
                ),
          )
          .addStringOption(
            (option) =>
              option
                .setName(
                  "weapon",
                )
                .setDescription(
                  "เลือกเฉพาะเมื่อ Forge Weapon",
                )
                .setRequired(
                  false,
                )
                .addChoices(
                  ...weaponChoices,
                ),
          ),
    )

    .addSubcommand(
      (subcommand) =>
        subcommand
          .setName(
            "ascend",
          )
          .setDescription(
            "Ascend เมื่อถึง Level 120",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  const discordId =
    interaction.user.id;

  const subcommand =
    interaction.options
      .getSubcommand();

  try {
    if (
      subcommand ===
      "create"
    ) {
      const weaponType =
        interaction.options
          .getString(
            "weapon",
            true,
          ) as
            DungeonWeaponType;

      const result =
        await dungeonService
          .createCharacter(
            discordId,
            weaponType,
          );

      const weapon =
        WEAPON_DATA[
          weaponType
        ];

      const embed =
        new EmbedBuilder()
          .setColor(
            COLOR,
          )
          .setTitle(
            "⚔️ NEXORA Dungeons",
          )
          .setDescription(
            [
              `สร้างตัวละครสำเร็จแล้ว **${interaction.user.displayName}**`,
              "",
              `${weapon.emoji} **Starter Weapon:** ${result.starter.name}`,
              `> ${weapon.description}`,
              "",
              "ไม่มี Class ล็อกตัวละคร — เปลี่ยนอาวุธเมื่อไรก็เปลี่ยน Build ได้",
            ].join(
              "\n",
            ),
          )
          .addFields(
            {
              name:
                "Level",
              value:
                "1",
              inline:
                true,
            },

            {
              name:
                "Ascension",
              value:
                "0",
              inline:
                true,
            },

            {
              name:
                "เริ่มเล่น",
              value:
                "ใช้ `/dungeon run`",
              inline:
                true,
            },
          );

      await interaction.reply({
        embeds: [
          embed,
        ],
      });

      return;
    }

    if (
      subcommand ===
      "profile"
    ) {
      const data =
        await dungeonService
          .getProfile(
            discordId,
          );

      if (!data) {
        await interaction.reply({
          content:
            "❌ ยังไม่มีตัวละคร ใช้ `/dungeon create` ก่อน",

          ephemeral:
            true,
        });

        return;
      }

      const {
        profile,
        stats,
        balance,
      } =
        data;

      const required =
        dungeonService
          .xpRequired(
            profile.level,
          );

      const weapon =
        WEAPON_DATA[
          stats.weaponType
        ];

      const embed =
        new EmbedBuilder()
          .setColor(
            COLOR,
          )
          .setTitle(
            `⚔️ ${interaction.user.displayName} • Dungeon Profile`,
          )
          .setDescription(
            `${weapon.emoji} Build ปัจจุบัน: **${weapon.name}**`,
          )
          .addFields(
            {
              name:
                "Progression",
              value: [
                `**Level:** ${profile.level}/120`,
                `**EXP:** ${profile.level >= 120 ? "MAX" : `${profile.xp.toLocaleString()} / ${required.toLocaleString()}`}`,
                `**Ascension:** ${profile.ascension}`,
                `**Ascension Points:** ${profile.ascensionPoints}`,
              ].join(
                "\n",
              ),
              inline:
                true,
            },

            {
              name:
                "Combat",
              value: [
                `❤️ HP: **${Math.round(stats.maxHp).toLocaleString()}**`,
                `⚔️ ATK: **${Math.round(stats.attack).toLocaleString()}**`,
                `🛡️ DEF: **${Math.round(stats.defense).toLocaleString()}**`,
                `💥 CRIT: **${(stats.critChance * 100).toFixed(1)}%**`,
                `💨 Dodge: **${(stats.dodge * 100).toFixed(1)}%**`,
              ].join(
                "\n",
              ),
              inline:
                true,
            },

            {
              name:
                "Economy",
              value:
                `💠 **${balance} NEXO**`,
              inline:
                true,
            },

            {
              name:
                "Dungeon Record",
              value: [
                `Runs: **${profile.totalRuns.toLocaleString()}**`,
                `Clears: **${profile.successfulRuns.toLocaleString()}**`,
                `Bosses: **${profile.bossesDefeated.toLocaleString()}**`,
              ].join(
                "\n",
              ),
              inline:
                false,
            },
          );

      await interaction.reply({
        embeds: [
          embed,
        ],
      });

      return;
    }

    if (
      subcommand ===
      "list"
    ) {
      const lines =
        DUNGEONS.map(
          (
            dungeon,
            index,
          ) =>
            [
              `${index + 1}. ${dungeon.emoji} **${dungeon.name}**`,
              `Lv.${dungeon.minLevel}+ • ${dungeon.materialName}`,
            ].join(
              " — ",
            ),
        );

      const difficulty =
        Object.entries(
          DIFFICULTY_DATA,
        ).map(
          ([
            key,
            value,
          ]) =>
            `**${value.name}:** +${value.levelOffset} Lv • ×${value.rewardMultiplier} Reward`,
        );

      const embed =
        new EmbedBuilder()
          .setColor(
            COLOR,
          )
          .setTitle(
            "🗺️ NEXORA Dungeons",
          )
          .setDescription(
            lines.join(
              "\n",
            ),
          )
          .addFields({
            name:
              "Difficulty",
            value:
              difficulty.join(
                "\n",
              ),
          });

      await interaction.reply({
        embeds: [
          embed,
        ],
      });

      return;
    }

    if (
      subcommand ===
      "run"
    ) {
      const dungeonId =
        interaction.options
          .getString(
            "dungeon",
          ) ??
        undefined;

      const difficulty =
        (
          interaction.options
            .getString(
              "difficulty",
            ) ??
          "normal"
        ) as
          DungeonDifficulty;

      await interaction.deferReply();

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
              room,
              index,
            ) =>
              `**${index + 1}.** ${String(room.result ?? room.type)}`,
          )
          .join(
            "\n",
          );

      const itemText =
        result.items.length >
        0
          ? result.items
              .map(
                (item) => {
                  const rarity =
                    RARITY_DATA[
                      item.rarity as
                        keyof typeof RARITY_DATA
                    ];

                  return (
                    `${rarity.emoji} **${item.name}** ` +
                    `• Lv.${item.itemLevel} • \`${item.instanceId}\``
                  );
                },
              )
              .join(
                "\n",
              )
          : "ไม่มี";

      const materialText =
        result.materials
          .filter(
            (material) =>
              material.quantity >
              0,
          )
          .map(
            (material) =>
              `• ${material.name} × **${material.quantity}**`,
          )
          .join(
            "\n",
          ) ||
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
                result.difficultyData.name,
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
                `${result.profile.level}${result.levelsGained > 0 ? ` ⬆️ +${result.levelsGained}` : ""}`,
              inline:
                true,
            },

            {
              name:
                "Rewards",
              value: [
                `✨ **${result.xp.toLocaleString()} EXP**`,
                `💠 **${result.nexo.toLocaleString()} NEXO**`,
              ].join(
                "\n",
              ),
              inline:
                true,
            },

            {
              name:
                "Materials",
              value:
                cut(
                  materialText,
                ),
              inline:
                true,
            },

            {
              name:
                "Equipment Drops",
              value:
                cut(
                  itemText,
                ),
              inline:
                false,
            },
          )
          .setFooter({
            text:
              `Run ${result.run.runId}`,
          });

      await interaction.editReply({
        embeds: [
          embed,
        ],
      });

      if (
        interaction.guild
      ) {
        for (
          const item of
            result.items
        ) {
          const rank =
            rarityRank.indexOf(
              String(
                item.rarity,
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
              interaction.guild,
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
                      `${RARITY_DATA[item.rarity as keyof typeof RARITY_DATA].emoji} **${item.name}**`,
                    inline:
                      false,
                  },

                  {
                    name:
                      "Rarity",
                    value:
                      String(
                        item.rarity,
                      ),
                    inline:
                      true,
                  },

                  {
                    name:
                      "Dungeon",
                    value:
                      result.dungeon.name,
                    inline:
                      true,
                  },
                ],

                metadata: {
                  instanceId:
                    item.instanceId,

                  rarity:
                    item.rarity,

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

      return;
    }

    if (
      subcommand ===
      "inventory"
    ) {
      const inventory =
        await dungeonService
          .getInventory(
            discordId,
          );

      const itemLines =
        inventory.items
          .slice(
            0,
            20,
          )
          .map(
            (item) => {
              const rarity =
                RARITY_DATA[
                  item.rarity as
                    keyof typeof RARITY_DATA
                ];

              return [
                item.equipped
                  ? "✅"
                  : "▫️",

                rarity.emoji,

                `**${item.name}**`,

                `Lv.${item.itemLevel}`,

                `+${item.upgradeLevel}`,

                `\`${item.instanceId}\``,
              ].join(
                " ",
              );
            },
          );

      const materialLines =
        inventory.materials
          .map(
            (material) =>
              `• **${material.name}** × ${material.quantity.toLocaleString()}`,
          );

      const embed =
        new EmbedBuilder()
          .setColor(
            COLOR,
          )
          .setTitle(
            "🎒 Dungeon Inventory",
          )
          .addFields(
            {
              name:
                `Equipment (${inventory.items.length})`,
              value:
                cut(
                  itemLines.join(
                    "\n",
                  ) ||
                  "ยังไม่มี Equipment",
                ),
              inline:
                false,
            },

            {
              name:
                "Materials",
              value:
                cut(
                  materialLines.join(
                    "\n",
                  ) ||
                  "ยังไม่มี Materials",
                ),
              inline:
                false,
            },
          )
          .setFooter({
            text:
              "✅ = Equipped • ใช้ Item ID กับ /dungeon equip หรือ /dungeon upgrade",
          });

      await interaction.reply({
        embeds: [
          embed,
        ],

        ephemeral:
          true,
      });

      return;
    }

    if (
      subcommand ===
      "equip"
    ) {
      const itemId =
        interaction.options
          .getString(
            "item",
            true,
          )
          .trim();

      const item =
        await dungeonService
          .equip(
            discordId,
            itemId,
          );

      await interaction.reply({
        content:
          `✅ สวมใส่ **${item.name}** แล้ว`,

        ephemeral:
          true,
      });

      return;
    }

    if (
      subcommand ===
      "upgrade"
    ) {
      const itemId =
        interaction.options
          .getString(
            "item",
            true,
          )
          .trim();

      const result =
        await dungeonService
          .upgradeItem(
            discordId,
            itemId,
          );

      await interaction.reply({
        content:
          `🔨 อัปเกรด **${result.item.name}** เป็น **+${result.item.upgradeLevel}** สำเร็จ ใช้ ${result.cost.toLocaleString()} NEXO`,

        ephemeral:
          true,
      });

      return;
    }

    if (
      subcommand ===
      "forge"
    ) {
      const slot =
        interaction.options
          .getString(
            "slot",
            true,
          ) as
            DungeonSlot;

      const materialId =
        interaction.options
          .getString(
            "material",
            true,
          );

      const weaponOption =
        interaction.options
          .getString(
            "weapon",
          ) as
            DungeonWeaponType |
            null;

      if (
        slot ===
          "weapon" &&
        !weaponOption
      ) {
        await interaction.reply({
          content:
            "❌ Forge Weapon ต้องเลือก `weapon` ด้วย",

          ephemeral:
            true,
        });

        return;
      }

      const result =
        await dungeonService
          .forgeItem(
            discordId,
            slot,
            materialId,
            weaponOption,
          );

      const rarity =
        RARITY_DATA[
          result.item.rarity as
            keyof typeof RARITY_DATA
        ];

      const affixes =
        (
          result.item.affixes ??
          []
        )
          .map(
            (affix) =>
              `• ${affix.label}: +${affix.value}`,
          )
          .join(
            "\n",
          );

      const embed =
        new EmbedBuilder()
          .setColor(
            COLOR,
          )
          .setTitle(
            "🔥 Forge Complete",
          )
          .setDescription(
            `${rarity.emoji} **${result.item.name}**`,
          )
          .addFields(
            {
              name:
                "Slot",
              value:
                SLOT_NAMES[
                  result.item.slot as
                    keyof typeof SLOT_NAMES
                ],
              inline:
                true,
            },

            {
              name:
                "Item Level",
              value:
                String(
                  result.item.itemLevel,
                ),
              inline:
                true,
            },

            {
              name:
                "Item ID",
              value:
                `\`${result.item.instanceId}\``,
              inline:
                false,
            },

            {
              name:
                "Cost",
              value:
                `${result.nexoCost.toLocaleString()} NEXO\n${result.materialCost} × ${result.materialName}`,
              inline:
                false,
            },

            ...(affixes
              ? [
                  {
                    name:
                      "Affixes",
                    value:
                      affixes,
                    inline:
                      false,
                  },
                ]
              : []),
          );

      await interaction.reply({
        embeds: [
          embed,
        ],
      });

      return;
    }

    if (
      subcommand ===
      "ascend"
    ) {
      const profile =
        await dungeonService
          .ascend(
            discordId,
          );

      const embed =
        new EmbedBuilder()
          .setColor(
            0x00d9ff,
          )
          .setTitle(
            "✨ ASCENSION",
          )
          .setDescription(
            [
              `**${interaction.user.displayName}** Ascend สำเร็จ`,
              "",
              `Ascension **${profile.ascension}**`,
              `Ascension Points **${profile.ascensionPoints}**`,
              "",
              "Level ถูกรีเซ็ตเป็น **1**",
              "Equipment ทั้งหมดยังคงอยู่",
              "ได้รับโบนัส Permanent Stats จาก Ascension",
            ].join(
              "\n",
            ),
          );

      await interaction.reply({
        embeds: [
          embed,
        ],
      });

      if (
        interaction.guild
      ) {
        await communityLoggingService
          .rpg(
            interaction.guild,
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

      return;
    }

    await interaction.reply({
      content:
        "❌ Unknown Dungeon subcommand",

      ephemeral:
        true,
    });
  } catch (error) {
    const message =
      errorMessage(
        error,
      );

    if (
      interaction.deferred ||
      interaction.replied
    ) {
      await interaction.editReply({
        content:
          `❌ ${message}`,

        embeds:
          [],
      });

      return;
    }

    await interaction.reply({
      content:
        `❌ ${message}`,

      ephemeral:
        true,
    });
  }
}
