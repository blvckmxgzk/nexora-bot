import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import {
  minerGameUiService,
  type MinerUiPage,
} from "../../services/nexo/ui/minerGameUiService.js";

import {
  minerService,
} from "../../services/nexo/minerService.js";

import {
  minerTradeService,
} from "../../services/nexo/minerTradeService.js";

import {
  minerBulkUpgradeService,
} from "../../services/nexo/minerBulkUpgradeService.js";

import {
  minerUiPreferenceService,
} from "../../services/nexo/ui/minerUiPreferenceService.js";

import {
  minerUpgradeQuantityModeService,
} from "../../services/nexo/ui/minerUpgradeQuantityModeService.js";

import {
  minerProgressionService,
} from "../../services/nexo/minerProgressionService.js";


import {
  toSuffix,
} from "../../services/nexo/NexoNumber.js";

export const customId =
  "nexo_miner:";

function assertOwner(
  interaction:
    ButtonInteraction,
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
    ButtonInteraction,
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

  if (
    !ownerId
  ) {
    throw new Error(
      "Invalid Miner UI",
    );
  }

  assertOwner(
    interaction,
    ownerId,
  );

  if (
    action ===
    "trade_nexo"
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    const modal =
      new ModalBuilder()
        .setCustomId(
          `nexo_miner_modal:trade-nexo:${ownerId}:${extra}`,
        )
        .setTitle(
          "Offer NEXO",
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          "amount",
        )
        .setLabel(
          "จำนวน NEXO",
        )
        .setPlaceholder(
          "เช่น 1000000 หรือ 1e6",
        )
        .setRequired(
          true,
        )
        .setStyle(
          TextInputStyle.Short,
        );

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>()
        .addComponents(
          input,
        ),
    );

    await interaction.showModal(
      modal,
    );

    return;
  }

  if (
    action ===
      "set_upgrade_qty" ||
    action ===
      "set_shop_qty" ||
    action ===
      "set_item_qty" ||
    action ===
      "set_trade_item_qty"
  ) {
    let current:
      number | string;

    let modalAction:
      string;

    let title:
      string;

    let label:
      string;

    if (
      action ===
      "set_upgrade_qty"
    ) {
      current =
        minerUpgradeQuantityModeService
          .isMax(
            ownerId,
          )
          ? "MAX"
          : minerUiPreferenceService
              .getUpgradeQuantity(
                ownerId,
              );

      modalAction =
        "upgrade-qty";

      title =
        "ตั้งจำนวน Upgrade";

      label =
        "จำนวน 1–100 หรือ MAX";
    } else if (
      action ===
      "set_shop_qty"
    ) {
      current =
        minerUiPreferenceService
          .getShopQuantity(
            ownerId,
          );

      modalAction =
        "shop-qty";

      title =
        "ตั้งจำนวนซื้อ Item";

      label =
        "จำนวน Item 1–100";
    } else if (
      action ===
      "set_item_qty"
    ) {
      current =
        minerUiPreferenceService
          .getItemUseQuantity(
            ownerId,
          );

      modalAction =
        "item-qty";

      title =
        "ตั้งจำนวนใช้ Item";

      label =
        "จำนวน Item 1–100";
    } else {
      current =
        minerUiPreferenceService
          .getTradeItemQuantity(
            ownerId,
          );

      modalAction =
        "trade-item-qty";

      title =
        "ตั้งจำนวน Trade Item";

      label =
        "จำนวน Item 1–100";
    }

    const suffix =
      action ===
        "set_trade_item_qty" &&
      extra
        ? `:${extra}`
        : "";

    const modal =
      new ModalBuilder()
        .setCustomId(
          `nexo_miner_modal:${modalAction}:${ownerId}${suffix}`,
        )
        .setTitle(
          title,
        );

    const input =
      new TextInputBuilder()
        .setCustomId(
          "quantity",
        )
        .setLabel(
          label,
        )
        .setPlaceholder(
          action === "set_upgrade_qty"
            ? "เช่น 5, 25, 100 หรือ MAX"
            : "เช่น 5, 10, 25, 50, 100",
        )
        .setValue(
          String(
            current,
          ),
        )
        .setMinLength(1)
        .setMaxLength(3)
        .setRequired(true)
        .setStyle(
          TextInputStyle.Short,
        );

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>()
        .addComponents(
          input,
        ),
    );

    await interaction.showModal(
      modal,
    );

    return;
  }

  await interaction.deferUpdate();

  if (
    action === "prestige"
  ) {
    const result = await minerProgressionService.prestige(ownerId);
    await interaction.editReply(
      await minerGameUiService.progression(
        ownerId,
        `⭐ Prestige สำเร็จ! ได้ **${result.stars} Prestige Star**`,
      ),
    );
    return;
  }

  if (
    action === "ultra_prestige"
  ) {
    const result = await minerProgressionService.ultraPrestige(ownerId);
    await interaction.editReply(
      await minerGameUiService.progression(
        ownerId,
        `🔥 Ultra Prestige สำเร็จ! ได้ **${result.cores} Ultra Core**`,
      ),
    );
    return;
  }

  if (
    action ===
    "pickaxe_shop"
  ) {
    await interaction.editReply(
      await minerGameUiService.pickaxeShop(
        ownerId,
      ),
    );

    return;
  }

  if (
    action ===
    "create"
  ) {
    await minerService.createProfile(
      ownerId,
    );

    await interaction.editReply(
      await minerGameUiService.home(
        ownerId,
        "⛏️ Miner Profile ถูกสร้างแล้ว — Auto Mining เริ่มทำงานทันที!",
      ),
    );

    return;
  }

  if (
    action ===
    "refresh_bag"
  ) {
    await interaction.editReply(
      await minerGameUiService.bag(
        ownerId,
      ),
    );

    return;
  }

  if (
    action ===
    "sell"
  ) {
    const result =
      await minerService.sellAll(
        ownerId,
      );

    await interaction.editReply(
      await minerGameUiService.bag(
        ownerId,
        `ขายแร่แล้ว **${toSuffix(result.payout ?? "0")} NEXO**`,
      ),
    );

    return;
  }

  if (
    action.startsWith(
      "upgrade_",
    )
  ) {
    const stat =
      action.replace(
        "upgrade_",
        "",
      ) as
        | "power"
        | "luck"
        | "maxweight"
        | "sellmulti"
        | "sizemulti";

    const quantity =
      minerUiPreferenceService
        .getUpgradeQuantity(
          ownerId,
        );

    const upgradeRequest =
      minerUpgradeQuantityModeService
        .isMax(
          ownerId,
        )
        ? "max" as const
        : quantity;

    const result =
      await minerBulkUpgradeService
        .upgradeMany(
          ownerId,
          stat,
          upgradeRequest,
        );

    const stopped =
      result.stoppedReason
        ? `\n⚠️ หยุดที่ ${result.purchased}/${result.requested}: ${result.stoppedReason}`
        : "";

    await interaction.editReply(
      await minerGameUiService.upgrades(
        ownerId,
        [
          `${stat} ซื้อสำเร็จ **×${result.purchased} เลเวล**`,
          `ตอนนี้ Lv.**${toSuffix(String(result.lastLevel))}**`,
          `💰 ใช้ทั้งหมด **${toSuffix(result.totalCost)} NEXO**`,
          stopped,
        ].join(
          "\n",
        ),
      ),
    );

    return;
  }

  if (
    action ===
    "trade_confirm"
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    const result =
      await minerTradeService.confirm(
        extra,
        ownerId,
      );

    if (
      result.completed
    ) {
      await interaction.editReply(
        await minerGameUiService.trade(
          ownerId,
          "✅ Trade Completed!",
        ),
      );

      return;
    }

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        extra,
        "✅ Confirm แล้ว — รออีกฝ่าย",
      ),
    );

    return;
  }

  if (
    action ===
    "trade_clear"
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    await minerTradeService.clear(
      extra,
      ownerId,
    );

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        extra,
        "🧹 ล้าง Offer ของคุณแล้ว",
      ),
    );

    return;
  }

  if (
    action ===
    "trade_cancel"
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    await minerTradeService.cancel(
      extra,
      ownerId,
    );

    await interaction.editReply(
      await minerGameUiService.trade(
        ownerId,
        "❌ Trade ถูกยกเลิกแล้ว",
      ),
    );

    return;
  }

  const pages =
    new Set([
      "home",
      "bag",
      "upgrades",
      "pickaxes",
      "items",
      "shop",
      "boosts",
      "chest",
      "leaderboard",
      "progression",
      "trade",
    ]);

  const page =
    pages.has(
      action,
    )
      ? action as
          MinerUiPage
      : "home";

  await interaction.editReply(
    await minerGameUiService.render(
      page,
      ownerId,
    ),
  );
}

export default {
  customId,
  execute,
};
