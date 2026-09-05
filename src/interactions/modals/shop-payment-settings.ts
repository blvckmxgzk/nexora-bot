import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { paymentAccountService } from "../../services/paymentAccountService.js";

export const customId =
  "nexora_shop_payment_settings_modal";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId: interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });
    return;
  }

  const promptpay =
    interaction.fields
      .getTextInputValue(
        "promptpay",
      )
      .trim();

  const truemoney =
    interaction.fields
      .getTextInputValue(
        "truemoney",
      )
      .trim();

  const account =
    await paymentAccountService.upsert({
      shopId: shop.shopId,
      ownerId: interaction.user.id,

      promptpay: promptpay
        ? {
            account:
              promptpay,
          }
        : null,

      truemoney: truemoney
        ? {
            account:
              truemoney,
          }
        : null,
    });

  const embed =
    new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle(
        "✅ บันทึกช่องทางรับเงินแล้ว",
      )
      .setDescription(
        [
          `🏪 **ร้าน:** ${shop.name}`,
          "",
          `💚 PromptPay: ${
            account.promptpay?.enabled
              ? "เปิดใช้งาน"
              : "ไม่ได้ตั้งค่า"
          }`,

          `🟢 TrueMoney: ${
            account.truemoney?.enabled
              ? "เปิดใช้งาน"
              : "ไม่ได้ตั้งค่า"
          }`,

          "",
          "ลูกค้าจะเห็นเฉพาะช่องทางที่คุณตั้งค่าไว้",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Payment Account",
      });

  await interaction.reply({
    embeds: [embed],
    ephemeral: true,
  });
}
