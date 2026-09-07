import {
  NexoNumber,
} from "./NexoNumber.js";

import {
  PICKAXE_MAP,
} from "../../game/nexoMiner/pickaxeCatalog.js";

export type MinerUpgrade =
  | "power"
  | "luck"
  | "maxweight"
  | "sellmulti"
  | "sizemulti";

const UPGRADE_CONFIG = {
  power: {
    basePrice:
      "1e3",

    factor:
      1.55,

    curve:
      1,

    effect:
      1.28,
  },

  luck: {
    basePrice:
      "5e3",

    factor:
      1.65,

    curve:
      1,

    effect:
      1.22,
  },

  maxweight: {
    basePrice:
      "2e3",

    factor:
      1.5,

    curve:
      0.8,

    effect:
      1.35,
  },

  sellmulti: {
    basePrice:
      "2e4",

    factor:
      1.75,

    curve:
      1.15,

    effect:
      1.15,
  },

  sizemulti: {
    basePrice:
      "1e4",

    factor:
      1.7,

    curve:
      1.05,

    effect:
      1.12,
  },
} as const;

export const minerMathService = {
  getUpgradePrice(
    type:
      MinerUpgrade,

    level:
      number,
  ) {
    const config =
      UPGRADE_CONFIG[
        type
      ];

    const decade =
      Math.floor(
        level /
        10,
      );

    const curveExponent =
      decade *
      decade *
      config.curve;

    return new NexoNumber(
      config.basePrice,
    )
      .mul(
        new NexoNumber(
          config.factor,
        ).pow(
          level,
        ),
      )
      .mul(
        new NexoNumber(
          10,
        ).pow(
          curveExponent,
        ),
      );
  },

  getStats(
    profile:
      any,

    pickaxe:
      any,
  ) {
    const definition =
      PICKAXE_MAP.get(
        pickaxe
          .definitionId,
      );

    const basePower =
      new NexoNumber(
        pickaxe.basePower ??
        definition
          ?.basePower ??
        "1",
      );

    const baseLuck =
      new NexoNumber(
        pickaxe.baseLuck ??
        definition
          ?.baseLuck ??
        "1",
      );

    const power =
      basePower.mul(
        new NexoNumber(
          1.28,
        ).pow(
          pickaxe
            .powerLevel,
        ),
      );

    const luck =
      baseLuck.mul(
        new NexoNumber(
          1.22,
        ).pow(
          pickaxe
            .luckLevel,
        ),
      );

    const maxWeight =
      new NexoNumber(
        100,
      ).mul(
        new NexoNumber(
          1.35,
        ).pow(
          profile
            .maxWeightLevel,
        ),
      );

    const sellMulti =
      new NexoNumber(
        1.15,
      ).pow(
        profile
          .sellMultiLevel,
      );

    const sizeMulti =
      new NexoNumber(
        1.12,
      ).pow(
        profile
          .sizeMultiLevel,
      );

    return {
      power,
      luck,
      maxWeight,
      sellMulti,
      sizeMulti,
    };
  },

  getMiningCycleMs(
    power:
      NexoNumber,
  ) {
    const raw =
      power.value
        .add(
          1,
        )
        .log10()
        .toNumber();

    const logPower =
      Number.isFinite(
        raw,
      )
        ? Math.max(
            0,
            Math.min(
              raw,
              10_000,
            ),
          )
        : 10_000;

    return Math.max(
      1_500,
      Math.floor(
        10_000 /
        (
          1 +
          logPower *
            0.5
        ),
      ),
    );
  },
};
