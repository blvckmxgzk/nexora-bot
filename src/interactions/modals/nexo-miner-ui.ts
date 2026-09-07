import type {
  ModalSubmitInteraction,
} from "discord.js";

import {
  minerTradeService,
} from "../../services/nexo/minerTradeService.js";

import {
  minerGameUiService,
} from "../../services/nexo/ui/minerGameUiService.js";

export const customId =
  "nexo_miner_modal:";

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

  const tradeId =
    parts[3];

  if (
    interaction.user.id !==
    ownerId
  ) {
    throw new Error(
      "UI นี้เป็นของสมาชิกคนอื่น",
    );
  }

  if (
    action !==
      "trade-nexo" ||
    !tradeId
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
    tradeId,
    ownerId,
    amount,
  );

  await interaction.editReply(
    await minerGameUiService.tradeDetail(
      ownerId,
      tradeId,
      "💰 NEXO Offer ถูกอัปเดตแล้ว",
    ),
  );
}

export default {
  customId,
  execute,
};
