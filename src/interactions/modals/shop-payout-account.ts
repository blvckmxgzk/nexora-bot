import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import {
  Shop,
} from "../../models/Shop.js";

import {
  sellerPayoutAccountService,
} from "../../services/sellerPayoutAccountService.js";

export const customId =
  "nexora_shop_payout_account_modal";

export async function execute(
  interaction:
    ModalSubmitInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId:
        interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      ephemeral:
        true,
    });

    return;
  }

  await interaction.deferReply({
    ephemeral:
      true,
  });

  try {
    const account =
      await sellerPayoutAccountService
        .setup({
          sellerId:
            interaction.user.id,

          shopId:
            shop.shopId,

          accountHolderName:
            interaction.fields
              .getTextInputValue(
                "account_holder_name",
              ),

          bankCode:
            interaction.fields
              .getTextInputValue(
                "bank_code",
              ),

          accountNumber:
            interaction.fields
              .getTextInputValue(
                "account_number",
              ),
        });

    const embed =
      new EmbedBuilder()
        .setColor(
          account.status ===
            "ready"
            ? 0x22c55e
            : 0xf59e0b,
        )
        .setTitle(
          "🏦 บันทึกบัญชีถอนเงินแล้ว",
        )
        .setDescription(
          [
            `**สถานะ:** ${
              account.status ===
                "ready"
                ? "✅ พร้อมถอนเงิน"
                : "🟡 รอตรวจสอบ"
            }`,
            "",
            `**Bank:** ${account.bankBrand ?? account.bankCode ?? "-"}`,
            `**เลขท้าย:** •••• ${account.bankLastDigits ?? "-"}`,
            "",
            "🔒 NEXORA **ไม่ได้บันทึกเลขบัญชีเต็ม** ลง MongoDB",
            "🧪 ขณะนี้รองรับ Omise Test Bank เท่านั้น",
          ].join(
            "\n",
          ),
        );

    await interaction.editReply({
      embeds: [
        embed,
      ],
    });
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถตั้งค่าบัญชีถอนเงินได้",
    });
  }
}
