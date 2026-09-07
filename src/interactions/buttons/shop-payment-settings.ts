import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import {
  Shop,
} from "../../models/Shop.js";

export const customId =
  "nexora_shop_payment_settings";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId:
        interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ คุณยังไม่มีร้านค้า",

      ephemeral:
        true,
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(
        0x8b5cf6,
      )
      .setTitle(
        "💳 ระบบรับชำระเงินของ NEXORA",
      )
      .setDescription(
        [
          `🏪 **ร้าน:** ${shop.name}`,
          "",
          "ร้านค้าไม่ต้องตั้ง PromptPay หรือ TrueMoney สำหรับรับเงินจาก Buyer อีกต่อไป",
          "",
          "✅ ช่องทางชำระเงินถูกกำหนดโดย NEXORA Platform Payment Policy",
          "✅ ระบบตรวจ Payment Provider capability ก่อนแสดงช่องทาง",
          "✅ เงินถูกประมวลผลผ่าน merchant account ของ NEXORA",
          "",
          "🏦 สำหรับเงินที่ Seller จะได้รับ ให้ใช้เมนู **บัญชีถอนเงิน** แยกต่างหาก",
          "",
          "ℹ️ ข้อมูล PaymentAccount รุ่นเก่าจะไม่ถูกใช้เป็นปลายทางของ Charge",
        ].join(
          "\n",
        ),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Platform Payment",
      });

  await interaction.reply({
    embeds: [
      embed,
    ],

    ephemeral:
      true,
  });
}
