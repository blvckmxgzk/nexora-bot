
import type { MinerRarity } from "./rarityCatalog.js";

export interface OreDefinition {
  id: string;
  name: string;
  emoji: string;
  rarity: MinerRarity;
  netBase: string;
  powerRequirement: string;
  minWeightKg: number;
  maxWeightKg: number;
}

type TierDefinition = {
  rarity: MinerRarity;
  baseNet: string;
  power: string;
  weight: [number, number];
  ores: string[];
};

/* Rebalance v2: 24 tiers × 5 ores = 120 ores. Power gates are intentionally
 * much softer; Miner Level / Mine Area is now the real progression gate. */
const tiers: TierDefinition[] = [
  { rarity:"common", baseNet:"2e0", power:"1e0", weight:[0.15,2.5], ores:["Stone","Coal","Copper Dust","Tin","Rough Quartz"] },
  { rarity:"uncommon", baseNet:"2e1", power:"2e0", weight:[0.2,3.5], ores:["Copper","Iron","Quartz","Zinc","Green Fluorite"] },
  { rarity:"rare", baseNet:"2e2", power:"5e0", weight:[0.25,5], ores:["Silver","Gold","Nickel","Cobalt Shard","Moonstone"] },
  { rarity:"elite", baseNet:"2e3", power:"1e1", weight:[0.3,7], ores:["Sapphire Ore","Ruby Ore","Emerald Ore","Aquamarine","Black Opal"] },
  { rarity:"epic", baseNet:"2e5", power:"3e1", weight:[0.4,9], ores:["Platinum","Cobalt","Titanium","Amethyst Core","Storm Crystal"] },
  { rarity:"heroic", baseNet:"2e7", power:"1e2", weight:[0.5,11], ores:["Tungsten","Osmium","Iridium","Hero Stone","Crimson Alloy"] },
  { rarity:"legendary", baseNet:"2e9", power:"3e2", weight:[0.6,14], ores:["Uranium","Obsidian Crystal","Dragonite","Phoenix Ore","Sunstone"] },
  { rarity:"mythic", baseNet:"2e12", power:"1e3", weight:[0.8,17], ores:["Mithril","Adamantite","Orichalcum","Soul Crystal","Leviathan Stone"] },
  { rarity:"ancient", baseNet:"2e15", power:"3e3", weight:[1,21], ores:["Ancient Amber","Runestone","Titanite","Worldroot Gem","Forgotten Gold"] },
  { rarity:"arcane", baseNet:"2e18", power:"1e4", weight:[1.2,24], ores:["Mana Crystal","Arcanite","Spellstone","Hex Ore","Wizard Quartz"] },
  { rarity:"divine", baseNet:"2e22", power:"3e4", weight:[1.5,29], ores:["Aetherium","Seraphite","Holy Core","Angelite","Divine Tear"] },
  { rarity:"exalted", baseNet:"2e26", power:"1e5", weight:[2,34], ores:["Empyrean Ore","Radiant Prism","Sovereignite","Crown Crystal","Ascendant Ore"] },
  { rarity:"celestial", baseNet:"2e30", power:"3e5", weight:[2.5,39], ores:["Mooncore","Solarite","Starsteel","Celestium","Aurora Crystal"] },
  { rarity:"astral", baseNet:"2e35", power:"1e6", weight:[3,48], ores:["Astralite","Nebulite","Comet Shard","Dream Ore","Astral Heart"] },
  { rarity:"cosmic", baseNet:"2e40", power:"3e6", weight:[4,58], ores:["Dark Matter Ore","Quasar Crystal","Pulsarite","Supernova Fragment","Cosmic Heart"] },
  { rarity:"galactic", baseNet:"2e46", power:"1e7", weight:[5,72], ores:["Galaxy Opal","Supernova Core","Gravity Crystal","Milkyway Metal","Blackhole Pearl"] },
  { rarity:"transcendent", baseNet:"2e53", power:"3e7", weight:[6,86], ores:["Chronite","Dimension Ore","Fate Crystal","Transcendium","Beyond Stone"] },
  { rarity:"primordial", baseNet:"2e61", power:"1e8", weight:[8,105], ores:["Genesis Stone","Origin Crystal","First Matter","World Seed","Primal Core"] },
  { rarity:"voidborn", baseNet:"2e70", power:"3e8", weight:[10,135], ores:["Voidstone","Abyssium","Null Crystal","Void Heart","Nothingness Ore"] },
  { rarity:"reality", baseNet:"2e80", power:"1e9", weight:[12,175], ores:["Reality Shard","Causalite","Lawstone","Paradox Crystal","Glitched Matter"] },
  { rarity:"singularity", baseNet:"2e92", power:"3e9", weight:[15,240], ores:["Nexorite","Singularity Core","Event Horizon Ore","Collapsed Star","Zero Point Crystal"] },
  { rarity:"eternal", baseNet:"2e106", power:"1e10", weight:[20,330], ores:["Eternium","Timeheart","Forever Crystal","Aeon Ore","Immortal Prism"] },
  { rarity:"infinite", baseNet:"2e122", power:"3e10", weight:[30,475], ores:["Infinity Shard","Endless Matter","Boundless Core","Aleph Stone","Fractal Ore"] },
  { rarity:"omega", baseNet:"2e140", power:"1e11", weight:[50,900], ores:["Omega Crystal","Finalite","NEXO Prime Ore","Absolute Core","Genesis-End Ore"] },
];

const VALUE_FACTORS = [1, 1.75, 3, 5, 8] as const;

function scaleScientific(source:string, factor:number):string {
  const m=source.match(/^([0-9.]+)e([+-]?\d+)$/);
  if(!m) throw new Error(`Invalid scientific value: ${source}`);
  return `${Number(m[1])*factor}e${m[2]}`;
}
function idFromName(value:string):string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
}

export const ORE_CATALOG: OreDefinition[] = tiers.flatMap(tier =>
  tier.ores.map((name,index)=>({
    id:idFromName(name), name, emoji:"⛏️", rarity:tier.rarity,
    netBase:scaleScientific(tier.baseNet, VALUE_FACTORS[index]),
    powerRequirement:tier.power,
    minWeightKg:tier.weight[0], maxWeightKg:tier.weight[1],
  }))
);
export const ORE_MAP = new Map(ORE_CATALOG.map(ore=>[ore.id,ore]));
