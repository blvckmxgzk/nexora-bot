import {
  type ModalSubmitInteraction,
} from "discord.js";

import {
  payoutService,
  parseBahtToSatang,
} from "../../services/payoutService.js";

export const customId =
  "nexora_shop_payout_request_modal";

export async function execute(
  interaction:
    ModalSubmitInteraction,
): Promise<void> {
  await interaction.deferReply({
    ephemeral:
      true,
  });

  try {
    const amountSatang =
      parseBahtToSatang(
        interaction.fields
          .getTextInputValue(
            "amount",
          ),
      );

    const payout =
      await payoutService
        .requestPayout({
          sellerId:
            interaction.user.id,

          amountSatang,
        });

    try {
      const processed =
        await payoutService
          .processPayout(
            payout.payoutId,
          );

      await interaction.editReply({
        content:
          [
            "💸 **สร้าง Test Payout แล้ว**",
            "",
            `Payout ID: \`${processed.payoutId}\``,
            `ยอดถอนก่อนค่าธรรมเนียม: ฿${(
              processed.amountSatang /
              100
            ).toFixed(2)}`,
            `ค่าธรรมเนียม Omise: ${
              processed.feeSatang !== null &&
              processed.feeSatang !== undefined
                ? `฿${(
                    processed.feeSatang /
                    100
                  ).toFixed(2)}`
                : "รอ Omise ยืนยัน"
            }`,
            `ยอดรับสุทธิ: ${
              processed.netSatang !== null &&
              processed.netSatang !== undefined
                ? `฿${(
                    processed.netSatang /
                    100
                  ).toFixed(2)}`
                : "รอ Omise ยืนยัน"
            }`,
            `สถานะ: \`${processed.status}\``,
            "",
            "ℹ️ ค่าธรรมเนียม Transfer ถูกหักจากยอดถอนของ Seller",
            "",
            processed.providerTransferId
              ? `Omise Transfer: \`${processed.providerTransferId}\``
              : "Omise Transfer ยังอยู่ระหว่าง recovery",
            "",
            "🧪 ไม่มีเงินจริงถูกโอนใน Test Mode",
          ].join(
            "\n",
          ),
      });
    } catch (error) {
      await interaction.editReply({
        content:
          [
            "🟡 **สร้าง Payout reservation แล้ว แต่ Transfer ต้องตรวจสอบต่อ**",
            "",
            `Payout ID: \`${payout.payoutId}\``,
            "",
            error instanceof Error
              ? error.message
              : "ไม่สามารถยืนยันสถานะ Omise Transfer ได้",
            "",
            "ระบบจะไม่สร้าง Transfer ซ้ำเพื่อป้องกันการถอนซ้ำ",
          ].join(
            "\n",
          ),
      });
    }
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถสร้างคำขอถอนเงินได้",
    });
  }
}
