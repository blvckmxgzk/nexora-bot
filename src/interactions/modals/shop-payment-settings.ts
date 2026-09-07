import {
  type ModalSubmitInteraction,
} from "discord.js";

export const customId =
  "nexora_shop_payment_settings_modal";

export async function execute(
  interaction:
    ModalSubmitInteraction,
): Promise<void> {
  await interaction.reply({
    content:
      [
        "⚠️ **Payment Settings รุ่นนี้ถูกยกเลิกแล้ว**",
        "",
        "PromptPay/TrueMoney ของ Seller ไม่ได้ใช้เป็นปลายทางรับเงินจาก Buyer อีกต่อไป",
        "ช่องทางชำระเงินถูกจัดการโดย NEXORA Platform Payment Policy",
        "",
        "ใช้เมนู **บัญชีถอนเงิน** สำหรับการรับเงินของ Seller",
      ].join(
        "\n",
      ),

    ephemeral:
      true,
  });
}
