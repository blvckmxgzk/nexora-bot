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

  await interaction.deferUpdate();

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

    const result =
      await minerService.upgrade(
        ownerId,
        stat,
      );

    await interaction.editReply(
      await minerGameUiService.upgrades(
        ownerId,
        `${stat} → **Lv.${toSuffix(String(result.level))}** • จ่าย ${toSuffix(result.price)} NEXO`,
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
