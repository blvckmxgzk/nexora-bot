
import { NexoNumber } from "./NexoNumber.js";
import { PICKAXE_MAP } from "../../game/nexoMiner/pickaxeCatalog.js";
import { minerProgressionService } from "./minerProgressionService.js";

export type MinerUpgrade = "power"|"luck"|"maxweight"|"sellmulti"|"sizemulti";
const UPGRADE_CONFIG = {
  power:{basePrice:"1e2",factor:1.16,curve:0.05,effect:1.32},
  luck:{basePrice:"2.5e2",factor:1.17,curve:0.055,effect:1.25},
  maxweight:{basePrice:"1.5e2",factor:1.14,curve:0.035,effect:1.45},
  sellmulti:{basePrice:"5e2",factor:1.18,curve:0.06,effect:1.18},
  sizemulti:{basePrice:"3.5e2",factor:1.17,curve:0.055,effect:1.15},
} as const;
export const minerMathService = {
  getUpgradePrice(type:MinerUpgrade, level:number) {
    const c=UPGRADE_CONFIG[type]; const milestone=Math.floor(Math.max(0,level)/50);
    const curveExponent=milestone*milestone*c.curve;
    return new NexoNumber(c.basePrice).mul(new NexoNumber(c.factor).pow(level)).mul(new NexoNumber(10).pow(curveExponent));
  },
  getStats(profile:any,pickaxe:any) {
    const d=PICKAXE_MAP.get(pickaxe.definitionId);
    const permanent=minerProgressionService.getPermanentMultipliers(profile);
    const basePower=new NexoNumber(pickaxe.basePower ?? d?.basePower ?? "1");
    const baseLuck=new NexoNumber(pickaxe.baseLuck ?? d?.baseLuck ?? "1");
    return {
      power:basePower.mul(new NexoNumber(UPGRADE_CONFIG.power.effect).pow(pickaxe.powerLevel)).mul(permanent.power),
      luck:baseLuck.mul(new NexoNumber(UPGRADE_CONFIG.luck.effect).pow(pickaxe.luckLevel)).mul(permanent.luck),
      maxWeight:new NexoNumber(300).mul(new NexoNumber(UPGRADE_CONFIG.maxweight.effect).pow(profile.maxWeightLevel)).mul(permanent.bag),
      sellMulti:new NexoNumber(UPGRADE_CONFIG.sellmulti.effect).pow(profile.sellMultiLevel).mul(permanent.sell),
      sizeMulti:new NexoNumber(UPGRADE_CONFIG.sizemulti.effect).pow(profile.sizeMultiLevel).mul(permanent.size),
      speedMulti:permanent.speed,
      xpMulti:permanent.xp,
    };
  },
  getMiningCycleMs(power:NexoNumber, speedMulti:NexoNumber=NexoNumber.one()) {
    const raw=power.value.add(1).log10().toNumber();
    const logPower=Number.isFinite(raw)?Math.max(0,Math.min(raw,10000)):10000;
    const speed=Math.max(1, Math.min(1e6, speedMulti.value.toNumber()));
    return Math.max(500, Math.floor(5000/(1+logPower*0.7)/speed));
  },
};
