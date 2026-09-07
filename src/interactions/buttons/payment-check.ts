import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { paymentService } from "../../services/paymentService.js";

export const customId =
  "nexora_payment_check:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const paymentId =
    interaction.customId.split(":")[1];

  if (!paymentId) {
    await interaction.reply({
      content:
        "❌ Payment ID ไม่ถูกต้อง",
      ephemeral: true,
    });

    return;
  }

  try {
    const payment =
      await paymentService.getByPaymentId(
        paymentId,
      );

    if (!payment) {
      await interaction.reply({
        content:
          "❌ ไม่พบ Payment นี้",
        ephemeral: true,
      });

      return;
    }

    if (
      payment.buyerId !==
      interaction.user.id
    ) {
      await interaction.reply({
        content:
          "❌ คุณไม่มีสิทธิ์ตรวจสอบ Payment นี้",
        ephemeral: true,
      });

      return;
    }

    const result =
      await paymentService.verifyPayment(
        paymentId,
      );

    /*
     * verifyPayment() อาจคืน null ได้
     * โดยเฉพาะกรณี Payment ถูก expire
     * แต่หา Payment เดิมไม่พบ
     */
    if (!result) {
      await interaction.reply({
        content:
          "❌ ไม่พบข้อมูล Payment หลังจากตรวจสอบ",
        ephemeral: true,
      });

      return;
    }

    /*
     * Payment หมดอายุ
     */
    if (
      result.status ===
      "expired"
    ) {
      const embed =
        new EmbedBuilder()
          .setColor(0x747f8d)
          .setTitle(
            "⏰ Payment หมดอายุแล้ว",
          )
          .setDescription(
            [
              `🧾 **Order ID:** \`${result.orderId}\``,
              `💳 **Payment ID:** \`${result.paymentId}\``,
              "",
              "คำสั่งซื้อนี้หมดเวลาชำระเงินแล้ว",
              "Stock ที่ถูกกันไว้จะถูกคืนตามระบบ Order",
            ].join("\n"),
          )
          .setFooter({
            text:
              "NEXORA Marketplace • Payment Expired",
          })
          .setTimestamp();

      await interaction.update({
        content: "",
        embeds: [embed],
        components: [],
      });

      return;
    }

    /*
     * Payment สำเร็จ
     */
    if (
      result.status ===
      "paid"
    ) {
      const embed =
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle(
            "✅ ชำระเงินสำเร็จ",
          )
          .setDescription(
            [
              "ระบบตรวจพบว่าการชำระเงินของคุณสำเร็จแล้ว",
              "",
              `🧾 **Order ID:** \`${result.orderId}\``,
              `💳 **Payment ID:** \`${result.paymentId}\``,
              `💰 **ยอดชำระ:** ฿${result.amount.toLocaleString("th-TH")}`,
              "",
              "🎉 คำสั่งซื้อของคุณได้รับการยืนยันแล้ว",
              "💬 กรุณารอการติดต่อจากผู้ขายผ่าน DM",
            ].join("\n"),
          )
          .setFooter({
            text:
              "NEXORA Marketplace • Payment Successful",
          })
          .setTimestamp();

      await interaction.update({
        content: "",
        embeds: [embed],
        components: [],
      });

      return;
    }

    /*
     * Payment ยังไม่สำเร็จ
     */
    const expiresAt =
      result.expiresAt instanceof Date
        ? result.expiresAt
        : new Date(
            result.expiresAt,
          );

    const expiresTimestamp =
      Math.floor(
        expiresAt.getTime() / 1000,
      );

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_payment_check:${result.paymentId}`,
            )
            .setLabel(
              "ตรวจสอบอีกครั้ง",
            )
            .setEmoji("🔄")
            .setStyle(
              ButtonStyle.Success,
            ),


        );

    const embed =
      new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(
          "⏳ ยังไม่พบการชำระเงิน",
        )
        .setDescription(
          [
            "ระบบยังไม่พบว่าการชำระเงินสำเร็จ",
            "",
            `🧾 **Order ID:** \`${result.orderId}\``,
            `💳 **Payment ID:** \`${result.paymentId}\``,
            `💰 **ยอดชำระ:** ฿${result.amount.toLocaleString("th-TH")}`,
            "",
            `⏰ **หมดอายุ:** <t:${expiresTimestamp}:R>`,
            "",
            "หากคุณเพิ่งชำระเงิน กรุณารอสักครู่แล้วกด **🔄 ตรวจสอบอีกครั้ง**",
          ].join("\n"),
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Payment Pending",
        })
        .setTimestamp();

    await interaction.update({
      content: "",
      embeds: [embed],
      components: [row],
    });
  } catch (error) {
    console.error(
      `❌ Payment verification failed for ${paymentId}:`,
      error,
    );

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      return;
    }

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถตรวจสอบการชำระเงินได้",
      ephemeral: true,
    });
  }
}
