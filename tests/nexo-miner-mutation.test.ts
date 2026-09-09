import {
  describe,
  expect,
  it,
} from "vitest";

import {
  MINER_ITEM_MAP,
} from "../src/game/nexoMiner/itemCatalog.ts";

import {
  NexoNumber,
} from "../src/services/nexo/NexoNumber.ts";

import {
  minerOreVariantService,
} from "../src/services/nexo/minerOreVariantService.ts";

describe(
  "NEXO Miner ore mutations and size scaling",
  () => {
    it(
      "has mutation chance potions",
      () => {
        expect(
          MINER_ITEM_MAP
            .get(
              "mutation_potion_minor",
            )
            ?.effect
            ?.stat,
        ).toBe(
          "mutation",
        );

        expect(
          MINER_ITEM_MAP
            .get(
              "mutation_potion_omega",
            )
            ?.effect
            ?.multiplier,
        ).toBe(
          30,
        );
      },
    );

    it(
      "encodes mutation into stack id and parses it back",
      () => {
        const id =
          minerOreVariantService
            .makeStackDefinitionId(
              "stone",
              "void",
            );

        expect(
          id,
        ).toBe(
          "stone~void",
        );

        expect(
          minerOreVariantService
            .parseStackDefinitionId(
              id,
            ),
        ).toEqual({
          baseDefinitionId:
            "stone",

          mutation:
            "void",
        });
      },
    );

    it(
      "can deterministically roll a mutation",
      () => {
        const seq = [
          0,
          0,
        ];

        let index =
          0;

        const mutation =
          minerOreVariantService
            .rollMutation(
              new NexoNumber(
                1,
              ),

              () =>
                seq[
                  index++
                ] ??
                0,
            );

        expect(
          mutation,
        ).toBe(
          "shiny",
        );
      },
    );

    it(
      "supports enormous ore size multipliers without Number overflow",
      () => {
        const base = {
          ore: {
            id:
              "stone",
          },

          weight:
            new NexoNumber(
              2,
            ),

          netWorth:
            new NexoNumber(
              3,
            ),
        };

        const roll =
          minerOreVariantService
            .applyRoll(
              base,

              new NexoNumber(
                "1e120",
              ),

              "none",
            );

        expect(
          roll.weight.eq(
            "2e120",
          ),
        ).toBe(
          true,
        );

        expect(
          roll.netWorth.eq(
            "3e120",
          ),
        ).toBe(
          true,
        );

        expect(
          roll.sizeClass,
        ).toBe(
          "infinite",
        );
      },
    );

    it(
      "mutation changes value and physical size",
      () => {
        const base = {
          ore: {
            id:
              "stone",
          },

          weight:
            new NexoNumber(
              2,
            ),

          netWorth:
            new NexoNumber(
              3,
            ),
        };

        const roll =
          minerOreVariantService
            .applyRoll(
              base,

              new NexoNumber(
                2,
              ),

              "omega",
            );

        expect(
          roll.weight.eq(
            40,
          ),
        ).toBe(
          true,
        );

        expect(
          roll.netWorth.eq(
            60000,
          ),
        ).toBe(
          true,
        );

        expect(
          roll.stackDefinitionId,
        ).toBe(
          "stone~omega",
        );
      },
    );
  },
);
