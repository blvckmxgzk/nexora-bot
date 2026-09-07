import crypto from "node:crypto";

import mongoose, {
  type ClientSession,
} from "mongoose";

import {
  MinerTrade,
} from "../../models/MinerTrade.js";

import {
  MinerTradeAction,
} from "../../models/MinerTradeAction.js";

import {
  Economy,
} from "../../models/Economy.js";

import {
  Transaction,
} from "../../models/Transaction.js";

import {
  MinerInventoryItem,
} from "../../models/MinerInventoryItem.js";

import {
  MinerOreStack,
} from "../../models/MinerOreStack.js";

import {
  MinerPickaxe,
} from "../../models/MinerPickaxe.js";

import {
  MINER_ITEM_MAP,
} from "../../game/nexoMiner/itemCatalog.js";

import {
  NexoNumber,
} from "./NexoNumber.js";

const TRADE_LIFETIME_MS =
  30 *
  60 *
  1000;

function id(
  prefix:
    string,
) {
  return (
    `${prefix}-` +
    crypto
      .randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

async function audit(
  data: {
    tradeId:
      string;

    actorId:
      string;

    action:
      string;

    details?:
      Record<
        string,
        unknown
      >;
  },

  session:
    ClientSession,
) {
  await MinerTradeAction
    .create(
      [
        {
          actionId:
            id(
              "TRDACT",
            ),

          tradeId:
            data.tradeId,

          actorId:
            data.actorId,

          action:
            data.action,

          details:
            data.details ??
            {},

          occurredAt:
            new Date(),
        },
      ],
      {
        session,
      },
    );
}

function sideKey(
  trade:
    any,

  userId:
    string,
):
  "sideA" |
  "sideB" {
  if (
    trade.sideA.userId ===
    userId
  ) {
    return "sideA";
  }

  if (
    trade.sideB.userId ===
    userId
  ) {
    return "sideB";
  }

  throw new Error(
    "คุณไม่ได้อยู่ใน Trade นี้",
  );
}

function resetConfirmations(
  trade:
    any,
) {
  trade.sideA.confirmedAt =
    null;

  trade.sideB.confirmedAt =
    null;
}

function pickaxeNetWorth(
  pickaxe:
    any,
) {
  /*
   * Upgrade เพิ่ม intrinsic value
   * แต่ไม่คืนทุนเต็ม 100%
   * เพื่อกัน loop buy-upgrade-trade
   */
  return new NexoNumber(
    pickaxe.baseNetWorth,
  ).mul(
    new NexoNumber(
      1.12,
    ).pow(
      pickaxe.powerLevel +
      pickaxe.luckLevel,
    ),
  );
}

function sideValue(
  side:
    any,
) {
  let value =
    new NexoNumber(
      side.nexo ??
      "0",
    );

  for (
    const item
    of side.items
  ) {
    value =
      value.add(
        new NexoNumber(
          item.netWorth,
        ).mul(
          item.quantity,
        ),
      );
  }

  for (
    const ore
    of side.ores
  ) {
    value =
      value.add(
        ore.totalNetWorth,
      );
  }

  for (
    const pickaxe
    of side.pickaxes
  ) {
    value =
      value.add(
        pickaxe.netWorth,
      );
  }

  return value;
}

function assertFair(
  trade:
    any,
) {
  const a =
    sideValue(
      trade.sideA,
    );

  const b =
    sideValue(
      trade.sideB,
    );

  if (
    a.lte(
      0,
    ) ||
    b.lte(
      0,
    )
  ) {
    throw new Error(
      "ทั้งสองฝ่ายต้องเสนอของที่มีมูลค่ามากกว่า 0",
    );
  }

  const larger =
    a.gte(
      b,
    )
      ? a
      : b;

  const smaller =
    a.gte(
      b,
    )
      ? b
      : a;

  const ratio =
    larger.div(
      smaller,
    );

  if (
    ratio.gt(
      1.1,
    )
  ) {
    throw new Error(
      "Trade นี้มีส่วนต่างมูลค่าเกิน 10%",
    );
  }

  return {
    sideA:
      a,

    sideB:
      b,

    ratio,
  };
}

async function getTrade(
  tradeId:
    string,

  session?:
    ClientSession,
) {
  const query =
    MinerTrade.findOne({
      tradeId,
    });

  if (session) {
    query.session(
      session,
    );
  }

  const trade =
    await query;

  if (!trade) {
    throw new Error(
      "ไม่พบ Trade นี้",
    );
  }

  return trade;
}

async function getEconomy(
  discordId:
    string,

  session:
    ClientSession,
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
        session,
      },
    );
}

async function releaseSide(
  trade:
    any,

  key:
    "sideA" |
    "sideB",

  session:
    ClientSession,
) {
  const side =
    trade[
      key
    ];

  const userId =
    side.userId;

  const economy =
    await getEconomy(
      userId,
      session,
    );

  const reserved =
    new NexoNumber(
      economy.reservedBalance ??
      "0",
    );

  const offered =
    new NexoNumber(
      side.nexo ??
      "0",
    );

  economy.reservedBalance =
    reserved
      .sub(
        offered,
      )
      .gte(
        0,
      )
      ? reserved
          .sub(
            offered,
          )
          .toStorage()
      : "0";

  await economy.save({
    session,
  });

  for (
    const item
    of side.items
  ) {
    const inventory =
      await MinerInventoryItem
        .findOne({
          discordId:
            userId,

          itemId:
            item.itemId,
        })
        .session(
          session,
        );

    if (inventory) {
      inventory.tradeLockedQuantity =
        Math.max(
          0,

          inventory
            .tradeLockedQuantity -
          item.quantity,
        );

      await inventory.save({
        session,
      });
    }
  }

  for (
    const ore
    of side.ores
  ) {
    await MinerOreStack
      .updateOne(
        {
          discordId:
            userId,

          definitionId:
            ore.definitionId,

          location:
            "bag",
        },
        {
          $set: {
            tradeLocked:
              false,
          },
        },
        {
          session,
        },
      );
  }

  for (
    const pickaxe
    of side.pickaxes
  ) {
    await MinerPickaxe
      .updateOne(
        {
          discordId:
            userId,

          pickaxeInstanceId:
            pickaxe
              .pickaxeInstanceId,
        },
        {
          $set: {
            tradeLocked:
              false,
          },
        },
        {
          session,
        },
      );
  }
}

async function transferOre(
  fromUserId:
    string,

  toUserId:
    string,

  definitionId:
    string,

  session:
    ClientSession,
) {
  const source =
    await MinerOreStack
      .findOne({
        discordId:
          fromUserId,

        definitionId,

        location:
          "bag",

        tradeLocked:
          true,
      })
      .session(
        session,
      );

  if (!source) {
    throw new Error(
      `Ore ${definitionId} ไม่ได้ถูกล็อกไว้แล้ว`,
    );
  }

  const destination =
    await MinerOreStack
      .findOne({
        discordId:
          toUserId,

        definitionId,

        location:
          "bag",
      })
      .session(
        session,
      );

  if (!destination) {
    source.discordId =
      toUserId;

    source.tradeLocked =
      false;

    await source.save({
      session,
    });

    return;
  }

  if (
    destination.tradeLocked
  ) {
    throw new Error(
      `ปลายทางมี Ore ${definitionId} ที่ติด Trade lock`,
    );
  }

  destination.quantity +=
    source.quantity;

  destination.totalWeight =
    new NexoNumber(
      destination.totalWeight,
    )
      .add(
        source.totalWeight,
      )
      .toStorage();

  destination.totalNetWorth =
    new NexoNumber(
      destination.totalNetWorth,
    )
      .add(
        source.totalNetWorth,
      )
      .toStorage();

  if (
    new NexoNumber(
      source.largestWeight,
    ).gt(
      destination
        .largestWeight,
    )
  ) {
    destination.largestWeight =
      source.largestWeight;

    destination.largestSizeClass =
      source
        .largestSizeClass;
  }

  await destination.save({
    session,
  });

  await source.deleteOne({
    session,
  });
}

async function completeTrade(
  trade:
    any,

  session:
    ClientSession,
) {
  const a =
    trade.sideA;

  const b =
    trade.sideB;

  const econA =
    await getEconomy(
      a.userId,
      session,
    );

  const econB =
    await getEconomy(
      b.userId,
      session,
    );

  const balanceA =
    new NexoNumber(
      econA.balance,
    );

  const balanceB =
    new NexoNumber(
      econB.balance,
    );

  const reservedA =
    new NexoNumber(
      econA.reservedBalance ??
      "0",
    );

  const reservedB =
    new NexoNumber(
      econB.reservedBalance ??
      "0",
    );

  const outgoingA =
    new NexoNumber(
      a.nexo,
    );

  const outgoingB =
    new NexoNumber(
      b.nexo,
    );

  if (
    reservedA.lt(
      outgoingA,
    ) ||
    reservedB.lt(
      outgoingB,
    )
  ) {
    throw new Error(
      "NEXO reservation ไม่ครบ",
    );
  }

  const afterA =
    balanceA
      .sub(
        outgoingA,
      )
      .add(
        outgoingB,
      );

  const afterB =
    balanceB
      .sub(
        outgoingB,
      )
      .add(
        outgoingA,
      );

  if (
    afterA.lt(
      0,
    ) ||
    afterB.lt(
      0,
    )
  ) {
    throw new Error(
      "ยอด NEXO ไม่เพียงพอระหว่าง commit",
    );
  }

  econA.balance =
    afterA.toStorage();

  econB.balance =
    afterB.toStorage();

  econA.reservedBalance =
    reservedA
      .sub(
        outgoingA,
      )
      .toStorage();

  econB.reservedBalance =
    reservedB
      .sub(
        outgoingB,
      )
      .toStorage();

  await econA.save({
    session,
  });

  await econB.save({
    session,
  });

  for (
    const item
    of a.items
  ) {
    const source =
      await MinerInventoryItem
        .findOne({
          discordId:
            a.userId,

          itemId:
            item.itemId,
        })
        .session(
          session,
        );

    if (
      !source ||
      source.quantity <
        item.quantity ||
      source
        .tradeLockedQuantity <
        item.quantity
    ) {
      throw new Error(
        `Item ${item.itemId} lock ไม่ครบ`,
      );
    }

    source.quantity -=
      item.quantity;

    source.tradeLockedQuantity -=
      item.quantity;

    if (
      source.quantity ===
      0
    ) {
      await source.deleteOne({
        session,
      });
    } else {
      await source.save({
        session,
      });
    }

    await MinerInventoryItem
      .findOneAndUpdate(
        {
          discordId:
            b.userId,

          itemId:
            item.itemId,
        },
        {
          $inc: {
            quantity:
              item.quantity,
          },

          $set: {
            lastSource:
              "trade",
          },

          $setOnInsert: {
            tradeLockedQuantity:
              0,
          },
        },
        {
          upsert:
            true,
          new:
            true,
          session,
        },
      );
  }

  for (
    const item
    of b.items
  ) {
    const source =
      await MinerInventoryItem
        .findOne({
          discordId:
            b.userId,

          itemId:
            item.itemId,
        })
        .session(
          session,
        );

    if (
      !source ||
      source.quantity <
        item.quantity ||
      source
        .tradeLockedQuantity <
        item.quantity
    ) {
      throw new Error(
        `Item ${item.itemId} lock ไม่ครบ`,
      );
    }

    source.quantity -=
      item.quantity;

    source.tradeLockedQuantity -=
      item.quantity;

    if (
      source.quantity ===
      0
    ) {
      await source.deleteOne({
        session,
      });
    } else {
      await source.save({
        session,
      });
    }

    await MinerInventoryItem
      .findOneAndUpdate(
        {
          discordId:
            a.userId,

          itemId:
            item.itemId,
        },
        {
          $inc: {
            quantity:
              item.quantity,
          },

          $set: {
            lastSource:
              "trade",
          },

          $setOnInsert: {
            tradeLockedQuantity:
              0,
          },
        },
        {
          upsert:
            true,
          new:
            true,
          session,
        },
      );
  }

  for (
    const ore
    of a.ores
  ) {
    await transferOre(
      a.userId,
      b.userId,
      ore.definitionId,
      session,
    );
  }

  for (
    const ore
    of b.ores
  ) {
    await transferOre(
      b.userId,
      a.userId,
      ore.definitionId,
      session,
    );
  }

  for (
    const pickaxe
    of a.pickaxes
  ) {
    const result =
      await MinerPickaxe
        .updateOne(
          {
            discordId:
              a.userId,

            pickaxeInstanceId:
              pickaxe
                .pickaxeInstanceId,

            tradeLocked:
              true,

            equipped:
              false,
          },
          {
            $set: {
              discordId:
                b.userId,

              tradeLocked:
                false,

              source:
                "trade",
            },
          },
          {
            session,
          },
        );

    if (
      result.modifiedCount !==
      1
    ) {
      throw new Error(
        "Pickaxe lock ไม่ครบ",
      );
    }
  }

  for (
    const pickaxe
    of b.pickaxes
  ) {
    const result =
      await MinerPickaxe
        .updateOne(
          {
            discordId:
              b.userId,

            pickaxeInstanceId:
              pickaxe
                .pickaxeInstanceId,

            tradeLocked:
              true,

            equipped:
              false,
          },
          {
            $set: {
              discordId:
                a.userId,

              tradeLocked:
                false,

              source:
                "trade",
            },
          },
          {
            session,
          },
        );

    if (
      result.modifiedCount !==
      1
    ) {
      throw new Error(
        "Pickaxe lock ไม่ครบ",
      );
    }
  }

  await Transaction.create(
    [
      {
        transactionId:
          id(
            "NXTRADE",
          ),

        discordId:
          a.userId,

        type:
          "trade",

        amount:
          outgoingB
            .sub(
              outgoingA,
            )
            .toStorage(),

        balanceBefore:
          balanceA
            .toStorage(),

        balanceAfter:
          afterA
            .toStorage(),

        description:
          `Trade ${trade.tradeId}`,

        metadata: {
          tradeId:
            trade.tradeId,

          partnerId:
            b.userId,
        },
      },

      {
        transactionId:
          id(
            "NXTRADE",
          ),

        discordId:
          b.userId,

        type:
          "trade",

        amount:
          outgoingA
            .sub(
              outgoingB,
            )
            .toStorage(),

        balanceBefore:
          balanceB
            .toStorage(),

        balanceAfter:
          afterB
            .toStorage(),

        description:
          `Trade ${trade.tradeId}`,

        metadata: {
          tradeId:
            trade.tradeId,

          partnerId:
            a.userId,
        },
      },
    ],
    {
      session,
      ordered: true,
    },
  );

  trade.status =
    "completed";

  trade.completedAt =
    new Date();

  await trade.save({
    session,
  });

  await audit(
    {
      tradeId:
        trade.tradeId,

      actorId:
        "SYSTEM",

      action:
        "complete",

      details: {
        sideAValue:
          sideValue(
            a,
          ).toStorage(),

        sideBValue:
          sideValue(
            b,
          ).toStorage(),
      },
    },
    session,
  );
}

export const minerTradeService = {
  async create(
    guildId:
      string,

    initiatorId:
      string,

    partnerId:
      string,
  ) {
    if (
      initiatorId ===
      partnerId
    ) {
      throw new Error(
        "ไม่สามารถ Trade กับตัวเองได้",
      );
    }

    const session =
      await mongoose
        .startSession();

    let result:
      any =
        null;

    try {
      await session
        .withTransaction(
          async () => {
            const existing =
              await MinerTrade
                .findOne({
                  status:
                    "open",

                  $or: [
                    {
                      initiatorId,
                      partnerId,
                    },

                    {
                      initiatorId:
                        partnerId,

                      partnerId:
                        initiatorId,
                    },
                  ],
                })
                .session(
                  session,
                );

            if (existing) {
              throw new Error(
                `มี Trade ที่เปิดอยู่แล้ว: ${existing.tradeId}`,
              );
            }

            const tradeId =
              id(
                "TRD",
              );

            const [
              trade,
            ] =
              await MinerTrade
                .create(
                  [
                    {
                      tradeId,
                      guildId,
                      initiatorId,
                      partnerId,

                      status:
                        "open",

                      sideA: {
                        userId:
                          initiatorId,
                        nexo:
                          "0",
                        items:
                          [],
                        ores:
                          [],
                        pickaxes:
                          [],
                        confirmedAt:
                          null,
                      },

                      sideB: {
                        userId:
                          partnerId,
                        nexo:
                          "0",
                        items:
                          [],
                        ores:
                          [],
                        pickaxes:
                          [],
                        confirmedAt:
                          null,
                      },

                      expiresAt:
                        new Date(
                          Date.now() +
                            TRADE_LIFETIME_MS,
                        ),
                    },
                  ],
                  {
                    session,
                  },
                );

            await audit(
              {
                tradeId,
                actorId:
                  initiatorId,

                action:
                  "create",

                details: {
                  partnerId,
                },
              },
              session,
            );

            result =
              trade;
          },
        );
    } finally {
      await session
        .endSession();
    }

    return result;
  },

  async get(
    tradeId:
      string,

    userId:
      string,
  ) {
    const trade =
      await getTrade(
        tradeId,
      );

    sideKey(
      trade,
      userId,
    );

    return {
      trade,

      sideAValue:
        sideValue(
          trade.sideA,
        ),

      sideBValue:
        sideValue(
          trade.sideB,
        ),
    };
  },

  async offerNexo(
    tradeId:
      string,

    userId:
      string,

    amount:
      string,
  ) {
    const target =
      new NexoNumber(
        amount,
      );

    if (
      target.lt(
        0,
      )
    ) {
      throw new Error(
        "จำนวน NEXO ต้องไม่ติดลบ",
      );
    }

    const session =
      await mongoose
        .startSession();

    try {
      await session
        .withTransaction(
          async () => {
            const trade =
              await getTrade(
                tradeId,
                session,
              );

            if (
              trade.status !==
              "open"
            ) {
              throw new Error(
                "Trade นี้ไม่ได้เปิดอยู่",
              );
            }

            const key =
              sideKey(
                trade,
                userId,
              );

            const side =
              trade[
                key
              ];

            const economy =
              await getEconomy(
                userId,
                session,
              );

            const old =
              new NexoNumber(
                side.nexo,
              );

            const reserved =
              new NexoNumber(
                economy
                  .reservedBalance ??
                "0",
              );

            const available =
              new NexoNumber(
                economy.balance,
              ).sub(
                reserved,
              );

            const increase =
              target.sub(
                old,
              );

            if (
              increase.gt(
                0,
              ) &&
              available.lt(
                increase,
              )
            ) {
              throw new Error(
                "NEXO ที่ใช้งานได้ไม่เพียงพอ",
              );
            }

            economy.reservedBalance =
              reserved
                .add(
                  increase,
                )
                .toStorage();

            side.nexo =
              target
                .toStorage();

            resetConfirmations(
              trade,
            );

            await economy.save({
              session,
            });

            await trade.save({
              session,
            });

            await audit(
              {
                tradeId,
                actorId:
                  userId,

                action:
                  "offer_nexo",

                details: {
                  amount:
                    target
                      .toStorage(),
                },
              },
              session,
            );
          },
        );
    } finally {
      await session
        .endSession();
    }
  },

  async offerItem(
    tradeId:
      string,

    userId:
      string,

    itemId:
      string,

    quantity:
      number,
  ) {
    const definition =
      MINER_ITEM_MAP.get(
        itemId,
      );

    if (
      !definition ||
      !definition.tradeable
    ) {
      throw new Error(
        "Item นี้ไม่สามารถ Trade ได้",
      );
    }

    const safeQuantity =
      Math.max(
        1,
        Math.trunc(
          quantity,
        ),
      );

    const session =
      await mongoose
        .startSession();

    try {
      await session
        .withTransaction(
          async () => {
            const trade =
              await getTrade(
                tradeId,
                session,
              );

            if (
              trade.status !==
              "open"
            ) {
              throw new Error(
                "Trade นี้ไม่ได้เปิดอยู่",
              );
            }

            const key =
              sideKey(
                trade,
                userId,
              );

            const side =
              trade[
                key
              ];

            const existing =
              side.items.find(
                (
                  item:
                    any,
                ) =>
                  item.itemId ===
                  itemId,
              );

            const previous =
              existing
                ?.quantity ??
              0;

            const inventory =
              await MinerInventoryItem
                .findOne({
                  discordId:
                    userId,
                  itemId,
                })
                .session(
                  session,
                );

            if (!inventory) {
              throw new Error(
                "คุณไม่มี Item นี้",
              );
            }

            const unlocked =
              inventory.quantity -
              inventory
                .tradeLockedQuantity;

            const increase =
              safeQuantity -
              previous;

            if (
              increase >
                0 &&
              unlocked <
                increase
            ) {
              throw new Error(
                "จำนวน Item ที่ใช้งานได้ไม่เพียงพอ",
              );
            }

            inventory
              .tradeLockedQuantity +=
              increase;

            if (existing) {
              existing.quantity =
                safeQuantity;

              existing.netWorth =
                definition
                  .netWorth;
            } else {
              side.items.push({
                itemId,

                quantity:
                  safeQuantity,

                netWorth:
                  definition
                    .netWorth,
              });
            }

            resetConfirmations(
              trade,
            );

            await inventory.save({
              session,
            });

            await trade.save({
              session,
            });

            await audit(
              {
                tradeId,
                actorId:
                  userId,

                action:
                  "offer_item",

                details: {
                  itemId,

                  quantity:
                    safeQuantity,
                },
              },
              session,
            );
          },
        );
    } finally {
      await session
        .endSession();
    }
  },

  async offerOre(
    tradeId:
      string,

    userId:
      string,

    definitionId:
      string,
  ) {
    const session =
      await mongoose
        .startSession();

    try {
      await session
        .withTransaction(
          async () => {
            const trade =
              await getTrade(
                tradeId,
                session,
              );

            if (
              trade.status !==
              "open"
            ) {
              throw new Error(
                "Trade นี้ไม่ได้เปิดอยู่",
              );
            }

            const key =
              sideKey(
                trade,
                userId,
              );

            const side =
              trade[
                key
              ];

            if (
              side.ores.some(
                (
                  ore:
                    any,
                ) =>
                  ore
                    .definitionId ===
                  definitionId,
              )
            ) {
              return;
            }

            const ore =
              await MinerOreStack
                .findOne({
                  discordId:
                    userId,

                  definitionId,

                  location:
                    "bag",

                  tradeLocked:
                    false,
                })
                .session(
                  session,
                );

            if (!ore) {
              throw new Error(
                "ไม่พบ Ore stack นี้ หรือกำลังถูกล็อก",
              );
            }

            ore.tradeLocked =
              true;

            await ore.save({
              session,
            });

            side.ores.push({
              definitionId,

              totalWeight:
                ore.totalWeight,

              totalNetWorth:
                ore.totalNetWorth,
            });

            resetConfirmations(
              trade,
            );

            await trade.save({
              session,
            });

            await audit(
              {
                tradeId,
                actorId:
                  userId,

                action:
                  "offer_ore",

                details: {
                  definitionId,

                  totalNetWorth:
                    ore.totalNetWorth,
                },
              },
              session,
            );
          },
        );
    } finally {
      await session
        .endSession();
    }
  },

  async offerPickaxe(
    tradeId:
      string,

    userId:
      string,

    pickaxeInstanceId:
      string,
  ) {
    const session =
      await mongoose
        .startSession();

    try {
      await session
        .withTransaction(
          async () => {
            const trade =
              await getTrade(
                tradeId,
                session,
              );

            if (
              trade.status !==
              "open"
            ) {
              throw new Error(
                "Trade นี้ไม่ได้เปิดอยู่",
              );
            }

            const key =
              sideKey(
                trade,
                userId,
              );

            const side =
              trade[
                key
              ];

            if (
              side.pickaxes.some(
                (
                  pickaxe:
                    any,
                ) =>
                  pickaxe
                    .pickaxeInstanceId ===
                  pickaxeInstanceId,
              )
            ) {
              return;
            }

            const pickaxe =
              await MinerPickaxe
                .findOne({
                  discordId:
                    userId,

                  pickaxeInstanceId,
                })
                .session(
                  session,
                );

            if (!pickaxe) {
              throw new Error(
                "ไม่พบ Pickaxe นี้",
              );
            }

            if (
              pickaxe.equipped
            ) {
              throw new Error(
                "ต้อง Unequip Pickaxe ก่อน Trade",
              );
            }

            if (
              pickaxe.tradeLocked ||
              pickaxe.source ===
                "starter"
            ) {
              throw new Error(
                "Pickaxe นี้ไม่สามารถ Trade ได้",
              );
            }

            const netWorth =
              pickaxeNetWorth(
                pickaxe,
              );

            pickaxe.tradeLocked =
              true;

            await pickaxe.save({
              session,
            });

            side.pickaxes.push({
              pickaxeInstanceId,

              definitionId:
                pickaxe
                  .definitionId,

              netWorth:
                netWorth
                  .toStorage(),
            });

            resetConfirmations(
              trade,
            );

            await trade.save({
              session,
            });

            await audit(
              {
                tradeId,
                actorId:
                  userId,

                action:
                  "offer_pickaxe",

                details: {
                  pickaxeInstanceId,

                  netWorth:
                    netWorth
                      .toStorage(),
                },
              },
              session,
            );
          },
        );
    } finally {
      await session
        .endSession();
    }
  },

  async clear(
    tradeId:
      string,

    userId:
      string,
  ) {
    const session =
      await mongoose
        .startSession();

    try {
      await session
        .withTransaction(
          async () => {
            const trade =
              await getTrade(
                tradeId,
                session,
              );

            if (
              trade.status !==
              "open"
            ) {
              throw new Error(
                "Trade นี้ไม่ได้เปิดอยู่",
              );
            }

            const key =
              sideKey(
                trade,
                userId,
              );

            await releaseSide(
              trade,
              key,
              session,
            );

            trade[
              key
            ].nexo =
              "0";

            trade[
              key
            ].items.splice(
              0,
              trade[
                key
              ].items.length,
            );

            trade[
              key
            ].ores.splice(
              0,
              trade[
                key
              ].ores.length,
            );

            trade[
              key
            ].pickaxes.splice(
              0,
              trade[
                key
              ].pickaxes.length,
            );

            resetConfirmations(
              trade,
            );

            await trade.save({
              session,
            });

            await audit(
              {
                tradeId,
                actorId:
                  userId,

                action:
                  "clear",
              },
              session,
            );
          },
        );
    } finally {
      await session
        .endSession();
    }
  },

  async confirm(
    tradeId:
      string,

    userId:
      string,
  ) {
    const session =
      await mongoose
        .startSession();

    let completed =
      false;

    try {
      await session
        .withTransaction(
          async () => {
            const trade =
              await getTrade(
                tradeId,
                session,
              );

            if (
              trade.status !==
              "open"
            ) {
              throw new Error(
                "Trade นี้ไม่ได้เปิดอยู่",
              );
            }

            const values =
              assertFair(
                trade,
              );

            const key =
              sideKey(
                trade,
                userId,
              );

            trade[
              key
            ].confirmedAt =
              new Date();

            await audit(
              {
                tradeId,
                actorId:
                  userId,

                action:
                  "confirm",

                details: {
                  sideAValue:
                    values
                      .sideA
                      .toStorage(),

                  sideBValue:
                    values
                      .sideB
                      .toStorage(),
                },
              },
              session,
            );

            if (
              trade.sideA
                .confirmedAt &&
              trade.sideB
                .confirmedAt
            ) {
              await completeTrade(
                trade,
                session,
              );

              completed =
                true;
            } else {
              await trade.save({
                session,
              });
            }
          },
        );
    } finally {
      await session
        .endSession();
    }

    return {
      completed,
    };
  },

  async cancel(
    tradeId:
      string,

    userId:
      string,

    reason =
      "Cancelled by participant",
  ) {
    const session =
      await mongoose
        .startSession();

    try {
      await session
        .withTransaction(
          async () => {
            const trade =
              await getTrade(
                tradeId,
                session,
              );

            if (
              trade.status !==
              "open"
            ) {
              throw new Error(
                "Trade นี้ไม่ได้เปิดอยู่",
              );
            }

            sideKey(
              trade,
              userId,
            );

            await releaseSide(
              trade,
              "sideA",
              session,
            );

            await releaseSide(
              trade,
              "sideB",
              session,
            );

            trade.status =
              "cancelled";

            trade.cancelledAt =
              new Date();

            trade.cancelReason =
              reason;

            await trade.save({
              session,
            });

            await audit(
              {
                tradeId,
                actorId:
                  userId,

                action:
                  "cancel",

                details: {
                  reason,
                },
              },
              session,
            );
          },
        );
    } finally {
      await session
        .endSession();
    }
  },

  async expireDueTrades(
    limit =
      100,
  ) {
    const trades =
      await MinerTrade
        .find({
          status:
            "open",

          expiresAt: {
            $lte:
              new Date(),
          },
        })
        .limit(
          limit,
        )
        .select({
          tradeId:
            1,
        });

    let expired =
      0;

    let failed =
      0;

    for (
      const candidate
      of trades
    ) {
      const session =
        await mongoose
          .startSession();

      try {
        await session
          .withTransaction(
            async () => {
              const trade =
                await getTrade(
                  candidate
                    .tradeId,
                  session,
                );

              if (
                trade.status !==
                "open" ||
                trade.expiresAt >
                  new Date()
              ) {
                return;
              }

              await releaseSide(
                trade,
                "sideA",
                session,
              );

              await releaseSide(
                trade,
                "sideB",
                session,
              );

              trade.status =
                "expired";

              trade.cancelledAt =
                new Date();

              trade.cancelReason =
                "Trade expired";

              await trade.save({
                session,
              });

              await audit(
                {
                  tradeId:
                    trade.tradeId,

                  actorId:
                    "SYSTEM",

                  action:
                    "expire",
                },
                session,
              );

              expired++;
            },
          );
      } catch (error) {
        failed++;

        console.error(
          `❌ Failed to expire Trade ${candidate.tradeId}:`,
          error,
        );
      } finally {
        await session
          .endSession();
      }
    }

    return {
      checked:
        trades.length,

      expired,

      failed,
    };
  },
};
