
import { describe, expect, it } from "vitest";
import { ORE_CATALOG } from "../src/game/nexoMiner/oreCatalog.ts";
import { MINER_AREAS, minerProgressionService } from "../src/services/nexo/minerProgressionService.ts";
import { minerMathService } from "../src/services/nexo/minerMathService.ts";

describe("NEXO Miner Rebalance v2",()=>{
  it("has 120 ores and 24 mine areas",()=>{ expect(ORE_CATALOG).toHaveLength(120); expect(MINER_AREAS).toHaveLength(24); });
  it("starts at Starter Quarry and ends Omega",()=>{ expect(minerProgressionService.getArea(1).tier).toBe(0); expect(minerProgressionService.getArea(1350).tier).toBe(23); });
  it("late upgrade curve is softened",()=>{ expect(minerMathService.getUpgradePrice("power",100).lt("1e20")).toBe(true); });
});
