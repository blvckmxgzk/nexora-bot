import {
  NexoNumber,
} from "./NexoNumber.js";

import {
  ORE_CATALOG,
} from "../../game/nexoMiner/oreCatalog.js";

import {
  MINER_RARITIES,
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

export type MinerSizeClass =
  | "normal"
  | "large"
  | "giant"
  | "colossal"
  | "titan";

const RARITY_CAPS:
  Record<
    number,
    number
  > = {
  7: 0.05,
  8: 0.035,
  9: 0.025,
  10: 0.018,
  11: 0.012,
  12: 0.008,
  13: 0.005,
  14: 0.003,
  15: 0.0015,
  16: 0.0008,
  17: 0.0004,
  18: 0.0002,
  19: 0.0001,
  20: 0.00005,
  21: 0.00002,
  22: 0.00001,
  23: 0.000002,
};

function normalizeWithCaps(
  probabilities:
    Array<{
      id:
        string;

      tier:
        number;

      probability:
        number;
    }>,
) {
  for (
    let iteration =
      0;
    iteration <
      30;
    iteration++
  ) {
    let excess =
      0;

    let changed =
      false;

    for (
      const entry
      of probabilities
    ) {
      const cap =
        RARITY_CAPS[
          entry.tier
        ];

      if (
        cap ===
          undefined ||
        entry.probability <=
          cap
      ) {
        continue;
      }

      excess +=
        entry.probability -
        cap;

      entry.probability =
        cap;

      changed =
        true;
    }

    if (
      !changed ||
      excess <=
        0
    ) {
      break;
    }

    const receivers =
      probabilities.filter(
        (
          entry,
        ) => {
          const cap =
            RARITY_CAPS[
              entry.tier
            ];

          return (
            cap ===
              undefined ||
            entry.probability <
              cap
          );
        },
      );

    const receiverWeight =
      receivers.reduce(
        (
          total,
          entry,
        ) =>
          total +
          entry.probability,
        0,
      );

    if (
      receiverWeight <=
      0
    ) {
      break;
    }

    for (
      const entry
      of receivers
    ) {
      entry.probability +=
        excess *
        (
          entry.probability /
          receiverWeight
        );
    }
  }

  const total =
    probabilities.reduce(
      (
        sum,
        entry,
      ) =>
        sum +
        entry.probability,
      0,
    );

  if (
    total >
    0
  ) {
    for (
      const entry
      of probabilities
    ) {
      entry.probability /=
        total;
    }
  }

  return probabilities;
}

function chooseSize(
  rng:
    () =>
      number,
): {
  sizeClass:
    MinerSizeClass;

  multiplier:
    number;
} {
  const roll =
    rng();

  let sizeClass:
    MinerSizeClass;

  let min:
    number;

  let max:
    number;

  if (
    roll <
    0.84
  ) {
    sizeClass =
      "normal";

    min =
      0.75;

    max =
      1.25;
  } else if (
    roll <
    0.96
  ) {
    sizeClass =
      "large";

    min =
      1.25;

    max =
      2.5;
  } else if (
    roll <
    0.995
  ) {
    sizeClass =
      "giant";

    min =
      2.5;

    max =
      10;
  } else if (
    roll <
    0.9999
  ) {
    sizeClass =
      "colossal";

    min =
      10;

    max =
      50;
  } else {
    sizeClass =
      "titan";

    min =
      50;

    max =
      500;
  }

  return {
    sizeClass,

    multiplier:
      min +
      rng() *
      (
        max -
        min
      ),
  };
}

export const minerRngService = {
  rollOre(
    power:
      NexoNumber,

    luck:
      NexoNumber,

    sizeMulti:
      NexoNumber,

    rng:
      () =>
        number =
      Math.random,
  ) {
    const eligible =
      ORE_CATALOG.filter(
        (
          ore,
        ) =>
          power.gte(
            ore
              .powerRequirement,
          ),
      );

    if (
      eligible.length ===
      0
    ) {
      throw new Error(
        "ไม่มีแร่ที่ Power ปัจจุบันขุดได้",
      );
    }

    const rarityIds =
      new Set(
        eligible.map(
          (
            ore,
          ) =>
            ore.rarity,
        ),
      );

    const luckRaw =
      luck.value
        .add(
          1,
        )
        .log10()
        .toNumber();

    const luckScore =
      Number.isFinite(
        luckRaw,
      )
        ? Math.min(
            1_000,
            Math.max(
              0,
              luckRaw,
            ),
          )
        : 1_000;

    const boost =
      1 +
      0.22 *
      luckScore;

    const weights =
      MINER_RARITIES
        .filter(
          (
            rarity,
          ) =>
            rarityIds.has(
              rarity.id,
            ),
        )
        .map(
          (
            rarity,
          ) => ({
            id:
              rarity.id,

            tier:
              rarity.tier,

            raw:
              rarity.weight *
              Math.pow(
                boost,
                rarity.tier,
              ),
          }),
        );

    const totalRaw =
      weights.reduce(
        (
          sum,
          entry,
        ) =>
          sum +
          entry.raw,
        0,
      );

    const probabilities =
      normalizeWithCaps(
        weights.map(
          (
            entry,
          ) => ({
            id:
              entry.id,

            tier:
              entry.tier,

            probability:
              entry.raw /
              totalRaw,
          }),
        ),
      );

    let rarityRoll =
      rng();

    let selectedRarity =
      probabilities[
        probabilities.length -
          1
      ].id;

    for (
      const entry
      of probabilities
    ) {
      rarityRoll -=
        entry.probability;

      if (
        rarityRoll <=
        0
      ) {
        selectedRarity =
          entry.id;

        break;
      }
    }

    const ores =
      eligible.filter(
        (
          ore,
        ) =>
          ore.rarity ===
          selectedRarity,
      );

    const ore =
      ores[
        Math.min(
          ores.length -
            1,
          Math.floor(
            rng() *
            ores.length,
          ),
        )
      ];

    const baseWeight =
      ore.minWeightKg +
      rng() *
      (
        ore.maxWeightKg -
        ore.minWeightKg
      );

    const size =
      chooseSize(
        rng,
      );

    const weight =
      new NexoNumber(
        baseWeight *
        size.multiplier,
      ).mul(
        sizeMulti,
      );

    const netWorth =
      new NexoNumber(
        ore.netBase,
      ).mul(
        weight,
      );

    return {
      ore,

      rarity:
        MINER_RARITY_MAP.get(
          ore.rarity,
        )!,

      sizeClass:
        size.sizeClass,

      weight,

      netWorth,
    };
  },
};
