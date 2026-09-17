import crypto from "node:crypto";

import {
  Economy,
} from "../../models/Economy.js";

import {
  Transaction,
} from "../../models/Transaction.js";

import {
  DungeonProfile,
} from "../../models/DungeonProfile.js";

import {
  DungeonItem,
} from "../../models/DungeonItem.js";

import {
  DungeonMaterial,
} from "../../models/DungeonMaterial.js";

import {
  DungeonRun,
} from "../../models/DungeonRun.js";

import {
  DIFFICULTY_DATA,
  DUNGEONS,
  DUNGEON_MAP,
  DUNGEON_RARITIES,
  DUNGEON_SLOTS,
  MATERIALS,
  RARITY_DATA,
  SLOT_NAMES,
  WEAPON_DATA,
  type DungeonDifficulty,
  type DungeonRarity,
  type DungeonSlot,
  type DungeonWeaponType,
} from "../../game/nexoDungeons/catalog.js";

import {
  NexoNumber,
} from "../nexo/NexoNumber.js";

const activeRuns =
  new Set<string>();

function id(
  prefix: string,
): string {
  return (
    `${prefix}-` +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function randomInt(
  min: number,
  max: number,
): number {
  return (
    Math.floor(
      Math.random() *
      (
        max -
        min +
        1
      ),
    ) +
    min
  );
}

function pick<T>(
  values:
    readonly T[],
): T {
  return values[
    Math.floor(
      Math.random() *
      values.length,
    )
  ]!;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(
      max,
      value,
    ),
  );
}

function xpRequired(
  level: number,
): number {
  if (
    level >= 120
  ) {
    return 0;
  }

  const n =
    Math.max(
      1,
      level,
    );

  return Math.floor(
    100 +
    n * 60 +
    Math.pow(
      n,
      1.35,
    ) *
      15,
  );
}

function applyXp(
  profile: any,
  amount: number,
): {
  levelsGained: number;
} {
  profile.xp +=
    Math.max(
      0,
      Math.floor(
        amount,
      ),
    );

  let levelsGained =
    0;

  while (
    profile.level <
      120
  ) {
    const required =
      xpRequired(
        profile.level,
      );

    if (
      profile.xp <
      required
    ) {
      break;
    }

    profile.xp -=
      required;

    profile.level +=
      1;

    levelsGained +=
      1;
  }

  if (
    profile.level >=
    120
  ) {
    profile.level =
      120;
  }

  return {
    levelsGained,
  };
}

async function ensureEconomy(
  discordId: string,
) {
  return Economy
    .findOneAndUpdate(
      {
        discordId,
      },
      {
        $setOnInsert: {
          discordId,
          balance:
            "0",
          bank:
            "0",
          reservedBalance:
            "0",
          lifetimeEarned:
            "0",
          lifetimeSpent:
            "0",
          inventory:
            [],
        },
      },
      {
        upsert:
          true,
        new:
          true,
        setDefaultsOnInsert:
          true,
      },
    );
}

async function awardNexo(
  discordId: string,
  amount: number,
  description: string,
  metadata:
    Record<
      string,
      unknown
    > = {},
): Promise<string> {
  const reward =
    Math.max(
      0,
      Math.floor(
        amount,
      ),
    );

  const economy =
    await ensureEconomy(
      discordId,
    );

  if (!economy) {
    throw new Error(
      "ไม่สามารถโหลด Economy ได้",
    );
  }

  const before =
    new NexoNumber(
      economy.balance,
    );

  const after =
    before.add(
      reward,
    );

  economy.balance =
    after.toStorage();

  economy.lifetimeEarned =
    new NexoNumber(
      economy.lifetimeEarned,
    )
      .add(
        reward,
      )
      .toStorage();

  await economy.save();

  await Transaction.create({
    transactionId:
      id("DUNGEON"),

    discordId,

    type:
      "dungeon_reward",

    amount:
      String(
        reward,
      ),

    balanceBefore:
      before.toStorage(),

    balanceAfter:
      after.toStorage(),

    description,

    metadata,
  });

  return after.toStorage();
}

async function spendNexo(
  discordId: string,
  amount: number,
  description: string,
  type:
    "dungeon_upgrade" |
    "dungeon_craft",
  metadata:
    Record<
      string,
      unknown
    > = {},
): Promise<string> {
  const cost =
    Math.max(
      0,
      Math.floor(
        amount,
      ),
    );

  const economy =
    await ensureEconomy(
      discordId,
    );

  if (!economy) {
    throw new Error(
      "ไม่สามารถโหลด Economy ได้",
    );
  }

  const before =
    new NexoNumber(
      economy.balance,
    );

  if (
    before.lt(
      cost,
    )
  ) {
    throw new Error(
      `NEXO ไม่เพียงพอ ต้องใช้ ${cost.toLocaleString()} NEXO`,
    );
  }

  const after =
    before.sub(
      cost,
    );

  economy.balance =
    after.toStorage();

  economy.lifetimeSpent =
    new NexoNumber(
      economy.lifetimeSpent,
    )
      .add(
        cost,
      )
      .toStorage();

  await economy.save();

  await Transaction.create({
    transactionId:
      id("DUNGEON"),

    discordId,

    type,

    amount:
      String(
        cost,
      ),

    balanceBefore:
      before.toStorage(),

    balanceAfter:
      after.toStorage(),

    description,

    metadata,
  });

  return after.toStorage();
}

function rollRarity(
  bonus = 0,
): DungeonRarity {
  const multiplier =
    1 +
    Math.max(
      0,
      bonus,
    ) *
      0.45;

  const roll =
    Math.random();

  let cursor =
    0;

  const table: Array<
    [
      DungeonRarity,
      number,
    ]
  > = [
    [
      "divine",
      0.0005 *
        multiplier,
    ],

    [
      "ancient",
      0.002 *
        multiplier,
    ],

    [
      "mythic",
      0.008 *
        multiplier,
    ],

    [
      "legendary",
      0.03 *
        multiplier,
    ],

    [
      "epic",
      0.10 *
        multiplier,
    ],

    [
      "rare",
      0.25 *
        multiplier,
    ],

    [
      "uncommon",
      0.55,
    ],
  ];

  for (
    const [
      rarity,
      chance,
    ] of table
  ) {
    cursor +=
      chance;

    if (
      roll <=
      cursor
    ) {
      return rarity;
    }
  }

  return "common";
}

function affixCount(
  rarity:
    DungeonRarity,
): number {
  const index =
    DUNGEON_RARITIES
      .indexOf(
        rarity,
      );

  if (
    index < 2
  ) {
    return 0;
  }

  if (
    index === 2
  ) {
    return 1;
  }

  if (
    index <= 4
  ) {
    return 2;
  }

  if (
    index <= 6
  ) {
    return 3;
  }

  return 4;
}

function createAffixes(
  rarity:
    DungeonRarity,
  itemLevel:
    number,
) {
  const pool = [
    {
      key:
        "attack",
      label:
        "Attack",
      scale:
        0.7,
    },

    {
      key:
        "defense",
      label:
        "Defense",
      scale:
        0.5,
    },

    {
      key:
        "hp",
      label:
        "HP",
      scale:
        5,
    },

    {
      key:
        "critChance",
      label:
        "Critical Chance",
      scale:
        0.0025,
    },

    {
      key:
        "critDamage",
      label:
        "Critical Damage",
      scale:
        0.006,
    },

    {
      key:
        "dodge",
      label:
        "Dodge",
      scale:
        0.002,
    },
  ];

  const selected =
    [
      ...pool,
    ]
      .sort(
        () =>
          Math.random() -
          0.5,
      )
      .slice(
        0,
        affixCount(
          rarity,
        ),
      );

  const rarityMulti =
    RARITY_DATA[
      rarity
    ].multiplier;

  return selected.map(
    (entry) => ({
      key:
        entry.key,

      label:
        entry.label,

      value:
        Number(
          (
            entry.scale *
            Math.max(
              1,
              itemLevel,
            ) *
            rarityMulti *
            (
              0.8 +
              Math.random() *
                0.4
            )
          ).toFixed(
            entry.key ===
              "critChance" ||
            entry.key ===
              "critDamage" ||
            entry.key ===
              "dodge"
              ? 4
              : 2,
          ),
        ),
    }),
  );
}

function itemName(
  slot:
    DungeonSlot,
  rarity:
    DungeonRarity,
  weaponType:
    DungeonWeaponType |
    null,
): string {
  const rarityName =
    RARITY_DATA[
      rarity
    ].name;

  if (
    slot ===
      "weapon" &&
    weaponType
  ) {
    return `${rarityName} ${WEAPON_DATA[weaponType].name}`;
  }

  return `${rarityName} ${SLOT_NAMES[slot]}`;
}

function generateItemData(
  discordId:
    string,
  options: {
    itemLevel:
      number;

    rarity?:
      DungeonRarity;

    rarityBonus?:
      number;

    slot?:
      DungeonSlot;

    weaponType?:
      DungeonWeaponType |
      null;

    source:
      string;
  },
) {
  const rarity =
    options.rarity ??
    rollRarity(
      options.rarityBonus ??
      0,
    );

  const slot =
    options.slot ??
    pick(
      DUNGEON_SLOTS,
    );

  const weaponType =
    slot ===
      "weapon"
      ? (
          options.weaponType ??
          pick(
            Object.keys(
              WEAPON_DATA,
            ) as
              DungeonWeaponType[],
          )
        )
      : null;

  const itemLevel =
    Math.max(
      1,
      Math.floor(
        options.itemLevel,
      ),
    );

  const multiplier =
    RARITY_DATA[
      rarity
    ].multiplier;

  const budget =
    Math.max(
      2,
      Math.round(
        (
          5 +
          itemLevel *
            1.7
        ) *
        multiplier,
      ),
    );

  const stats = {
    attack:
      0,

    defense:
      0,

    hp:
      0,

    critChance:
      0,

    critDamage:
      0,

    dodge:
      0,
  };

  switch (
    slot
  ) {
    case "weapon":
      stats.attack =
        budget;

      stats.critChance =
        Number(
          (
            0.01 *
            multiplier
          ).toFixed(
            4,
          ),
        );

      break;

    case "helmet":
      stats.defense =
        Math.round(
          budget *
          0.7,
        );

      stats.hp =
        budget *
        3;

      break;

    case "armor":
      stats.defense =
        budget;

      stats.hp =
        budget *
        5;

      break;

    case "gloves":
      stats.attack =
        Math.round(
          budget *
          0.55,
        );

      stats.critChance =
        Number(
          (
            0.008 *
            multiplier
          ).toFixed(
            4,
          ),
        );

      break;

    case "boots":
      stats.defense =
        Math.round(
          budget *
          0.45,
        );

      stats.dodge =
        Number(
          (
            0.007 *
            multiplier
          ).toFixed(
            4,
          ),
        );

      break;

    case "ring":
      stats.attack =
        Math.round(
          budget *
          0.45,
        );

      stats.critDamage =
        Number(
          (
            0.018 *
            multiplier
          ).toFixed(
            4,
          ),
        );

      break;

    case "necklace":
      stats.hp =
        budget *
        6;

      stats.defense =
        Math.round(
          budget *
          0.3,
        );

      break;

    case "artifact":
      stats.attack =
        Math.round(
          budget *
          0.4,
        );

      stats.defense =
        Math.round(
          budget *
          0.4,
        );

      stats.hp =
        budget *
        2;

      break;
  }

  return {
    instanceId:
      id("ITEM"),

    discordId,

    definitionId:
      `${slot}-${rarity}`,

    name:
      itemName(
        slot,
        rarity,
        weaponType,
      ),

    slot,

    weaponType,

    rarity,

    itemLevel,

    upgradeLevel:
      0,

    stats,

    affixes:
      createAffixes(
        rarity,
        itemLevel,
      ),

    equipped:
      false,

    tradeLocked:
      false,

    source:
      options.source,

    obtainedAt:
      new Date(),
  };
}

async function createItem(
  discordId:
    string,
  options:
    Parameters<
      typeof generateItemData
    >[1],
) {
  return DungeonItem.create(
    generateItemData(
      discordId,
      options,
    ),
  );
}

async function effectiveStats(
  profile: any,
) {
  const items =
    await DungeonItem.find({
      discordId:
        profile.discordId,

      equipped:
        true,
    });

  let attack =
    12 +
    (
      profile.level -
      1
    ) *
      2.2;

  let defense =
    6 +
    (
      profile.level -
      1
    ) *
      1.1;

  let maxHp =
    110 +
    (
      profile.level -
      1
    ) *
      13;

  let critChance =
    0.05;

  let critDamage =
    1.5;

  let dodge =
    0.03;

  let weaponType:
    DungeonWeaponType =
      "sword";

  for (
    const item of
      items
  ) {
    const upgradeMulti =
      1 +
      (
        item.upgradeLevel ??
        0
      ) *
        0.08;

    attack +=
      (
        item.stats
          ?.attack ??
        0
      ) *
      upgradeMulti;

    defense +=
      (
        item.stats
          ?.defense ??
        0
      ) *
      upgradeMulti;

    maxHp +=
      (
        item.stats
          ?.hp ??
        0
      ) *
      upgradeMulti;

    critChance +=
      item.stats
        ?.critChance ??
      0;

    critDamage +=
      item.stats
        ?.critDamage ??
      0;

    dodge +=
      item.stats
        ?.dodge ??
      0;

    for (
      const affix of
        item.affixes ??
        []
    ) {
      switch (
        affix.key
      ) {
        case "attack":
          attack +=
            affix.value;

          break;

        case "defense":
          defense +=
            affix.value;

          break;

        case "hp":
          maxHp +=
            affix.value;

          break;

        case "critChance":
          critChance +=
            affix.value;

          break;

        case "critDamage":
          critDamage +=
            affix.value;

          break;

        case "dodge":
          dodge +=
            affix.value;

          break;
      }
    }

    if (
      item.slot ===
        "weapon" &&
      item.weaponType
    ) {
      weaponType =
        item.weaponType as
          DungeonWeaponType;
    }
  }

  const ascensionMulti =
    1 +
    (
      profile.ascension ??
      0
    ) *
      0.05;

  attack *=
    ascensionMulti;

  defense *=
    ascensionMulti;

  maxHp *=
    ascensionMulti;

  switch (
    weaponType
  ) {
    case "greatsword":
      attack *=
        1.22;

      dodge -=
        0.02;

      break;

    case "bow":
      critChance +=
        0.10;

      break;

    case "staff":
      attack *=
        1.12;

      break;

    case "dagger":
      attack *=
        0.94;

      critChance +=
        0.13;

      dodge +=
        0.07;

      break;

    case "shield":
      attack *=
        0.82;

      defense *=
        1.35;

      maxHp *=
        1.15;

      break;
  }

  return {
    attack:
      Math.max(
        1,
        attack,
      ),

    defense:
      Math.max(
        0,
        defense,
      ),

    maxHp:
      Math.max(
        1,
        maxHp,
      ),

    critChance:
      clamp(
        critChance,
        0,
        0.75,
      ),

    critDamage:
      Math.max(
        1.25,
        critDamage,
      ),

    dodge:
      clamp(
        dodge,
        0,
        0.45,
      ),

    weaponType,

    items,
  };
}

function simulateCombat(
  player: {
    attack:
      number;

    defense:
      number;

    critChance:
      number;

    critDamage:
      number;

    dodge:
      number;

    weaponType:
      DungeonWeaponType;
  },
  currentHp:
    number,
  enemyPower:
    number,
  enemyLevel:
    number,
  kind:
    "monster" |
    "elite" |
    "boss",
) {
  const typeMulti =
    kind ===
      "boss"
      ? 3.8
      : kind ===
          "elite"
        ? 2
        : 1;

  const enemyMaxHp =
    Math.round(
      (
        45 +
        enemyPower *
          8 +
        enemyLevel *
          7
      ) *
      typeMulti,
    );

  const enemyAttack =
    (
      4 +
      enemyPower *
        1.25 +
      enemyLevel *
        0.35
    ) *
    (
      kind ===
        "boss"
        ? 1.55
        : kind ===
            "elite"
          ? 1.25
          : 1
    );

  const enemyDefense =
    enemyPower *
      0.55 +
    enemyLevel *
      0.25;

  let enemyHp =
    enemyMaxHp;

  let hp =
    currentHp;

  let turns =
    0;

  while (
    hp > 0 &&
    enemyHp > 0 &&
    turns < 60
  ) {
    turns +=
      1;

    let damage =
      player.attack *
      (
        0.88 +
        Math.random() *
          0.24
      );

    const critical =
      Math.random() <
      player.critChance;

    if (
      critical
    ) {
      damage *=
        player.critDamage;
    }

    damage =
      Math.max(
        1,
        Math.round(
          damage *
          (
            100 /
            (
              100 +
              enemyDefense
            )
          ),
        ),
      );

    enemyHp -=
      damage;

    if (
      player.weaponType ===
        "sword" &&
      Math.random() <
        0.14
    ) {
      enemyHp -=
        Math.max(
          1,
          Math.round(
            damage *
            0.22,
          ),
        );
    }

    if (
      player.weaponType ===
        "staff" &&
      Math.random() <
        0.18
    ) {
      enemyHp -=
        Math.max(
          1,
          Math.round(
            player.attack *
            0.18,
          ),
        );
    }

    if (
      enemyHp <=
      0
    ) {
      break;
    }

    if (
      Math.random() <
      player.dodge
    ) {
      continue;
    }

    const received =
      Math.max(
        1,
        Math.round(
          enemyAttack *
          (
            100 /
            (
              100 +
              player.defense
            )
          ) *
          (
            0.9 +
            Math.random() *
              0.2
          ),
        ),
      );

    hp -=
      received;
  }

  return {
    victory:
      enemyHp <=
      0,

    hp:
      Math.max(
        0,
        hp,
      ),

    turns,

    enemyMaxHp,

    enemyHp:
      Math.max(
        0,
        enemyHp,
      ),
  };
}

async function addMaterial(
  discordId:
    string,
  materialId:
    string,
  name:
    string,
  quantity:
    number,
) {
  if (
    quantity <=
    0
  ) {
    return;
  }

  await DungeonMaterial
    .findOneAndUpdate(
      {
        discordId,
        materialId,
      },
      {
        $setOnInsert: {
          discordId,
          materialId,
          name,
        },

        $inc: {
          quantity,
        },
      },
      {
        upsert:
          true,

        new:
          true,

        setDefaultsOnInsert:
          true,
      },
    );
}

function highestUnlockedTier(
  level:
    number,
): number {
  let tier =
    1;

  for (
    let i =
      0;
    i <
      DUNGEONS.length;
    i++
  ) {
    if (
      level >=
      DUNGEONS[i]!
        .minLevel
    ) {
      tier =
        i +
        1;
    }
  }

  return tier;
}

export const dungeonService = {
  xpRequired,

  async createCharacter(
    discordId:
      string,
    weaponType:
      DungeonWeaponType,
  ) {
    const existing =
      await DungeonProfile
        .findOne({
          discordId,
        });

    if (
      existing
    ) {
      throw new Error(
        "คุณมีตัวละคร NEXORA Dungeons อยู่แล้ว",
      );
    }

    const profile =
      await DungeonProfile
        .create({
          discordId,

          level:
            1,

          xp:
            0,

          ascension:
            0,

          ascensionPoints:
            0,

          highestDungeonTier:
            1,
        });

    try {
      const starter =
        await createItem(
          discordId,
          {
            itemLevel:
              1,

            rarity:
              "common",

            slot:
              "weapon",

            weaponType,

            source:
              "starter",
          },
        );

      starter.tradeLocked =
        true;

      starter.equipped =
        true;

      await starter.save();

      (
        profile.equippedItems as
          any
      ).weapon =
        starter.instanceId;

      profile.markModified(
        "equippedItems",
      );

      await profile.save();

      await ensureEconomy(
        discordId,
      );

      return {
        profile,
        starter,
      };
    } catch (
      error
    ) {
      await DungeonProfile
        .deleteOne({
          _id:
            profile._id,
        })
        .catch(
          () =>
            undefined,
        );

      throw error;
    }
  },

  async getProfile(
    discordId:
      string,
  ) {
    const profile =
      await DungeonProfile
        .findOne({
          discordId,
        });

    if (
      !profile
    ) {
      return null;
    }

    const stats =
      await effectiveStats(
        profile,
      );

    const economy =
      await ensureEconomy(
        discordId,
      );

    return {
      profile,
      stats,
      balance:
        economy
          ? new NexoNumber(
              economy.balance,
            )
              .toSuffix()
          : "0",
    };
  },

  async getInventory(
    discordId:
      string,
  ) {
    const [
      items,
      materials,
    ] =
      await Promise.all([
        DungeonItem
          .find({
            discordId,
          })
          .sort({
            equipped:
              -1,

            itemLevel:
              -1,

            obtainedAt:
              -1,
          })
          .limit(
            100,
          ),

        DungeonMaterial
          .find({
            discordId,

            quantity: {
              $gt:
                0,
            },
          })
          .sort({
            quantity:
              -1,
          }),
      ]);

    return {
      items,
      materials,
    };
  },

  async equip(
    discordId:
      string,
    instanceId:
      string,
  ) {
    const profile =
      await DungeonProfile
        .findOne({
          discordId,
        });

    if (
      !profile
    ) {
      throw new Error(
        "ยังไม่มีตัวละคร ใช้ /dungeon create ก่อน",
      );
    }

    const item =
      await DungeonItem
        .findOne({
          discordId,

          instanceId,
        });

    if (
      !item
    ) {
      throw new Error(
        "ไม่พบ Item ID นี้ใน Inventory",
      );
    }

    await DungeonItem
      .updateMany(
        {
          discordId,

          slot:
            item.slot,

          equipped:
            true,
        },
        {
          $set: {
            equipped:
              false,
          },
        },
      );

    item.equipped =
      true;

    await item.save();

    (
      profile.equippedItems as
        any
    )[
      item.slot
    ] =
      item.instanceId;

    profile.markModified(
      "equippedItems",
    );

    await profile.save();

    return item;
  },

  async upgradeItem(
    discordId:
      string,
    instanceId:
      string,
  ) {
    const item =
      await DungeonItem
        .findOne({
          discordId,

          instanceId,
        });

    if (
      !item
    ) {
      throw new Error(
        "ไม่พบ Item ID นี้",
      );
    }

    if (
      item.upgradeLevel >=
      20
    ) {
      throw new Error(
        "Item นี้อัปเกรดถึง +20 แล้ว",
      );
    }

    const cost =
      Math.floor(
        300 *
        Math.pow(
          item.upgradeLevel +
            1,
          2,
        ) *
        (
          1 +
          item.itemLevel /
            20
        ),
      );

    await spendNexo(
      discordId,
      cost,
      `Upgrade ${item.name} +${item.upgradeLevel + 1}`,
      "dungeon_upgrade",
      {
        instanceId:
          item.instanceId,

        from:
          item.upgradeLevel,

        to:
          item.upgradeLevel +
          1,
      },
    );

    item.upgradeLevel +=
      1;

    await item.save();

    return {
      item,
      cost,
    };
  },

  async forgeItem(
    discordId:
      string,
    slot:
      DungeonSlot,
    materialId:
      string,
    weaponType:
      DungeonWeaponType |
      null,
  ) {
    const profile =
      await DungeonProfile
        .findOne({
          discordId,
        });

    if (
      !profile
    ) {
      throw new Error(
        "ยังไม่มีตัวละคร ใช้ /dungeon create ก่อน",
      );
    }

    if (
      slot ===
        "weapon" &&
      !weaponType
    ) {
      throw new Error(
        "การ Forge Weapon ต้องเลือกประเภทอาวุธ",
      );
    }

    const materialInfo =
      MATERIALS.find(
        (material) =>
          material.id ===
          materialId,
      );

    if (
      !materialInfo
    ) {
      throw new Error(
        "ไม่รู้จัก Material นี้",
      );
    }

    const materialCost =
      12;

    const nexoCost =
      Math.floor(
        500 +
        profile.level *
          75 +
        profile.ascension *
          500,
      );

    const economy =
      await ensureEconomy(
        discordId,
      );

    if (
      !economy ||
      new NexoNumber(
        economy.balance,
      ).lt(
        nexoCost,
      )
    ) {
      throw new Error(
        `NEXO ไม่เพียงพอ ต้องใช้ ${nexoCost.toLocaleString()} NEXO`,
      );
    }

    const material =
      await DungeonMaterial
        .findOneAndUpdate(
          {
            discordId,

            materialId,

            quantity: {
              $gte:
                materialCost,
            },
          },
          {
            $inc: {
              quantity:
                -materialCost,
            },
          },
          {
            new:
              true,
          },
        );

    if (
      !material
    ) {
      throw new Error(
        `ต้องใช้ ${materialCost} × ${materialInfo.name}`,
      );
    }

    try {
      await spendNexo(
        discordId,
        nexoCost,
        `Forge ${SLOT_NAMES[slot]}`,
        "dungeon_craft",
        {
          slot,
          materialId,
        },
      );
    } catch (
      error
    ) {
      await addMaterial(
        discordId,
        materialId,
        materialInfo.name,
        materialCost,
      );

      throw error;
    }

    let rarity =
      rollRarity(
        0.45 +
        profile.ascension *
          0.05,
      );

    if (
      rarity ===
      "common"
    ) {
      rarity =
        "uncommon";
    }

    const item =
      await createItem(
        discordId,
        {
          itemLevel:
            profile.level,

          rarity,

          slot,

          weaponType:
            slot ===
              "weapon"
              ? weaponType
              : null,

          source:
            "forge",
        },
      );

    return {
      item,
      nexoCost,
      materialCost,
      materialName:
        materialInfo.name,
    };
  },

  async run(
    discordId:
      string,
    dungeonId?:
      string,
    difficulty:
      DungeonDifficulty =
        "normal",
  ) {
    if (
      activeRuns.has(
        discordId,
      )
    ) {
      throw new Error(
        "คุณกำลังอยู่ใน Dungeon Run อื่น",
      );
    }

    activeRuns.add(
      discordId,
    );

    const startedAt =
      new Date();

    try {
      const profile =
        await DungeonProfile
          .findOne({
            discordId,
          });

      if (
        !profile
      ) {
        throw new Error(
          "ยังไม่มีตัวละคร ใช้ /dungeon create ก่อน",
        );
      }

      let dungeon =
        dungeonId
          ? DUNGEON_MAP.get(
              dungeonId,
            )
          : undefined;

      if (
        !dungeon
      ) {
        dungeon =
          [
            ...DUNGEONS,
          ]
            .reverse()
            .find(
              (candidate) =>
                profile.level >=
                candidate.minLevel,
            );
      }

      if (
        !dungeon
      ) {
        dungeon =
          DUNGEONS[0]!;
      }

      const difficultyData =
        DIFFICULTY_DATA[
          difficulty
        ];

      const requiredLevel =
        dungeon.minLevel +
        difficultyData
          .levelOffset;

      if (
        profile.level <
        requiredLevel
      ) {
        throw new Error(
          `${difficultyData.name} ${dungeon.name} ต้องการ Level ${requiredLevel}`,
        );
      }

      const stats =
        await effectiveStats(
          profile,
        );

      let hp =
        stats.maxHp;

      let attackBonus =
        1;

      let xp =
        0;

      let nexo =
        0;

      let bossDefeated =
        false;

      const materialRewards =
        new Map<
          string,
          {
            name:
              string;

            quantity:
              number;
          }
        >();

      const droppedItems:
        any[] = [];

      const roomLog:
        Array<
          Record<
            string,
            unknown
          >
        > = [];

      const roomTypes = [
        "monster",
        pick([
          "event",
          "treasure",
          "monster",
        ] as const),
        "elite",
        pick([
          "event",
          "treasure",
          "monster",
        ] as const),
        "boss",
      ] as const;

      for (
        let index =
          0;
        index <
          roomTypes.length;
        index++
      ) {
        const room =
          roomTypes[
            index
          ]!;

        if (
          hp <=
          0
        ) {
          break;
        }

        if (
          room ===
          "event"
        ) {
          const roll =
            Math.random();

          if (
            roll <
            0.34
          ) {
            const heal =
              Math.round(
                stats.maxHp *
                0.28,
              );

            hp =
              Math.min(
                stats.maxHp,
                hp +
                  heal,
              );

            roomLog.push({
              room:
                index +
                1,

              type:
                "event",

              result:
                `✨ Healing Shrine +${heal} HP`,
            });
          } else if (
            roll <
            0.67
          ) {
            const damage =
              Math.max(
                1,
                Math.round(
                  stats.maxHp *
                  0.10,
                ),
              );

            hp =
              Math.max(
                1,
                hp -
                  damage,
              );

            roomLog.push({
              room:
                index +
                1,

              type:
                "event",

              result:
                `🪤 Trap -${damage} HP`,
            });
          } else {
            attackBonus *=
              1.10;

            roomLog.push({
              room:
                index +
                1,

              type:
                "event",

              result:
                "🔮 Shrine Blessing +10% ATK สำหรับ Run นี้",
            });
          }

          continue;
        }

        if (
          room ===
          "treasure"
        ) {
          const treasureNexo =
            Math.round(
              dungeon.baseNexo *
              difficultyData
                .rewardMultiplier *
              (
                0.25 +
                Math.random() *
                  0.20
              ),
            );

          nexo +=
            treasureNexo;

          const materialAmount =
            randomInt(
              1,
              3,
            );

          const current =
            materialRewards.get(
              dungeon.materialId,
            ) ?? {
              name:
                dungeon.materialName,

              quantity:
                0,
            };

          current.quantity +=
            materialAmount;

          materialRewards.set(
            dungeon.materialId,
            current,
          );

          let itemName:
            string |
            null =
              null;

          if (
            Math.random() <
            0.30 +
              difficultyData
                .rarityBonus *
                0.05
          ) {
            const item =
              await createItem(
                discordId,
                {
                  itemLevel:
                    Math.max(
                      1,
                      profile.level +
                        randomInt(
                          -2,
                          2,
                        ),
                    ),

                  rarityBonus:
                    difficultyData
                      .rarityBonus,

                  source:
                    `treasure:${dungeon.id}`,
                },
              );

            droppedItems.push(
              item,
            );

            itemName =
              item.name;
          }

          roomLog.push({
            room:
              index +
              1,

            type:
              "treasure",

            result:
              `📦 +${treasureNexo} NEXO, +${materialAmount} ${dungeon.materialName}` +
              (
                itemName
                  ? `, ${itemName}`
                  : ""
              ),
          });

          continue;
        }

        const combatStats = {
          ...stats,

          attack:
            stats.attack *
            attackBonus,
        };

        const result =
          simulateCombat(
            combatStats,
            hp,
            dungeon.enemyPower *
              difficultyData
                .enemyMultiplier,
            requiredLevel,
            room,
          );

        hp =
          result.hp;

        if (
          !result.victory
        ) {
          roomLog.push({
            room:
              index +
              1,

            type:
              room,

            result:
              `💀 Defeated หลัง ${result.turns} turns`,
          });

          break;
        }

        const roomMultiplier =
                    room ===
            "boss"
            ? 3
            : room ===
                "elite"
              ? 1.7
              : 1;

        const gainedXp =
          Math.round(
            dungeon.baseXp *
            difficultyData
              .rewardMultiplier *
            roomMultiplier *
            (
              room ===
                "boss"
                ? 0.85
                : room ===
                    "elite"
                  ? 0.40
                  : 0.18
            ),
          );

        const gainedNexo =
          Math.round(
            dungeon.baseNexo *
            difficultyData
              .rewardMultiplier *
            roomMultiplier *
            (
              room ===
                "boss"
                ? 0.75
                : room ===
                    "elite"
                  ? 0.32
                  : 0.15
            ),
          );

        xp +=
          gainedXp;

        nexo +=
          gainedNexo;

        const materialAmount =
          room ===
            "boss"
            ? randomInt(
                3,
                6,
              )
            : room ===
                "elite"
              ? randomInt(
                  1,
                  3,
                )
              : randomInt(
                  0,
                  2,
                );

        if (
          materialAmount >
          0
        ) {
          const current =
            materialRewards.get(
              dungeon.materialId,
            ) ?? {
              name:
                dungeon.materialName,

              quantity:
                0,
            };

          current.quantity +=
            materialAmount;

          materialRewards.set(
            dungeon.materialId,
            current,
          );
        }

        let droppedItemName:
          string |
          null =
            null;

        const dropChance =
          (
            room ===
              "boss"
              ? 0.70
              : room ===
                  "elite"
                ? 0.28
                : 0.08
          ) +
          difficultyData
            .rarityBonus *
            0.04;

        if (
          Math.random() <
          dropChance
        ) {
          const item =
            await createItem(
              discordId,
              {
                itemLevel:
                  Math.max(
                    1,
                    profile.level +
                      (
                        room ===
                          "boss"
                          ? randomInt(
                              0,
                              4,
                            )
                          : randomInt(
                              -2,
                              2,
                            )
                      ),
                  ),

                rarityBonus:
                  difficultyData
                    .rarityBonus +
                  (
                    room ===
                      "boss"
                      ? 0.9
                      : room ===
                          "elite"
                        ? 0.35
                        : 0
                  ),

                source:
                  `${room}:${dungeon.id}`,
              },
            );

          droppedItems.push(
            item,
          );

          droppedItemName =
            item.name;
        }

        if (
          room ===
          "boss"
        ) {
          bossDefeated =
            true;
        }

        roomLog.push({
          room:
            index +
            1,

          type:
            room,

          result: [
            room ===
              "boss"
              ? "👑 Boss defeated"
              : room ===
                  "elite"
                ? "💀 Elite defeated"
                : "⚔️ Monster defeated",

            `+${gainedXp.toLocaleString()} EXP`,

            `+${gainedNexo.toLocaleString()} NEXO`,

            materialAmount >
              0
              ? `+${materialAmount} ${dungeon.materialName}`
              : null,

            droppedItemName,
          ]
            .filter(
              Boolean,
            )
            .join(
              " • ",
            ),
        });
      }

      const success =
        bossDefeated &&
        hp >
          0;

      if (
        success
      ) {
        const completionXp =
          Math.round(
            dungeon.baseXp *
            difficultyData
              .rewardMultiplier *
            0.75,
          );

        const completionNexo =
          Math.round(
            dungeon.baseNexo *
            difficultyData
              .rewardMultiplier *
            0.65,
          );

        xp +=
          completionXp;

        nexo +=
          completionNexo;

        const current =
          materialRewards.get(
            dungeon.materialId,
          ) ?? {
            name:
              dungeon.materialName,

            quantity:
              0,
          };

        current.quantity +=
          randomInt(
            2,
            4,
          );

        materialRewards.set(
          dungeon.materialId,
          current,
        );

        roomLog.push({
          room:
            "completion",

          type:
            "completion",

          result:
            `🏆 Completion Bonus • +${completionXp.toLocaleString()} EXP • +${completionNexo.toLocaleString()} NEXO`,
        });
      } else {
        /*
         * Dungeon Failed:
         * ยังได้ EXP / Materials บางส่วน
         * แต่เสีย Boss / Completion Reward
         */
        xp =
          Math.floor(
            xp *
            0.45,
          );

        nexo =
          Math.floor(
            nexo *
            0.25,
          );

        for (
          const reward of
            materialRewards.values()
        ) {
          reward.quantity =
            Math.floor(
              reward.quantity *
              0.5,
            );
        }
      }

      for (
        const [
          materialId,
          reward,
        ] of
          materialRewards
            .entries()
      ) {
        if (
          reward.quantity <=
          0
        ) {
          continue;
        }

        await addMaterial(
          discordId,
          materialId,
          reward.name,
          reward.quantity,
        );
      }

      let balance:
        string |
        null =
          null;

      if (
        nexo >
        0
      ) {
        balance =
          await awardNexo(
            discordId,
            nexo,
            success
              ? `Completed ${difficultyData.name} ${dungeon.name}`
              : `Partial reward from ${difficultyData.name} ${dungeon.name}`,
            {
              dungeonId:
                dungeon.id,

              difficulty,

              success,
            },
          );
      }

      const xpResult =
        applyXp(
          profile,
          xp,
        );

      profile.totalRuns +=
        1;

      if (
        success
      ) {
        profile.successfulRuns +=
          1;

        profile.bossesDefeated +=
          1;
      }

      profile.highestDungeonTier =
        Math.max(
          profile.highestDungeonTier ??
            1,

          highestUnlockedTier(
            profile.level,
          ),
        );

      profile.lastRunAt =
        new Date();

      await profile.save();

      const completedAt =
        new Date();

      const run =
        await DungeonRun.create({
          runId:
            id("RUN"),

          discordId,

          dungeonId:
            dungeon.id,

          difficulty,

          status:
            success
              ? "completed"
              : "failed",

          rooms:
            roomLog,

          rewards: {
            xp,
            nexo,

            materials:
              Array.from(
                materialRewards.entries(),
              ).map(
                ([
                  materialId,
                  reward,
                ]) => ({
                  materialId,
                  name:
                    reward.name,
                  quantity:
                    reward.quantity,
                }),
              ),

            items:
              droppedItems.map(
                (item) => ({
                  instanceId:
                    item.instanceId,

                  name:
                    item.name,

                  rarity:
                    item.rarity,

                  slot:
                    item.slot,
                }),
              ),

            levelsGained:
              xpResult.levelsGained,
          },

          startedAt,

          completedAt,
        });

      return {
        run,
        profile,

        dungeon,

        difficulty,

        difficultyData,

        success,

        hp:
          Math.round(
            hp,
          ),

        maxHp:
          Math.round(
            stats.maxHp,
          ),

        xp,

        nexo,

        balance,

        levelsGained:
          xpResult.levelsGained,

        materials:
          Array.from(
            materialRewards.entries(),
          ).map(
            ([
              materialId,
              reward,
            ]) => ({
              materialId,

              name:
                reward.name,

              quantity:
                reward.quantity,
            }),
          ),

        items:
          droppedItems,

        rooms:
          roomLog,
      };
    } finally {
      activeRuns.delete(
        discordId,
      );
    }
  },

  async ascend(
    discordId:
      string,
  ) {
    const profile =
      await DungeonProfile
        .findOne({
          discordId,
        });

    if (
      !profile
    ) {
      throw new Error(
        "ยังไม่มีตัวละคร ใช้ /dungeon create ก่อน",
      );
    }

    if (
      profile.level <
      120
    ) {
      throw new Error(
        `Ascension ต้องการ Level 120 ตอนนี้คุณ Level ${profile.level}`,
      );
    }

    profile.ascension +=
      1;

    profile.ascensionPoints +=
      1;

    profile.level =
      1;

    profile.xp =
      0;

    profile.highestDungeonTier =
      Math.max(
        1,
        profile.highestDungeonTier ??
          1,
      );

    await profile.save();

    return profile;
  },

  getDungeons() {
    return [
      ...DUNGEONS,
    ];
  },

  getMaterials() {
    return [
      ...MATERIALS,
    ];
  },
};
