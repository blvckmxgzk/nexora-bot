import type {
  AnySelectMenuInteraction,
} from "discord.js";

import {
  minerGameUiService,
} from "../../services/nexo/ui/minerGameUiService.js";

import {
  minerPickaxeService,
} from "../../services/nexo/minerPickaxeService.js";

import {
  minerPickaxeShopService,
} from "../../services/nexo/minerPickaxeShopService.js";

import {
  minerBoostService,
} from "../../services/nexo/minerBoostService.js";

import {
  minerShopService,
} from "../../services/nexo/minerShopService.js";

import {
  minerService,
} from "../../services/nexo/minerService.js";

import {
  minerTradeService,
} from "../../services/nexo/minerTradeService.js";

import {
  toSuffix,
} from "../../services/nexo/NexoNumber.js";

import {
  minerUiPreferenceService,
} from "../../services/nexo/ui/minerUiPreferenceService.js";

export const customId =
  "nexo_miner_select:";

function assertOwner(
  interaction:
    AnySelectMenuInteraction,
  ownerId:
    string,
) {
  if (
    interaction.user.id !==
    ownerId
  ) {
    throw new Error(
      "UI นี้เป็นของสมาชิกคนอื่น",
    );
  }
}

export async function execute(
  interaction:
    AnySelectMenuInteraction,
): Promise<void> {
  const parts =
    interaction.customId
      .split(":");

  const action =
    parts[1];

  const ownerId =
    parts[2];

  const extra =
    parts[3];

  if (!ownerId) {
    throw new Error(
      "Invalid Miner Select",
    );
  }

  assertOwner(
    interaction,
    ownerId,
  );

  await interaction.deferUpdate();

  if (
    action ===
    "buy-pickaxe" &&
    interaction.isStringSelectMenu()
  ) {
    const definitionId =
      interaction.values[0];

    const result =
      await minerPickaxeShopService.buy(
        ownerId,
        definitionId,
      );

    await interaction.editReply(
      await minerGameUiService.pickaxeShop(
        ownerId,
        [
          "✅ **ซื้อ Pickaxe สำเร็จ!**",
          `⛏️ ${definitionId}`,
          `💰 ราคา ${toSuffix(result.price)} NEXO`,
          "",
          "ไปที่ My Pickaxes เพื่อ Equip ได้เลย",
        ].join(
          "\n",
        ),
      ),
    );

    return;
  }

  if (
    action ===
    "equip" &&
    interaction.isStringSelectMenu()
  ) {
    const id =
      interaction.values[0];

    await minerPickaxeService.equip(
      ownerId,
      id,
    );

    await interaction.editReply(
      await minerGameUiService.pickaxes(
        ownerId,
        "✅ Equip Pickaxe ใหม่แล้ว",
      ),
    );

    return;
  }

  if (
    action ===
    "use" &&
    interaction.isStringSelectMenu()
  ) {
    const itemId =
      interaction.values[0];

    const quantity =
      minerUiPreferenceService
        .getItemUseQuantity(
          ownerId,
        );

    await minerBoostService.useItemMany(
      ownerId,
      itemId,
      quantity,
    );

    await interaction.editReply(
      await minerGameUiService.items(
        ownerId,
        `🧪 ใช้ **${itemId} ×${quantity}** แล้ว`,
      ),
    );

    return;
  }

  if (
    action ===
    "buy" &&
    interaction.isStringSelectMenu()
  ) {
    const itemId =
      interaction.values[0];

    const quantity =
      minerUiPreferenceService
        .getShopQuantity(
          ownerId,
        );

    await minerShopService.buy(
      ownerId,
      itemId,
      quantity,
    );

    await interaction.editReply(
      await minerGameUiService.shop(
        ownerId,
        `🛒 ซื้อ **${itemId} ×${quantity}** แล้ว`,
      ),
    );

    return;
  }

  if (
    action ===
    "store" &&
    interaction.isStringSelectMenu()
  ) {
    const ore =
      interaction.values[0];

    await minerService.storeOre(
      ownerId,
      ore,
    );

    await interaction.editReply(
      await minerGameUiService.bag(
        ownerId,
        "💎 ย้ายแร่เข้า Rare Chest แล้ว",
      ),
    );

    return;
  }

  if (
    action ===
    "take" &&
    interaction.isStringSelectMenu()
  ) {
    const ore =
      interaction.values[0];

    await minerService.takeOre(
      ownerId,
      ore,
    );

    await interaction.editReply(
      await minerGameUiService.chest(
        ownerId,
        "🎒 ย้ายแร่กลับเข้ากระเป๋าแล้ว",
      ),
    );

    return;
  }

  if (
    action ===
    "trade-user" &&
    interaction.isUserSelectMenu()
  ) {
    const targetId =
      interaction.values[0];

    if (
      targetId ===
      ownerId
    ) {
      throw new Error(
        "ไม่สามารถ Trade กับตัวเองได้",
      );
    }

    const target =
      interaction.users.get(
        targetId,
      );

    if (
      target?.bot
    ) {
      throw new Error(
        "ไม่สามารถ Trade กับ Bot ได้",
      );
    }

    if (
      !interaction.guildId
    ) {
      throw new Error(
        "Trade ใช้ได้เฉพาะในเซิร์ฟเวอร์",
      );
    }

    const trade =
      await minerTradeService.create(
        interaction.guildId,
        ownerId,
        targetId,
      );

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        trade.tradeId,
        `🤝 สร้าง Trade กับ <@${targetId}> แล้ว`,
      ),
    );

    return;
  }

  if (
    action ===
    "trade-view" &&
    interaction.isStringSelectMenu()
  ) {
    const tradeId =
      interaction.values[0];

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        tradeId,
      ),
    );

    return;
  }

  if (
    action ===
    "trade-item" &&
    interaction.isStringSelectMenu()
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    const itemId =
      interaction.values[0];

    const current =
      await minerTradeService.get(
        extra,
        ownerId,
      );

    const side =
      current.trade.sideA
        .userId ===
      ownerId
        ? current.trade.sideA
        : current.trade.sideB;

    const existing =
      side.items.find(
        (
          item: any,
        ) =>
          item.itemId ===
          itemId,
      );

    const addQuantity =
      minerUiPreferenceService
        .getTradeItemQuantity(
          ownerId,
        );

    const quantity =
      (
        existing?.quantity ??
        0
      ) +
      addQuantity;

    await minerTradeService.offerItem(
      extra,
      ownerId,
      itemId,
      quantity,
    );

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        extra,
        `📦 เพิ่ม ${itemId} ×${addQuantity} เข้า Offer`,
      ),
    );

    return;
  }

  if (
    action ===
    "trade-ore" &&
    interaction.isStringSelectMenu()
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    await minerTradeService.offerOre(
      extra,
      ownerId,
      interaction.values[0],
    );

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        extra,
        "⛏️ เพิ่ม Ore Stack เข้า Offer แล้ว",
      ),
    );

    return;
  }

  if (
    action ===
    "trade-pickaxe" &&
    interaction.isStringSelectMenu()
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    await minerTradeService.offerPickaxe(
      extra,
      ownerId,
      interaction.values[0],
    );

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        extra,
        "⛏️ เพิ่ม Pickaxe เข้า Offer แล้ว",
      ),
    );

    return;
  }

  throw new Error(
    "Unknown Miner UI action",
  );
}

export default {
  customId,
  execute,
};
