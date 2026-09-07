import type {
  MinerRarity,
} from "./rarityCatalog.js";

export interface OreDefinition {
  id:
    string;

  name:
    string;

  emoji:
    string;

  rarity:
    MinerRarity;

  netBase:
    string;

  powerRequirement:
    string;

  minWeightKg:
    number;

  maxWeightKg:
    number;
}

type TierDefinition = {
  rarity:
    MinerRarity;

  baseNet:
    string;

  power:
    string;

  weight:
    [
      number,
      number,
    ];

  ores:
    [
      string,
      string,
      string,
    ];
};

const tiers:
  TierDefinition[] = [
  {
    rarity: "common",
    baseNet: "1e0",
    power: "1e0",
    weight: [0.2, 3],
    ores: ["Stone", "Coal", "Tin"],
  },
  {
    rarity: "uncommon",
    baseNet: "1e1",
    power: "3e0",
    weight: [0.2, 4],
    ores: ["Copper", "Iron", "Quartz"],
  },
  {
    rarity: "rare",
    baseNet: "1e2",
    power: "1e1",
    weight: [0.25, 6],
    ores: ["Silver", "Gold", "Nickel"],
  },
  {
    rarity: "elite",
    baseNet: "1e3",
    power: "3e1",
    weight: [0.3, 8],
    ores: ["Sapphire Ore", "Ruby Ore", "Emerald Ore"],
  },
  {
    rarity: "epic",
    baseNet: "1e5",
    power: "1e2",
    weight: [0.4, 10],
    ores: ["Platinum", "Cobalt", "Titanium"],
  },
  {
    rarity: "heroic",
    baseNet: "1e7",
    power: "1e3",
    weight: [0.5, 12],
    ores: ["Tungsten", "Osmium", "Iridium"],
  },
  {
    rarity: "legendary",
    baseNet: "1e9",
    power: "1e4",
    weight: [0.6, 15],
    ores: ["Uranium", "Obsidian Crystal", "Dragonite"],
  },
  {
    rarity: "mythic",
    baseNet: "1e12",
    power: "1e5",
    weight: [0.8, 18],
    ores: ["Mithril", "Adamantite", "Orichalcum"],
  },
  {
    rarity: "ancient",
    baseNet: "1e15",
    power: "1e6",
    weight: [1, 22],
    ores: ["Ancient Amber", "Runestone", "Titanite"],
  },
  {
    rarity: "arcane",
    baseNet: "1e18",
    power: "1e8",
    weight: [1.2, 25],
    ores: ["Mana Crystal", "Arcanite", "Spellstone"],
  },
  {
    rarity: "divine",
    baseNet: "1e22",
    power: "1e10",
    weight: [1.5, 30],
    ores: ["Aetherium", "Seraphite", "Holy Core"],
  },
  {
    rarity: "exalted",
    baseNet: "1e26",
    power: "1e12",
    weight: [2, 35],
    ores: ["Empyrean Ore", "Radiant Prism", "Sovereignite"],
  },
  {
    rarity: "celestial",
    baseNet: "1e30",
    power: "1e15",
    weight: [2.5, 40],
    ores: ["Mooncore", "Solarite", "Starsteel"],
  },
  {
    rarity: "astral",
    baseNet: "1e35",
    power: "1e18",
    weight: [3, 50],
    ores: ["Astralite", "Nebulite", "Comet Shard"],
  },
  {
    rarity: "cosmic",
    baseNet: "1e40",
    power: "1e22",
    weight: [4, 60],
    ores: ["Dark Matter Ore", "Quasar Crystal", "Pulsarite"],
  },
  {
    rarity: "galactic",
    baseNet: "1e46",
    power: "1e27",
    weight: [5, 75],
    ores: ["Galaxy Opal", "Supernova Core", "Gravity Crystal"],
  },
  {
    rarity: "transcendent",
    baseNet: "1e53",
    power: "1e33",
    weight: [6, 90],
    ores: ["Chronite", "Dimension Ore", "Fate Crystal"],
  },
  {
    rarity: "primordial",
    baseNet: "1e61",
    power: "1e40",
    weight: [8, 110],
    ores: ["Genesis Stone", "Origin Crystal", "First Matter"],
  },
  {
    rarity: "voidborn",
    baseNet: "1e70",
    power: "1e48",
    weight: [10, 140],
    ores: ["Voidstone", "Abyssium", "Null Crystal"],
  },
  {
    rarity: "reality",
    baseNet: "1e80",
    power: "1e57",
    weight: [12, 180],
    ores: ["Reality Shard", "Causalite", "Lawstone"],
  },
  {
    rarity: "singularity",
    baseNet: "1e92",
    power: "1e67",
    weight: [15, 250],
    ores: ["Nexorite", "Singularity Core", "Event Horizon Ore"],
  },
  {
    rarity: "eternal",
    baseNet: "1e106",
    power: "1e78",
    weight: [20, 350],
    ores: ["Eternium", "Timeheart", "Forever Crystal"],
  },
  {
    rarity: "infinite",
    baseNet: "1e122",
    power: "1e90",
    weight: [30, 500],
    ores: ["Infinity Shard", "Endless Matter", "Boundless Core"],
  },
  {
    rarity: "omega",
    baseNet: "1e140",
    power: "1e105",
    weight: [50, 1000],
    ores: ["Omega Crystal", "Finalite", "NEXO Prime Ore"],
  },
];

const VALUE_FACTORS = [
  1,
  2.5,
  6,
] as const;

function scaleScientific(
  source:
    string,

  factor:
    number,
): string {
  const match =
    source.match(
      /^([0-9.]+)e([+-]?\d+)$/,
    );

  if (!match) {
    throw new Error(
      `Invalid scientific value: ${source}`,
    );
  }

  return `${
    Number(
      match[1],
    ) *
    factor
  }e${match[2]}`;
}

function idFromName(
  value:
    string,
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "_",
    )
    .replace(
      /^_|_$/g,
      "",
    );
}

export const ORE_CATALOG:
  OreDefinition[] =
  tiers.flatMap(
    (
      tier,
    ) =>
      tier.ores.map(
        (
          name,
          index,
        ) => ({
          id:
            idFromName(
              name,
            ),

          name,

          emoji:
            "⛏️",

          rarity:
            tier.rarity,

          netBase:
            scaleScientific(
              tier.baseNet,
              VALUE_FACTORS[
                index
              ],
            ),

          powerRequirement:
            tier.power,

          minWeightKg:
            tier.weight[
              0
            ],

          maxWeightKg:
            tier.weight[
              1
            ],
        }),
      ),
  );

export const ORE_MAP =
  new Map(
    ORE_CATALOG.map(
      (
        ore,
      ) => [
        ore.id,
        ore,
      ],
    ),
  );
