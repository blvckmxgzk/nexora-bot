
import mongoose from "mongoose";
import { MinerProfile } from "../../models/MinerProfile.js";
import { MinerPickaxe } from "../../models/MinerPickaxe.js";
import { MinerOreStack } from "../../models/MinerOreStack.js";
import { MINER_RARITIES, MINER_RARITY_MAP, type MinerRarity } from "../../game/nexoMiner/rarityCatalog.js";
import { ORE_CATALOG } from "../../game/nexoMiner/oreCatalog.js";
import { NexoNumber } from "./NexoNumber.js";

const AREA_NAMES = [
  "Starter Quarry","Iron Cavern","Crystal Hollow","Ember Depths","Heroic Rift","Forgotten Ruins",
  "Mythic Sanctuary","Ancient Core","Arcane Vault","Divine Domain","Exalted Sky","Celestial Belt",
  "Astral Expanse","Cosmic Quarry","Galactic Forge","Transcendent Lab","Primordial Abyss","Voidborn Depths",
  "Reality Fracture","Singularity Core","Eternal Nexus","Infinite Realm","Limitless Expanse","Omega Core",
] as const;
const AREA_EMOJI = ["🌱","🪨","💎","🌋","⚔️","🏛️","🔮","🗿","🌀","👑","✨","🌠","🌌","☄️","🪐","🧬","🦴","⚫","🪞","🕳️","♾️","∞","♾️","Ω"] as const;
const AREA_LEVELS = [1,5,12,22,35,50,75,100,130,165,200,240,285,335,390,450,520,600,700,825,975,1150,1250,1350] as const;

export const MINER_AREAS = MINER_RARITIES.map((rarity,index)=>({
  id:`mine_${rarity.id}`, name:AREA_NAMES[index], emoji:AREA_EMOJI[index], requiredLevel:AREA_LEVELS[index],
  rarity:rarity.id, tier:index,
}));

function xpForNextLevel(level:number):number {
  return Math.max(
    50,
    Math.floor(
      50 *
      Math.pow(
        Math.max(
          1,
          level,
        ),
        1.25,
      ),
    ),
  );
}
function prestigeRequiredLevel(prestigeCount:number):number { return 100 + Math.min(400, Math.floor(prestigeCount/5)*25); }
function ultraRequiredPrestiges(ultra:number):number { return (ultra+1)*25; }
function ultraRequiredLevel(ultra:number):number { return 500 + ultra*200; }

export const minerProgressionService = {
  xpForNextLevel,
  getArea(level:number) {
    let area=MINER_AREAS[0];
    for(const candidate of MINER_AREAS) { if(level>=candidate.requiredLevel) area=candidate; else break; }
    return area;
  },
  getNextArea(level:number) { return MINER_AREAS.find(a=>a.requiredLevel>level) ?? null; },
  getAreaPowerCap(level:number) {
    const area=this.getArea(level);
    let cap=NexoNumber.one();
    for(const ore of ORE_CATALOG) {
      const tier=MINER_RARITY_MAP.get(ore.rarity)?.tier ?? 0;
      if(tier<=area.tier) { const p=new NexoNumber(ore.powerRequirement); if(p.gt(cap)) cap=p; }
    }
    return cap;
  },
  capPower(power:NexoNumber, level:number) { const cap=this.getAreaPowerCap(level); return power.gt(cap)?cap:power; },
  getOreXp(
    rarity:
      MinerRarity | string,

    weight:
      NexoNumber,
  ) {
    const tier =
      MINER_RARITY_MAP
        .get(
          rarity as MinerRarity,
        )
        ?.tier ??
      0;

    /*
     * น้ำหนักช่วย XP แต่ใช้ log scaling
     * เพื่อไม่ให้ Size ×1e200 ปั๊ม Level พัง
     */
    const rawWeight =
      weight.value
        .toNumber();

    const w =
      Number.isFinite(
        rawWeight,
      )
        ? Math.max(
            0,
            Math.min(
              1e9,
              rawWeight,
            ),
          )
        : 1e9;

    const weightBonus =
      1 +
      Math.log10(
        w + 1,
      ) *
      0.35;

    return Math.max(
      1,
      Math.floor(
        18 *
        Math.pow(
          1.55,
          tier,
        ) *
        weightBonus,
      ),
    );
  },

  applyXp(profile:any, amount:number) {
    let level=Math.max(1, profile.minerLevel ?? 1);
    let xp=Math.max(0, Number(profile.minerXp ?? "0"));
    if(!Number.isFinite(xp)) xp=0;
    xp += Math.max(0, Math.floor(amount));
    let gained=0;
    while(gained<10000) {
      const required=xpForNextLevel(level);
      if(xp<required) break;
      xp-=required; level++; gained++;
    }
    profile.minerLevel=level;
    profile.minerXp=String(Math.floor(xp));
    profile.highestMinerLevel=Math.max(profile.highestMinerLevel ?? 1, level);
    return gained;
  },
  getPermanentMultipliers(profile:any) {
    const stars=Math.max(0, profile.prestigeStars ?? 0);
    const cores=Math.max(0, profile.ultraCores ?? 0);
    return {
      power:new NexoNumber(1.08).pow(stars).mul(new NexoNumber(1.8).pow(cores)),
      luck:new NexoNumber(1.05).pow(stars).mul(new NexoNumber(1.15).pow(cores)),
      bag:new NexoNumber(1.08).pow(stars).mul(new NexoNumber(1.5).pow(cores)),
      sell:new NexoNumber(1.07).pow(stars).mul(new NexoNumber(1.75).pow(cores)),
      size:new NexoNumber(1.02).pow(stars).mul(new NexoNumber(1.1).pow(cores)),
      speed:new NexoNumber(1.03).pow(stars).mul(new NexoNumber(1.12).pow(cores)),
      xp:new NexoNumber(1.06).pow(stars).mul(new NexoNumber(1.25).pow(cores)),
    };
  },
  async getStatus(discordId:string) {
    const profile=await MinerProfile.findOne({discordId});
    if(!profile) return null;
    const level=profile.minerLevel ?? 1;
    return {
      profile, level, xp:profile.minerXp ?? "0", xpRequired:String(xpForNextLevel(level)),
      area:this.getArea(level), nextArea:this.getNextArea(level),
      prestigeRequiredLevel:prestigeRequiredLevel(profile.prestigeCount ?? 0),
      ultraRequiredPrestiges:ultraRequiredPrestiges(profile.ultraPrestigeCount ?? 0),
      ultraRequiredLevel:ultraRequiredLevel(profile.ultraPrestigeCount ?? 0),
    };
  },
  async prestige(discordId:string) {
    const session=await mongoose.startSession(); let result:any=null;
    try { await session.withTransaction(async()=>{
      const profile=await MinerProfile.findOne({discordId}).session(session);
      if(!profile) throw new Error("ยังไม่มี Miner Profile");
      const level=profile.minerLevel ?? 1; const required=prestigeRequiredLevel(profile.prestigeCount ?? 0);
      if(level<required) throw new Error(`ต้องมี Miner Level อย่างน้อย ${required} เพื่อ Prestige`);
      const stars=Math.max(1, 1+Math.floor((level-required)/100));
      profile.prestigeCount=(profile.prestigeCount ?? 0)+1;
      profile.prestigeStars=(profile.prestigeStars ?? 0)+stars;
      profile.minerLevel=1; profile.minerXp="0"; profile.maxWeightLevel=0; profile.sellMultiLevel=0; profile.sizeMultiLevel=0;
      profile.bagWeight="0"; profile.pausedReason=null; profile.miningActive=true; profile.lastSettledAt=new Date();
      await MinerPickaxe.updateMany({discordId},{$set:{powerLevel:0,luckLevel:0}},{session});
      await MinerOreStack.deleteMany({discordId,location:"bag"},{session});
      await profile.save({session}); result={stars,prestigeCount:profile.prestigeCount,prestigeStars:profile.prestigeStars};
    }); return result; } finally { await session.endSession(); }
  },
  async ultraPrestige(discordId:string) {
    const session=await mongoose.startSession(); let result:any=null;
    try { await session.withTransaction(async()=>{
      const profile=await MinerProfile.findOne({discordId}).session(session);
      if(!profile) throw new Error("ยังไม่มี Miner Profile");
      const ultra=profile.ultraPrestigeCount ?? 0; const reqP=ultraRequiredPrestiges(ultra); const reqL=ultraRequiredLevel(ultra);
      if((profile.prestigeCount ?? 0)<reqP) throw new Error(`ต้อง Prestige อย่างน้อย ${reqP} ครั้งเพื่อ Ultra Prestige`);
      if((profile.minerLevel ?? 1)<reqL) throw new Error(`ต้องมี Miner Level อย่างน้อย ${reqL} เพื่อ Ultra Prestige`);
      const cores=Math.max(1,1+Math.floor(((profile.minerLevel ?? 1)-reqL)/250));
      profile.ultraPrestigeCount=ultra+1; profile.ultraCores=(profile.ultraCores ?? 0)+cores;
      profile.minerLevel=1; profile.minerXp="0"; profile.maxWeightLevel=0; profile.sellMultiLevel=0; profile.sizeMultiLevel=0;
      profile.bagWeight="0"; profile.pausedReason=null; profile.miningActive=true; profile.lastSettledAt=new Date();
      await MinerPickaxe.updateMany({discordId},{$set:{powerLevel:0,luckLevel:0}},{session});
      await MinerOreStack.deleteMany({discordId,location:"bag"},{session});
      await profile.save({session}); result={cores,ultraPrestigeCount:profile.ultraPrestigeCount,ultraCores:profile.ultraCores};
    }); return result; } finally { await session.endSession(); }
  },
};
