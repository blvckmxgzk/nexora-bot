import {
  describe,
  expect,
  it,
} from "vitest";

import {
  NexoNumber,
  toSuffix,
} from "../src/services/nexo/NexoNumber.ts";

import {
  MINER_RARITIES,
} from "../src/game/nexoMiner/rarityCatalog.ts";

import {
  ORE_CATALOG,
} from "../src/game/nexoMiner/oreCatalog.ts";

import {
  MINER_ITEM_CATALOG,
} from "../src/game/nexoMiner/itemCatalog.ts";

import {
  PICKAXE_CATALOG,
} from "../src/game/nexoMiner/pickaxeCatalog.ts";

describe(
  "NEXO Miner Foundation",
  () => {
    it(
      "uses suffix formatting",
      () => {
        expect(
          toSuffix(
            "1000000",
          ),
        ).toContain(
          "M",
        );

        expect(
          toSuffix(
            "1e60",
          ),
        ).not.toMatch(
          /e\+?\d/i,
        );
      },
    );

    it(
      "uses Alya-style multi-layer suffixes",
      () => {
        expect(
          toSuffix(
            "1e3003",
          ),
        ).toBe(
          "1Mi",
        );

        expect(
          toSuffix(
            "1e3000003",
          ),
        ).toBe(
          "1Mc",
        );

        expect(
          toSuffix(
            "1e3000000003",
          ),
        ).toBe(
          "1Na",
        );
      },
    );

    it(
      "supports huge arithmetic",
      () => {
        const value =
          new NexoNumber(
            "1e100",
          )
            .mul(
              "1e100",
            )
            .add(
              "1e50",
            );

        expect(
          value.gt(
            "1e199",
          ),
        ).toBe(
          true,
        );
      },
    );

    it(
      "has 24 rarities",
      () => {
        expect(
          MINER_RARITIES,
        ).toHaveLength(
          24,
        );
      },
    );

    it(
      "has 72 ores",
      () => {
        expect(
          ORE_CATALOG,
        ).toHaveLength(
          72,
        );
      },
    );

    it(
      "has large item catalog",
      () => {
        expect(
          MINER_ITEM_CATALOG
            .length,
        ).toBeGreaterThanOrEqual(
          45,
        );
      },
    );

    it(
      "has one pickaxe tier per rarity",
      () => {
        expect(
          PICKAXE_CATALOG,
        ).toHaveLength(
          MINER_RARITIES.length,
        );
      },
    );

    it(
      "catalog ids are unique",
      () => {
        expect(
          new Set(
            ORE_CATALOG.map(
              (
                ore,
              ) =>
                ore.id,
            ),
          ).size,
        ).toBe(
          ORE_CATALOG.length,
        );

        expect(
          new Set(
            MINER_ITEM_CATALOG.map(
              (
                item,
              ) =>
                item.id,
            ),
          ).size,
        ).toBe(
          MINER_ITEM_CATALOG.length,
        );
      },
    );
  },
);
