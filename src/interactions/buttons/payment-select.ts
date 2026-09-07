import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import {
  paymentService,
} from "../../services/paymentService.js";

import {
  Order,
} from "../../models/Order.js";

import {
  downloadOmiseQrImage,
} from "../../services/payment/providers/omiseProvider.js";

export const customId =
  "nexora_payment_select:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const parts =
    interaction.customId.split(":");

  const provider =
    parts[1] as
      | "promptpay"
      | "truemoney";

  const orderId =
    parts[2];

  if (
    !provider ||
    !orderId
  ) {
    await interaction.reply({
      content:
        "❌ ข้อมูล Payment ไม่ถูกต้อง",
      ephemeral: true,
    });

    return;
  }

  if (
    provider !==
      "promptpay" &&
    provider !==
      "truemoney"
  ) {
    await interaction.reply({
      content:
        "❌ ไม่รองรับช่องทางนี้",
      ephemeral: true,
    });

    return;
  }

  const order =
    await Order.findOne({
      orderId,
    });

  if (!order) {
    await interaction.reply({
      content:
        "❌ ไม่พบคำสั่งซื้อ",
      ephemeral: true,
    });

    return;
  }

  if (
    order.buyerId !==
    interaction.user.id
  ) {
    await interaction.reply({
      content:
        "❌ คุณไม่มีสิทธิ์ชำระคำสั่งซื้อนี้",
      ephemeral: true,
    });

    return;
  }

  if (
    order.status !==
    "pending"
  ) {
    await interaction.reply({
      content:
        "❌ คำสั่งซื้อนี้ไม่พร้อมสำหรับการชำระเงิน",
      ephemeral: true,
    });

    return;
  }

  await interaction.deferReply({
    ephemeral: true,
  });

  try {
    const payment =
      await paymentService.createPayment(
        {
          orderId,
          buyerId:
            interaction.user.id,
          provider,
        },
      );

    const providerName =
      provider ===
      "promptpay"
        ? "PromptPay"
        : "TrueMoney";

    const expiresUnix =
      Math.floor(
        payment.expiresAt.getTime() /
          1000,
      );

    const metadata =
      payment.metadata ??
      {};

    const qrData =
      typeof metadata.qrData ===
      "string"
        ? metadata.qrData
        : null;

    let qrAttachment:
      | AttachmentBuilder
      | null = null;

    if (qrData) {
      const qrBuffer =
        await downloadOmiseQrImage(
          qrData,
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
        .setColor(0x22c55e)
        .setTitle(
          "💳 รอชำระเงิน",
        )
        .setDescription(
          [
            `**คำสั่งซื้อ:** \`${order.orderId}\``,
            `**Payment:** \`${payment.paymentId}\``,
            "",
            `**ช่องทาง:** ${providerName}`,
            `**ยอดชำระ:** ฿${order.totalAmount.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            "",
            metadata.instructions
              ? `**วิธีชำระเงิน**\n${metadata.instructions}`
              : "",
            "",
            qrAttachment
              ? "📱 **สแกน QR ด้านล่างเพื่อชำระเงิน**"
              : "⚠️ ไม่พบ QR Code จาก Payment Provider",
            "",
            `⏰ หมดเวลา: <t:${expiresUnix}:R>`,
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .setFooter({
          text:
            "NEXORA Payment • กรุณาตรวจสอบยอดเงินก่อนชำระ",
        });

    if (qrAttachment) {
      embed.setImage(
        "attachment://nexora-payment-qr.png",
      );
    }

    const row =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(

        );

    await interaction.editReply({
      embeds: [embed],
      files:
        qrAttachment
          ? [qrAttachment]
          : [],
      components: [row],
    });
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถสร้าง Payment ได้",
      embeds: [],
      components: [],
    });
  }
}
