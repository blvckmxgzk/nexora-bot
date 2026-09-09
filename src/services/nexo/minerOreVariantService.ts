import {
  ORE_MAP,
} from "../../game/nexoMiner/oreCatalog.js";

import {
  MINER_SIZE_CLASSES,
  ORE_MUTATIONS,
  ORE_MUTATION_MAP,
  type MinerSizeClass,
  type OreMutationId,
  type OreMutationOrNone,
} from "../../game/nexoMiner/oreVariantCatalog.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

const MUTATION_SEPARATOR =
  "~";

/*
 * Base = 0.25%
 */
const BASE_MUTATION_CHANCE =
  1 / 400;

/*
 * กัน Potion/Omni ทำ chance เกินเหตุ
 */
const MAX_MUTATION_CHANCE =
  0.75;

function safeChanceMultiplier(
  value:
    NexoNumber,
) {
  const raw =
    value.value.toNumber();

  if (
    !Number.isFinite(raw)
  ) {
    return 1_000_000;
  }

  return Math.max(
    0,
    Math.min(
      1_000_000,
      raw,
    ),
  );
}

function getSizeClass(
  multiplier:
    NexoNumber,
): MinerSizeClass {
  let current:
    MinerSizeClass =
      "normal";

  for (
    const entry
    of MINER_SIZE_CLASSES
  ) {
    if (
      multiplier.gte(
        entry.min,
      )
    ) {
      current =
        entry.id;
    } else {
      break;
    }
  }

  return current;
}

function mutationDefinition(
  id:
    OreMutationOrNone,
) {
  return id === "none"
    ? null
    : ORE_MUTATION_MAP.get(
        id,
      ) ?? null;
}

export const minerOreVariantService = {
  getBaseMutationChance() {
    return BASE_MUTATION_CHANCE;
  },

  rollMutation(
    chanceMultiplier:
      NexoNumber,

    rng:
      () => number =
        Math.random,
  ): OreMutationOrNone {
    const chance =
      Math.min(
        MAX_MUTATION_CHANCE,

        BASE_MUTATION_CHANCE *
          safeChanceMultiplier(
            chanceMultiplier,
          ),
      );

    if (
      rng() >=
      chance
    ) {
      return "none";
    }

    const total =
      ORE_MUTATIONS.reduce(
        (
          sum,
          mutation,
        ) =>
          sum +
          mutation.weight,
        0,
      );

    let target =
      Math.max(
        0,
        Math.min(
          0.999999999999,
          rng(),
        ),
      ) *
      total;

    for (
      const mutation
      of ORE_MUTATIONS
    ) {
      target -=
        mutation.weight;

      if (
        target <
        0
      ) {
        return mutation.id;
      }
    }

    return ORE_MUTATIONS[
      ORE_MUTATIONS.length -
      1
    ].id;
  },

  makeStackDefinitionId(
    baseDefinitionId:
      string,

    mutation:
      OreMutationOrNone,
  ) {
    return mutation ===
      "none"
      ? baseDefinitionId
      : `${baseDefinitionId}${MUTATION_SEPARATOR}${mutation}`;
  },

  parseStackDefinitionId(
    definitionId:
      string,
  ) {
    const index =
      definitionId
        .lastIndexOf(
          MUTATION_SEPARATOR,
        );

    if (
      index <=
      0
    ) {
      return {
        baseDefinitionId:
          definitionId,

        mutation:
          "none" as const,
      };
    }

    const baseDefinitionId =
      definitionId.slice(
        0,
        index,
      );

    const candidate =
      definitionId.slice(
        index + 1,
      ) as OreMutationId;

    if (
      !ORE_MUTATION_MAP.has(
        candidate,
      )
    ) {
      return {
        baseDefinitionId:
          definitionId,

        mutation:
          "none" as const,
      };
    }

    return {
      baseDefinitionId,

      mutation:
        candidate as
          OreMutationOrNone,
    };
  },

  getDisplayInfo(
    definitionId:
      string,
  ) {
    const parsed =
      this.parseStackDefinitionId(
        definitionId,
      );

    const ore =
      ORE_MAP.get(
        parsed
          .baseDefinitionId,
      );

    const mutation =
      mutationDefinition(
        parsed.mutation,
      );

    const baseName =
      ore?.name ??
      parsed.baseDefinitionId;

    return {
      ...parsed,

      ore,

      mutationDefinition:
        mutation,

      name:
        mutation
          ? `${baseName} <${mutation.name}>`
          : baseName,
    };
  },

  getSizeClass,

  applyRoll<
    T extends {
      ore: {
        id:
          string;
      };

      weight:
        NexoNumber;

      netWorth:
        NexoNumber;
    },
  >(
    baseRoll:
      T,

    sizeMultiplier:
      NexoNumber,

    mutation:
      OreMutationOrNone,
  ) {
    const mutationDef =
      mutationDefinition(
        mutation,
      );

    const mutationSize =
      new NexoNumber(
        mutationDef
          ?.sizeMultiplier ??
          "1",
      );

    /*
     * ตรงนี้ไม่แปลงเป็น JS Number
     * ทำให้รองรับ 1e100 / 1e250 / ใหญ่กว่านั้นได้
     */
    const effectiveSize =
      sizeMultiplier.mul(
        mutationSize,
      );

    const valueMultiplier =
      new NexoNumber(
        mutationDef
          ?.valueMultiplier ??
          "1",
      );

    return {
      ...baseRoll,

      weight:
        baseRoll
          .weight
          .mul(
            effectiveSize,
          ),

      netWorth:
        baseRoll
          .netWorth
          .mul(
            sizeMultiplier,
          )
          .mul(
            valueMultiplier,
          ),

      sizeClass:
        getSizeClass(
          effectiveSize,
        ),

      mutation,

      stackDefinitionId:
        this.makeStackDefinitionId(
          baseRoll.ore.id,
          mutation,
        ),

      effectiveSizeMultiplier:
        effectiveSize,
    };
  },
};
