import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { paymentService } from "../../services/paymentService.js";

import {
  downloadOmiseQrImage,
} from "../../services/payment/providers/omiseProvider.js";

export const customId =
  "nexora_payment_create:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const parts =
    interaction.customId.split(":");

  const provider =
    parts[1];

  const orderId =
    parts[2];

  if (
    provider !== "promptpay" &&
    provider !== "truemoney"
  ) {
    await interaction.reply({
      content:
        "❌ ช่องทางชำระเงินไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  if (!orderId) {
    await interaction.reply({
      content:
        "❌ Order ID ไม่ถูกต้อง",
      ephemeral: true,
    });
    return;
  }

  try {
    const payment =
      await paymentService.createPayment({
        orderId,
        buyerId:
          interaction.user.id,
        provider,
      });

    const metadata =
      payment.metadata ?? {};

    const providerName =
      provider === "promptpay"
        ? "PromptPay"
        : "TrueMoney";

    const expiresAt =
      payment.expiresAt instanceof Date
        ? payment.expiresAt
        : new Date(
            payment.expiresAt,
          );

    const expiresTimestamp =
      Math.floor(
        expiresAt.getTime() / 1000,
      );

    let qrAttachment:
      | AttachmentBuilder
      | undefined;

    /*
     * ดาวน์โหลด QR จาก Omise
     *
     * metadata.qrData คือ download_uri
     * ที่ได้จาก Omise
     *
     * Secret Key จะถูกใช้ฝั่ง Bot เท่านั้น
     * และจะไม่ถูกส่งไป Discord
     */
    if (
      metadata.qrData
    ) {
      const qrBuffer =
        await downloadOmiseQrImage(
          String(
            metadata.qrData,
          ),
        );

      qrAttachment =
        new AttachmentBuilder(
          qrBuffer,
          {
            name:
              "nexora-payment-qr.png",
          },
        );
    }

    const embed =
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(
          provider === "promptpay"
            ? "📱 ชำระเงินด้วย PromptPay"
            : "💳 ชำระเงินด้วย TrueMoney",
        )
        .setDescription(
          [
            "กรุณาสแกน QR Code ด้านล่างเพื่อชำระเงิน",
            "",
            `💰 **ยอดชำระ:** ฿${payment.amount.toLocaleString("th-TH")}`,
            `🧾 **Order ID:** \`${payment.orderId}\``,
            `💳 **Payment ID:** \`${payment.paymentId}\``,
            "",
            `⏰ **หมดอายุ:** <t:${expiresTimestamp}:R>`,
          ].join("\n"),
        )
        .addFields(
          {
            name:
              "🔖 Payment Reference",
            value:
              `\`${metadata.paymentReference ?? "ไม่ระบุ"}\``,
            inline: false,
          },
          {
            name:
              "👤 บัญชีรับเงิน",
            value:
              metadata.displayName
                ? `**${metadata.displayName}**\n\`${metadata.account ?? "ไม่ระบุ"}\``
                : `\`${metadata.account ?? "ไม่ระบุ"}\``,
            inline: false,
          },
        )
        .setFooter({
          text:
            `NEXORA Marketplace • ${providerName} Payment`,
        })
        .setTimestamp();

    if (
      metadata.instructions
    ) {
      embed.addFields({
        name:
          "📋 วิธีการชำระเงิน",
        value:
          String(
            metadata.instructions,
          ).slice(0, 1024),
        inline: false,
      });
    }

    if (qrAttachment) {
      embed
        .addFields({
          name:
            "🔳 QR Payment",
          value:
            "สแกน QR Code ด้านบนเพื่อชำระเงิน\nหลังชำระเงินแล้ว กด **🔄 ตรวจสอบการชำระเงิน**",
          inline: false,
        })
        .setImage(
          "attachment://nexora-payment-qr.png",
        );
    } else {
      embed.addFields({
        name:
          "⚠️ QR Payment",
        value:
          "ไม่พบ QR Code จาก Payment Provider",
        inline: false,
      });
    }

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_payment_check:${payment.paymentId}`,
            )
            .setLabel(
              "ตรวจสอบการชำระเงิน",
            )
            .setEmoji("🔄")
            .setStyle(
              ButtonStyle.Success,
            ),


        );

    await interaction.update({
      content: "",
      embeds: [embed],
      components: [row],
      files: qrAttachment
        ? [qrAttachment]
        : [],
    });
  } catch (error) {
    console.error(
      "❌ Failed to create payment UI:",
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถสร้างการชำระเงินได้",
      ephemeral: true,
    });
  }
}
