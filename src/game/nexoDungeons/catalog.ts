export const DUNGEON_WEAPON_TYPES = [
  "sword",
  "greatsword",
  "bow",
  "staff",
  "dagger",
  "shield",
] as const;

export type DungeonWeaponType =
  typeof DUNGEON_WEAPON_TYPES[number];

export const DUNGEON_SLOTS = [
  "weapon",
  "helmet",
  "armor",
  "gloves",
  "boots",
  "ring",
  "necklace",
  "artifact",
] as const;

export type DungeonSlot =
  typeof DUNGEON_SLOTS[number];

export const DUNGEON_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
  "ancient",
  "divine",
] as const;

export type DungeonRarity =
  typeof DUNGEON_RARITIES[number];

export const DUNGEON_DIFFICULTIES = [
  "normal",
  "hard",
  "nightmare",
  "abyss",
] as const;

export type DungeonDifficulty =
  typeof DUNGEON_DIFFICULTIES[number];

export const RARITY_DATA: Record<
  DungeonRarity,
  {
    name: string;
    emoji: string;
    multiplier: number;
  }
> = {
  common: {
    name: "Common",
    emoji: "⚪",
    multiplier: 1,
  },

  uncommon: {
    name: "Uncommon",
    emoji: "🟢",
    multiplier: 1.2,
  },

  rare: {
    name: "Rare",
    emoji: "🔵",
    multiplier: 1.5,
  },

  epic: {
    name: "Epic",
    emoji: "🟣",
    multiplier: 1.9,
  },

  legendary: {
    name: "Legendary",
    emoji: "🟠",
    multiplier: 2.5,
  },

  mythic: {
    name: "Mythic",
    emoji: "🔴",
    multiplier: 3.3,
  },

  ancient: {
    name: "Ancient",
    emoji: "🟡",
    multiplier: 4.4,
  },

  divine: {
    name: "Divine",
    emoji: "💠",
    multiplier: 6,
  },
};

export const WEAPON_DATA: Record<
  DungeonWeaponType,
  {
    name: string;
    emoji: string;
    description: string;
  }
> = {
  sword: {
    name: "Sword",
    emoji: "⚔️",
    description:
      "สมดุล และมีโอกาสทำ Bleed",
  },

  greatsword: {
    name: "Greatsword",
    emoji: "🗡️",
    description:
      "โจมตีหนัก Damage สูง",
  },

  bow: {
    name: "Bow",
    emoji: "🏹",
    description:
      "Critical สูงและแม่นยำ",
  },

  staff: {
    name: "Staff",
    emoji: "🪄",
    description:
      "Magic Damage และ Burn",
  },

  dagger: {
    name: "Dagger",
    emoji: "🔪",
    description:
      "Critical และ Dodge สูง",
  },

  shield: {
    name: "Shield",
    emoji: "🛡️",
    description:
      "Tank, Block และ Defense",
  },
};

export const SLOT_NAMES: Record<
  DungeonSlot,
  string
> = {
  weapon: "Weapon",
  helmet: "Helmet",
  armor: "Armor",
  gloves: "Gloves",
  boots: "Boots",
  ring: "Ring",
  necklace: "Necklace",
  artifact: "Artifact",
};

export const DIFFICULTY_DATA: Record<
  DungeonDifficulty,
  {
    name: string;
    enemyMultiplier: number;
    rewardMultiplier: number;
    levelOffset: number;
    rarityBonus: number;
  }
> = {
  normal: {
    name: "Normal",
    enemyMultiplier: 1,
    rewardMultiplier: 1,
    levelOffset: 0,
    rarityBonus: 0,
  },

  hard: {
    name: "Hard",
    enemyMultiplier: 1.45,
    rewardMultiplier: 1.65,
    levelOffset: 10,
    rarityBonus: 0.35,
  },

  nightmare: {
    name: "Nightmare",
    enemyMultiplier: 2.1,
    rewardMultiplier: 2.6,
    levelOffset: 20,
    rarityBonus: 0.8,
  },

  abyss: {
    name: "Abyss",
    enemyMultiplier: 3.2,
    rewardMultiplier: 4.25,
    levelOffset: 30,
    rarityBonus: 1.5,
  },
};

export interface DungeonDefinition {
  id: string;
  name: string;
  emoji: string;
  minLevel: number;
  enemyPower: number;
  baseXp: number;
  baseNexo: number;
  materialId: string;
  materialName: string;
}

export const DUNGEONS:
  DungeonDefinition[] = [
    {
      id: "forgotten_ruins",
      name: "Forgotten Ruins",
      emoji: "🏚️",
      minLevel: 1,
      enemyPower: 6,
      baseXp: 45,
      baseNexo: 80,
      materialId: "ancient_fragment",
      materialName: "Ancient Fragment",
    },

    {
      id: "goblin_cavern",
      name: "Goblin Cavern",
      emoji: "👺",
      minLevel: 10,
      enemyPower: 13,
      baseXp: 110,
      baseNexo: 190,
      materialId: "goblin_core",
      materialName: "Goblin Core",
    },

    {
      id: "haunted_forest",
      name: "Haunted Forest",
      emoji: "🌲",
      minLevel: 20,
      enemyPower: 24,
      baseXp: 220,
      baseNexo: 380,
      materialId: "spirit_essence",
      materialName: "Spirit Essence",
    },

    {
      id: "crimson_castle",
      name: "Crimson Castle",
      emoji: "🏰",
      minLevel: 35,
      enemyPower: 42,
      baseXp: 420,
      baseNexo: 720,
      materialId: "crimson_shard",
      materialName: "Crimson Shard",
    },

    {
      id: "abyssal_depths",
      name: "Abyssal Depths",
      emoji: "🌊",
      minLevel: 50,
      enemyPower: 67,
      baseXp: 760,
      baseNexo: 1250,
      materialId: "abyss_core",
      materialName: "Abyss Core",
    },

    {
      id: "celestial_temple",
      name: "Celestial Temple",
      emoji: "⛩️",
      minLevel: 70,
      enemyPower: 105,
      baseXp: 1350,
      baseNexo: 2300,
      materialId: "celestial_crystal",
      materialName: "Celestial Crystal",
    },

    {
      id: "void_realm",
      name: "Void Realm",
      emoji: "🌌",
      minLevel: 90,
      enemyPower: 160,
      baseXp: 2300,
      baseNexo: 4100,
      materialId: "void_fragment",
      materialName: "Void Fragment",
    },

    {
      id: "eternal_nexus",
      name: "Eternal Nexus",
      emoji: "🌀",
      minLevel: 110,
      enemyPower: 240,
      baseXp: 3900,
      baseNexo: 7200,
      materialId: "nexus_core",
      materialName: "Nexus Core",
    },
  ];

export const DUNGEON_MAP =
  new Map(
    DUNGEONS.map(
      (dungeon) => [
        dungeon.id,
        dungeon,
      ],
    ),
  );

export const MATERIALS =
  DUNGEONS.map(
    (dungeon) => ({
      id: dungeon.materialId,
      name: dungeon.materialName,
    }),
  );
