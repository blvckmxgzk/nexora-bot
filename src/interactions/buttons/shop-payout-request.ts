import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import {
  SellerPayoutAccount,
} from "../../models/SellerPayoutAccount.js";

import {
  sellerLedgerService,
} from "../../services/sellerLedgerService.js";

import {
  MIN_PAYOUT_SATANG,
} from "../../services/payoutService.js";

export const customId =
  "nexora_shop_payout_request";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  const account =
    await SellerPayoutAccount
      .findOne({
        sellerId:
          interaction.user.id,

        status:
          "ready",

        recipientActive:
          true,

        recipientVerified:
          true,
      });

  if (!account) {
    await interaction.reply({
      content:
        "❌ กรุณาตั้งค่าและยืนยันบัญชีถอนเงินก่อน",
      ephemeral:
        true,
    });

    return;
  }

  const balance =
    await sellerLedgerService
      .getAvailableBalanceSatang(
        interaction.user.id,
      );

  if (
    balance <
    MIN_PAYOUT_SATANG
  ) {
    await interaction.reply({
      content:
        `❌ ยอดถอนขั้นต่ำ ฿${(
          MIN_PAYOUT_SATANG /
          100
        ).toFixed(2)}\nยอดคงเหลือ: ฿${(
          balance /
          100
        ).toFixed(2)}`,
      ephemeral:
        true,
    });

    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        "nexora_shop_payout_request_modal",
      )
      .setTitle(
        "💸 ถอนเงิน • TEST",
      );

  const amount =
    new TextInputBuilder()
      .setCustomId(
        "amount",
      )
      .setLabel(
        "จำนวนเงิน (บาท)",
      )
      .setPlaceholder(
        "100.00",
      )
      .setValue(
        (
          balance /
          100
        ).toFixed(2),
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(20)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        amount,
      ),
  );

  await interaction.showModal(
    modal,
  );
}
