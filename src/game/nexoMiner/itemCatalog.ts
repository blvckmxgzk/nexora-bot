import type {
  MinerRarity,
} from "./rarityCatalog.js";

export type MinerBoostStat =
  | "luck"
  | "power"
  | "size"
  | "sell"
  | "speed"
  | "xp"
  | "drop"
  | "mutation"
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

    timeWarpSeconds?: number;
    maxWeightLevels?: number;
    chestSlots?: number;
    prestigeStars?: number;
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

  boost("haste_potion_minor", "Minor Mining Haste", "uncommon", "speed", 1.5, 900, "5e3", "1e4", 7_500),
  boost("haste_potion_super", "Super Mining Haste", "rare", "speed", 2.25, 900, "5e5", "1e6", 18_000),
  boost("haste_potion_ultra", "Ultra Mining Haste", "epic", "speed", 4, 600, "5e8", "1e9", 50_000),
  boost("knowledge_potion_minor", "Minor Knowledge Potion", "uncommon", "xp", 1.5, 1200, "8e3", "1.5e4", 8_000),
  boost("knowledge_potion_super", "Super Knowledge Potion", "rare", "xp", 2.5, 900, "8e5", "1.5e6", 20_000),
  boost("knowledge_potion_ultra", "Ultra Knowledge Potion", "epic", "xp", 5, 600, "8e8", "1.5e9", 60_000),
  boost("treasure_potion_minor", "Minor Treasure Potion", "rare", "drop", 1.5, 900, "1e6", "2e6", 25_000),
  boost("treasure_potion_super", "Super Treasure Potion", "epic", "drop", 3, 600, "1e9", "2e9", 75_000),
  boost("treasure_potion_ultra", "Ultra Treasure Potion", "legendary", "drop", 7.5, 420, "1e13", "2e13", 250_000),

  boost("mutation_potion_minor", "Minor Mutation Chance Potion", "rare", "mutation", 2, 1200, "1e6", "2e6", 30_000),
  boost("mutation_potion_super", "Super Mutation Chance Potion", "epic", "mutation", 5, 900, "1e9", "2e9", 100_000),
  boost("mutation_potion_ultra", "Ultra Mutation Chance Potion", "legendary", "mutation", 12, 600, "1e14", "2e14", 350_000),
  boost("mutation_potion_omega", "Omega Mutation Chance Potion", "mythic", "mutation", 30, 420, "1e20", "3e20", 1_500_000),

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
    effect: { chestSlots: 5 },
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
  { id:"time_warp_15m", name:"Time Warp — 15m", emoji:"⏳", rarity:"rare", type:"utility", netWorth:"5e5", shopPrice:"1e6", tradeable:true, miningDropDenominator:30_000, effect:{timeWarpSeconds:900} },
  { id:"time_warp_1h", name:"Time Warp — 1h", emoji:"⏳", rarity:"epic", type:"utility", netWorth:"5e8", shopPrice:"1e9", tradeable:true, miningDropDenominator:100_000, effect:{timeWarpSeconds:3600} },
  { id:"backpack_core", name:"Backpack Core", emoji:"🎒", rarity:"epic", type:"special", netWorth:"2e9", shopPrice:"4e9", tradeable:true, miningDropDenominator:120_000, effect:{maxWeightLevels:5} },
  { id:"prestige_token", name:"Prestige Token", emoji:"⭐", rarity:"legendary", type:"special", netWorth:"1e14", shopPrice:null, tradeable:false, miningDropDenominator:500_000, effect:{prestigeStars:1} },
  { id:"ore_magnet", name:"Ore Magnet", emoji:"🧲", rarity:"rare", type:"special", netWorth:"5e7", shopPrice:"1e8", tradeable:true, miningDropDenominator:60_000 },
  { id:"lucky_ticket", name:"Lucky Ticket", emoji:"🎟️", rarity:"rare", type:"special", netWorth:"8e7", shopPrice:"1.5e8", tradeable:true, miningDropDenominator:75_000 },
  { id:"rare_chest_key", name:"Rare Chest Key", emoji:"🗝️", rarity:"epic", type:"special", netWorth:"1e10", shopPrice:"2e10", tradeable:true, miningDropDenominator:150_000 },
  { id:"mythic_key", name:"Mythic Key", emoji:"🔑", rarity:"mythic", type:"special", netWorth:"1e19", shopPrice:null, tradeable:true, miningDropDenominator:900_000 },
  { id:"fortune_gem", name:"Fortune Gem", emoji:"💎", rarity:"legendary", type:"material", netWorth:"2e15", shopPrice:null, tradeable:true, miningDropDenominator:350_000 },
  { id:"merchant_charm", name:"Merchant Charm", emoji:"💰", rarity:"legendary", type:"material", netWorth:"3e15", shopPrice:null, tradeable:true, miningDropDenominator:400_000 },
  { id:"quantum_battery", name:"Quantum Battery", emoji:"⚡", rarity:"mythic", type:"material", netWorth:"2e20", shopPrice:null, tradeable:true, miningDropDenominator:1_200_000 },
  { id:"enchant_crystal", name:"Pickaxe Enchant Crystal", emoji:"✨", rarity:"mythic", type:"material", netWorth:"3e20", shopPrice:null, tradeable:true, miningDropDenominator:1_500_000 },
  { id:"mutation_crystal", name:"Mutation Crystal", emoji:"🧬", rarity:"ancient", type:"material", netWorth:"2e23", shopPrice:null, tradeable:true, miningDropDenominator:2_500_000 },
  { id:"ultra_fragment", name:"Ultra Fragment", emoji:"🔥", rarity:"transcendent", type:"material", netWorth:"1e56", shopPrice:null, tradeable:true, miningDropDenominator:30_000_000 },
  { id:"infinity_fragment", name:"Infinity Fragment", emoji:"∞", rarity:"infinite", type:"material", netWorth:"1e125", shopPrice:null, tradeable:true, miningDropDenominator:600_000_000 },
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
