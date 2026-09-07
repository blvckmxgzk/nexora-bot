import {
  MINER_RARITIES,
  type MinerRarity,
} from "./rarityCatalog.js";

const PICKAXE_NAMES = [
  "Rusty Pickaxe",
  "Copper Pickaxe",
  "Steel Pickaxe",
  "Sapphire Pickaxe",
  "Amethyst Pickaxe",
  "Titan Pickaxe",
  "Dragon Pickaxe",
  "Mithril Pickaxe",
  "Ancient Pickaxe",
  "Arcane Pickaxe",
  "Divine Pickaxe",
  "Exalted Pickaxe",
  "Celestial Pickaxe",
  "Astral Pickaxe",
  "Cosmic Pickaxe",
  "Galactic Pickaxe",
  "Chronos Pickaxe",
  "Genesis Pickaxe",
  "Void Pickaxe",
  "Reality Breaker",
  "Singularity Drill",
  "Eternal Excavator",
  "Infinite Pickaxe",
  "Omega Breaker",
] as const;

function sci(
  exponent:
    number,
): string {
  return `1e${exponent}`;
}

export interface PickaxeDefinition {
  id:
    string;

  name:
    string;

  rarity:
    MinerRarity;

  basePower:
    string;

  baseLuck:
    string;

  netWorth:
    string;

  tradeable:
    boolean;

  miningDropDenominator:
    number |
    null;
}

export const PICKAXE_CATALOG:
  PickaxeDefinition[] =
  MINER_RARITIES.map(
    (
      rarity,
      index,
    ) => ({
      id:
        PICKAXE_NAMES[
          index
        ]
          .toLowerCase()
          .replace(
            /[^a-z0-9]+/g,
            "_",
          )
          .replace(
            /^_|_$/g,
            "",
          ),

      name:
        PICKAXE_NAMES[
          index
        ],

      rarity:
        rarity.id,

      basePower:
        sci(
          Math.max(
            0,
            Math.floor(
              index *
              4.5,
            ),
          ),
        ),

      baseLuck:
        sci(
          Math.max(
            0,
            Math.floor(
              index *
              2.2,
            ),
          ),
        ),

      netWorth:
        index ===
        0
          ? "0"
          : sci(
              4 +
              index *
                6,
            ),

      tradeable:
        index !==
        0,

      miningDropDenominator:
        index ===
        0
          ? null
          : Math.min(
              2_000_000_000,
              Math.floor(
                10_000 *
                Math.pow(
                  1.55,
                  index,
                ),
              ),
            ),
    }),
  );

export const PICKAXE_MAP =
  new Map(
    PICKAXE_CATALOG.map(
      (
        pickaxe,
      ) => [
        pickaxe.id,
        pickaxe,
      ],
    ),
  );
