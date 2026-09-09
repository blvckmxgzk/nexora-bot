import type {
  ModalSubmitInteraction,
} from "discord.js";

import {
  minerTradeService,
} from "../../services/nexo/minerTradeService.js";

import {
  minerGameUiService,
} from "../../services/nexo/ui/minerGameUiService.js";

import {
  minerUiPreferenceService,
} from "../../services/nexo/ui/minerUiPreferenceService.js";

import {
  minerUpgradeQuantityModeService,
} from "../../services/nexo/ui/minerUpgradeQuantityModeService.js";

export const customId =
  "nexo_miner_modal:";

function parseQuantity(
  value: string,
) {
  const quantity =
    Number(
      value.trim(),
    );

  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity < 1 ||
    quantity > 100
  ) {
    throw new Error(
      "จำนวนต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ถึง 100",
    );
  }

  return quantity;
}

export async function execute(
  interaction:
    ModalSubmitInteraction,
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
    !ownerId ||
    interaction.user.id !==
      ownerId
  ) {
    throw new Error(
      "UI นี้เป็นของสมาชิกคนอื่น",
    );
  }

  if (
    action ===
    "upgrade-qty"
  ) {
    const raw =
      interaction.fields
        .getTextInputValue(
          "quantity",
        )
        .trim();

    if (
      raw.toLowerCase() ===
      "max"
    ) {
      minerUpgradeQuantityModeService
        .setMax(
          ownerId,
        );

      await interaction.deferUpdate();

      await interaction.editReply(
        await minerGameUiService.upgrades(
          ownerId,
          "🧮 ตั้ง Upgrade Quantity เป็น **MAX** — ระบบจะซื้อเท่าที่ NEXO จ่ายไหว",
        ),
      );

      return;
    }

    const quantity =
      parseQuantity(
        raw,
      );

    minerUpgradeQuantityModeService
      .clearMax(
        ownerId,
      );

    minerUiPreferenceService
      .setUpgradeQuantity(
        ownerId,
        quantity,
      );

    await interaction.deferUpdate();

    await interaction.editReply(
      await minerGameUiService.upgrades(
        ownerId,
        `🧮 ตั้งจำนวน Upgrade เป็น **×${quantity} เลเวล**`,
      ),
    );

    return;
  }

  if (
    action ===
    "shop-qty"
  ) {
    const quantity =
      parseQuantity(
        interaction.fields
          .getTextInputValue(
            "quantity",
          ),
      );

    minerUiPreferenceService
      .setShopQuantity(
        ownerId,
        quantity,
      );

    await interaction.deferUpdate();

    await interaction.editReply(
      await minerGameUiService.shop(
        ownerId,
        `🧮 ตั้งจำนวนซื้อเป็น **×${quantity} Item**`,
      ),
    );

    return;
  }

  if (
    action ===
    "item-qty"
  ) {
    const quantity =
      parseQuantity(
        interaction.fields
          .getTextInputValue(
            "quantity",
          ),
      );

    minerUiPreferenceService
      .setItemUseQuantity(
        ownerId,
        quantity,
      );

    await interaction.deferUpdate();

    await interaction.editReply(
      await minerGameUiService.items(
        ownerId,
        `🧮 ตั้งจำนวนใช้ Item เป็น **×${quantity}**`,
      ),
    );

    return;
  }

  if (
    action ===
    "trade-item-qty"
  ) {
    if (!extra) {
      throw new Error(
        "Trade ID missing",
      );
    }

    const quantity =
      parseQuantity(
        interaction.fields
          .getTextInputValue(
            "quantity",
          ),
      );

    minerUiPreferenceService
      .setTradeItemQuantity(
        ownerId,
        quantity,
      );

    await interaction.deferUpdate();

    await interaction.editReply(
      await minerGameUiService.tradeDetail(
        ownerId,
        extra,
        `🧮 ตั้งจำนวน Trade Item เป็น **×${quantity}**`,
      ),
    );

    return;
  }

  if (
    action !==
      "trade-nexo" ||
    !extra
  ) {
    throw new Error(
      "Invalid Miner Modal",
    );
  }

  const amount =
    interaction.fields
      .getTextInputValue(
        "amount",
      )
      .trim();

  await interaction.deferUpdate();

  await minerTradeService.offerNexo(
    extra,
    ownerId,
    amount,
  );

  await interaction.editReply(
    await minerGameUiService.tradeDetail(
      ownerId,
      extra,
      "💰 NEXO Offer ถูกอัปเดตแล้ว",
    ),
  );
}

export default {
  customId,
  execute,
};
