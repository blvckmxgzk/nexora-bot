import type {
  MinerRarity,
} from "./rarityCatalog.js";

export type MinerBoostStat =
  | "luck"
  | "power"
  | "size"
  | "sell"
  | "all";

export interface MinerItemDefinition {
  id:
    string;

  name:
    string;

  emoji:
    string;

  rarity:
    MinerRarity;

  type:
    "boost"
    | "token"
    | "material"
    | "utility"
    | "special";

  netWorth:
    string;

  shopPrice:
    string |
    null;

  tradeable:
    boolean;

  miningDropDenominator:
    number |
    null;

  effect?: {
    stat?:
      MinerBoostStat;

    multiplier?:
      number;

    durationSeconds?:
      number;

    infiniteBag?:
      boolean;

    permanent?:
      boolean;
  };
}

function boost(
  id:
    string,
  name:
    string,
  rarity:
    MinerRarity,
  stat:
    MinerBoostStat,
  multiplier:
    number,
  durationSeconds:
    number,
  netWorth:
    string,
  shopPrice:
    string | null,
  miningDropDenominator:
    number,
): MinerItemDefinition {
  return {
    id,
    name,
    emoji: "🧪",
    rarity,
    type: "boost",
    netWorth,
    shopPrice,
    tradeable: true,
    miningDropDenominator,
    effect: {
      stat,
      multiplier,
      durationSeconds,
    },
  };
}

export const MINER_ITEM_CATALOG:
  MinerItemDefinition[] = [
  boost("luck_potion_minor", "Minor Luck Potion", "uncommon", "luck", 1.5, 900, "1e4", "2e4", 8_000),
  boost("luck_potion_super", "Super Luck Potion", "rare", "luck", 2.5, 900, "1e6", "2e6", 20_000),
  boost("luck_potion_ultra", "Ultra Luck Potion", "epic", "luck", 5, 900, "1e9", "2e9", 60_000),
  boost("luck_potion_legend", "Legend Luck Potion", "legendary", "luck", 10, 600, "1e13", "2e13", 180_000),
  boost("luck_potion_mythic", "Mythic Luck Potion", "mythic", "luck", 25, 600, "1e18", "2e18", 500_000),
  boost("luck_potion_divine", "Divine Luck Potion", "divine", "luck", 75, 480, "1e25", "2e25", 2_000_000),
  boost("luck_potion_cosmic", "Cosmic Luck Potion", "cosmic", "luck", 250, 300, "1e40", "2e40", 20_000_000),
  boost("luck_potion_omega", "Omega Luck Potion", "omega", "luck", 2500, 180, "1e120", "5e120", 750_000_000),

  boost("power_tonic_minor", "Minor Power Tonic", "uncommon", "power", 1.5, 1200, "1e4", "2e4", 8_000),
  boost("power_tonic_super", "Super Power Tonic", "rare", "power", 3, 1200, "1e6", "2e6", 20_000),
  boost("power_tonic_ultra", "Ultra Power Tonic", "epic", "power", 6, 900, "1e9", "2e9", 60_000),
  boost("power_tonic_legend", "Legend Power Tonic", "legendary", "power", 12, 900, "1e13", "2e13", 180_000),
  boost("power_tonic_mythic", "Mythic Power Tonic", "mythic", "power", 30, 600, "1e18", "2e18", 500_000),
  boost("power_tonic_divine", "Divine Power Tonic", "divine", "power", 100, 480, "1e25", "2e25", 2_000_000),
  boost("power_tonic_cosmic", "Cosmic Power Tonic", "cosmic", "power", 500, 300, "1e40", "2e40", 20_000_000),
  boost("power_tonic_omega", "Omega Power Tonic", "omega", "power", 5000, 180, "1e120", "5e120", 750_000_000),

  boost("giant_serum_minor", "Minor Giant Serum", "rare", "size", 1.25, 900, "1e6", "2e6", 25_000),
  boost("giant_serum_super", "Super Giant Serum", "epic", "size", 1.75, 900, "1e9", "2e9", 75_000),
  boost("giant_serum_ultra", "Ultra Giant Serum", "legendary", "size", 2.5, 600, "1e13", "2e13", 250_000),
  boost("giant_serum_mythic", "Mythic Giant Serum", "mythic", "size", 4, 600, "1e18", "2e18", 750_000),
  boost("giant_serum_divine", "Divine Giant Serum", "divine", "size", 8, 420, "1e25", "2e25", 3_000_000),
  boost("giant_serum_cosmic", "Cosmic Giant Serum", "cosmic", "size", 25, 300, "1e40", "2e40", 30_000_000),

  boost("gold_elixir_minor", "Minor Golden Elixir", "rare", "sell", 1.5, 1200, "1e6", "2e6", 25_000),
  boost("gold_elixir_super", "Super Golden Elixir", "epic", "sell", 2.5, 900, "1e9", "2e9", 75_000),
  boost("gold_elixir_ultra", "Ultra Golden Elixir", "legendary", "sell", 5, 900, "1e13", "2e13", 250_000),
  boost("gold_elixir_mythic", "Mythic Golden Elixir", "mythic", "sell", 10, 600, "1e18", "2e18", 750_000),
  boost("gold_elixir_divine", "Divine Golden Elixir", "divine", "sell", 30, 420, "1e25", "2e25", 3_000_000),
  boost("gold_elixir_cosmic", "Cosmic Golden Elixir", "cosmic", "sell", 100, 300, "1e40", "2e40", 30_000_000),

  boost("omni_potion", "Omni Potion", "mythic", "all", 3, 300, "1e20", "3e20", 1_000_000),
  boost("divine_omni", "Divine Omni Potion", "divine", "all", 10, 240, "1e28", "3e28", 5_000_000),
  boost("celestial_omni", "Celestial Omni Potion", "celestial", "all", 30, 180, "1e34", "3e34", 15_000_000),
  boost("singularity_omni", "Singularity Omni Potion", "singularity", "all", 500, 120, "1e90", null, 300_000_000),

  {
    id: "infinite_bag_15m",
    name: "Infinite Bag Token — 15m",
    emoji: "🎟️",
    rarity: "epic",
    type: "token",
    netWorth: "1e12",
    shopPrice: "2e12",
    tradeable: true,
    miningDropDenominator: 500_000,
    effect: {
      infiniteBag: true,
      durationSeconds: 900,
    },
  },
  {
    id: "infinite_bag_1h",
    name: "Infinite Bag Token — 1h",
    emoji: "🎟️",
    rarity: "legendary",
    type: "token",
    netWorth: "1e18",
    shopPrice: "2e18",
    tradeable: true,
    miningDropDenominator: 2_000_000,
    effect: {
      infiniteBag: true,
      durationSeconds: 3600,
    },
  },
  {
    id: "infinite_bag_6h",
    name: "Infinite Bag Token — 6h",
    emoji: "🎟️",
    rarity: "mythic",
    type: "token",
    netWorth: "1e26",
    shopPrice: "2e26",
    tradeable: true,
    miningDropDenominator: 10_000_000,
    effect: {
      infiniteBag: true,
      durationSeconds: 21600,
    },
  },
  {
    id: "infinite_bag_24h",
    name: "Infinite Bag Token — 24h",
    emoji: "🎟️",
    rarity: "celestial",
    type: "token",
    netWorth: "1e38",
    shopPrice: "3e38",
    tradeable: true,
    miningDropDenominator: 50_000_000,
    effect: {
      infiniteBag: true,
      durationSeconds: 86400,
    },
  },
  {
    id: "eternal_infinite_bag",
    name: "Eternal Infinite Bag Token",
    emoji: "♾️",
    rarity: "infinite",
    type: "token",
    netWorth: "1e110",
    shopPrice: "5e110",
    tradeable: true,
    miningDropDenominator: 1_000_000_000,
    effect: {
      infiniteBag: true,
      permanent: true,
    },
  },
  {
    id: "pickaxe_reforge_crystal",
    name: "Pickaxe Reforge Crystal",
    emoji: "💎",
    rarity: "legendary",
    type: "material",
    netWorth: "1e15",
    shopPrice: "2e15",
    tradeable: true,
    miningDropDenominator: 300_000,
  },
  {
    id: "ancient_reforge_core",
    name: "Ancient Reforge Core",
    emoji: "🧿",
    rarity: "ancient",
    type: "material",
    netWorth: "1e22",
    shopPrice: "3e22",
    tradeable: true,
    miningDropDenominator: 1_500_000,
  },
  {
    id: "celestial_reforge_core",
    name: "Celestial Reforge Core",
    emoji: "🌟",
    rarity: "celestial",
    type: "material",
    netWorth: "1e36",
    shopPrice: "3e36",
    tradeable: true,
    miningDropDenominator: 12_000_000,
  },
  {
    id: "chest_expansion_token",
    name: "Rare Chest Expansion Token",
    emoji: "🧰",
    rarity: "epic",
    type: "utility",
    netWorth: "1e10",
    shopPrice: "2e10",
    tradeable: true,
    miningDropDenominator: 150_000,
  },
  {
    id: "ore_lock_charm",
    name: "Ore Lock Charm",
    emoji: "🔒",
    rarity: "rare",
    type: "utility",
    netWorth: "1e7",
    shopPrice: "2e7",
    tradeable: true,
    miningDropDenominator: 50_000,
  },
  {
    id: "fortune_clover",
    name: "Fortune Clover",
    emoji: "🍀",
    rarity: "mythic",
    type: "utility",
    netWorth: "1e20",
    shopPrice: "2e20",
    tradeable: true,
    miningDropDenominator: 1_000_000,
  },
  {
    id: "void_compass",
    name: "Void Compass",
    emoji: "🧭",
    rarity: "voidborn",
    type: "utility",
    netWorth: "1e68",
    shopPrice: null,
    tradeable: true,
    miningDropDenominator: 100_000_000,
  },
  {
    id: "reality_key",
    name: "Reality Key",
    emoji: "🗝️",
    rarity: "reality",
    type: "utility",
    netWorth: "1e78",
    shopPrice: null,
    tradeable: true,
    miningDropDenominator: 175_000_000,
  },
  {
    id: "singularity_fragment",
    name: "Singularity Fragment",
    emoji: "🕳️",
    rarity: "singularity",
    type: "material",
    netWorth: "1e88",
    shopPrice: null,
    tradeable: true,
    miningDropDenominator: 300_000_000,
  },
  {
    id: "omega_relic",
    name: "Omega Relic",
    emoji: "Ω",
    rarity: "omega",
    type: "special",
    netWorth: "1e135",
    shopPrice: null,
    tradeable: true,
    miningDropDenominator: 2_000_000_000,
  },
];

export const MINER_ITEM_MAP =
  new Map(
    MINER_ITEM_CATALOG.map(
      (
        item,
      ) => [
        item.id,
        item,
      ],
    ),
  );
