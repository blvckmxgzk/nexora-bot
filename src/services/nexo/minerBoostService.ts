
import mongoose from "mongoose";
import { MinerInventoryItem } from "../../models/MinerInventoryItem.js";
import { MinerActiveBoost } from "../../models/MinerActiveBoost.js";
import { MinerProfile } from "../../models/MinerProfile.js";
import { MINER_ITEM_MAP } from "../../game/nexoMiner/itemCatalog.js";
import { NexoNumber } from "./NexoNumber.js";

const BOOST_KEYS=["power","luck","size","sell","speed","xp","drop","mutation"] as const;
export const minerBoostService = {
  async getMultipliers(discordId:string, now=new Date()) {
    const boosts=await MinerActiveBoost.find({discordId,expiresAt:{$gt:now}});
    const result:any={power:NexoNumber.one(),luck:NexoNumber.one(),size:NexoNumber.one(),sell:NexoNumber.one(),speed:NexoNumber.one(),xp:NexoNumber.one(),drop:NexoNumber.one(),mutation:NexoNumber.one()};
    for(const boost of boosts) {
      const m=new NexoNumber(boost.multiplier);
      if(boost.stat==="all") { for(const key of BOOST_KEYS) result[key]=result[key].mul(m); }
      else if(result[boost.stat]) result[boost.stat]=result[boost.stat].mul(m);
    }
    return result;
  },
  async getActive(discordId:string, now=new Date()) { return MinerActiveBoost.find({discordId,expiresAt:{$gt:now}}).sort({expiresAt:1}); },
  async useItem(discordId:string,itemId:string) { return this.useItemMany(discordId,itemId,1); },
  async useItemMany(discordId:string,itemId:string,quantity:number) {
    const definition=MINER_ITEM_MAP.get(itemId); if(!definition) throw new Error("ไม่พบ Miner Item นี้");
    const requested=Math.max(1,Math.min(100,Math.trunc(quantity)));
    const session=await mongoose.startSession(); let result:any=null;
    try { await session.withTransaction(async()=>{
      const profile=await MinerProfile.findOne({discordId}).session(session); if(!profile) throw new Error("ยังไม่มี Miner Profile");
      const inventory=await MinerInventoryItem.findOne({discordId,itemId}).session(session);
      const available=inventory ? inventory.quantity-inventory.tradeLockedQuantity : 0;
      let consume=definition.effect?.permanent ? 1 : requested;
      if(!inventory || available<consume) throw new Error(`Item มีไม่พอ — ต้องการ ${consume} แต่ใช้ได้ ${Math.max(0,available)}`);
      const now=new Date(); const effect=definition.effect;
      if(definition.type==="boost" && effect?.stat && effect.multiplier && effect.durationSeconds) {
        const stat=effect.stat; const existing=await MinerActiveBoost.findOne({discordId,stat}).session(session);
        const durationMs=effect.durationSeconds*1000*consume; let expiresAt=new Date(now.getTime()+durationMs);
        let multiplier=new NexoNumber(effect.multiplier);
        if(existing) {
          const base=Math.max(now.getTime(),existing.expiresAt.getTime()); expiresAt=new Date(base+durationMs);
          const old=new NexoNumber(existing.multiplier); if(old.gt(multiplier)) multiplier=old;
          existing.itemId=itemId; existing.multiplier=multiplier.toStorage(); existing.startedAt=now; existing.expiresAt=expiresAt; await existing.save({session});
        } else await MinerActiveBoost.create([{discordId,stat,itemId,multiplier:multiplier.toStorage(),startedAt:now,expiresAt}],{session,ordered:true});
        result={type:"boost",stat,multiplier:multiplier.toStorage(),expiresAt,quantity:consume};
      } else if(definition.type==="token" && effect?.infiniteBag) {
        if(effect.permanent) { profile.permanentInfiniteBag=true; consume=1; result={type:"infinite_bag",permanent:true,quantity:1}; }
        else { const base=Math.max(profile.infiniteBagUntil?.getTime() ?? 0,now.getTime()); profile.infiniteBagUntil=new Date(base+(effect.durationSeconds ?? 0)*1000*consume); result={type:"infinite_bag",permanent:false,expiresAt:profile.infiniteBagUntil,quantity:consume}; }
        profile.pausedReason=null; profile.miningActive=true; profile.lastSettledAt=now;
      } else if(effect?.timeWarpSeconds) {
        profile.lastSettledAt=new Date(profile.lastSettledAt.getTime()-effect.timeWarpSeconds*1000*consume); profile.pausedReason=null; profile.miningActive=true;
        result={type:"time_warp",seconds:effect.timeWarpSeconds*consume,quantity:consume};
      } else if(effect?.maxWeightLevels) {
        profile.maxWeightLevel += effect.maxWeightLevels*consume; result={type:"bag_upgrade",levels:effect.maxWeightLevels*consume,quantity:consume};
      } else if(effect?.chestSlots) {
        profile.chestSlots += effect.chestSlots*consume; result={type:"chest_expand",slots:effect.chestSlots*consume,quantity:consume};
      } else if(effect?.prestigeStars) {
        profile.prestigeStars=(profile.prestigeStars ?? 0)+effect.prestigeStars*consume; result={type:"prestige_star",stars:effect.prestigeStars*consume,quantity:consume};
      } else throw new Error("Item นี้ยังไม่สามารถกดใช้ได้");
      await profile.save({session}); inventory.quantity-=consume;
      if(inventory.quantity<=0) await inventory.deleteOne({session}); else await inventory.save({session});
    }); return result; } finally { await session.endSession(); }
  },
};
