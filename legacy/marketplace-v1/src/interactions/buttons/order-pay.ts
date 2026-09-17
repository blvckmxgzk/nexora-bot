import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Order } from "../../models/Order.js";
import { Shop } from "../../models/Shop.js";
import {
  platformPaymentCapabilityService,
} from "../../services/payment/platformPaymentCapabilityService.js";

export const customId =
  "nexora_order_payment:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const orderId =
    interaction.customId.split(":")[1];

  if (!orderId) {
    await interaction.reply({
      content:
        "❌ ไม่พบ Order ID",
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

  const shop =
    await Shop.findOne({
      shopId: order.shopId,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ ไม่พบร้านค้า",
      ephemeral: true,
    });
    return;
  }

  if (
    shop.status !==
    "verified"
  ) {
    await interaction.reply({
      content:
        "❌ ร้านค้านี้ไม่สามารถรับคำสั่งซื้อได้ในขณะนี้",
      ephemeral: true,
    });
    return;
  }

  const productCategory =
    typeof order.productCategory ===
      "string"
      ? order.productCategory
      : "other";

  let availableMethods:
    Array<
      | "promptpay"
      | "truemoney"
    >;

  try {
    availableMethods =
      await platformPaymentCapabilityService
        .getAvailableMethods({
          category:
            productCategory,

          amountBaht:
            order.totalAmount,
        });
  } catch (error) {
    console.error(
      "❌ Payment capability lookup failed:",
      error,
    );

    await interaction.reply({
      content:
        "❌ ไม่สามารถตรวจสอบช่องทางชำระเงินของ NEXORA ได้ในขณะนี้",
      ephemeral: true,
    });

    return;
  }

  const hasPromptPay =
    availableMethods.includes(
      "promptpay",
    );

  const hasTrueMoney =
    availableMethods.includes(
      "truemoney",
    );

  if (
    !hasPromptPay &&
    !hasTrueMoney
  ) {
    await interaction.reply({
      content:
        "❌ ขณะนี้ไม่มีช่องทางชำระเงินของ NEXORA ที่รองรับสินค้านี้",
      ephemeral: true,
    });

    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        "💳 เลือกช่องทางชำระเงิน",
      )
      .setDescription(
        [
          `**คำสั่งซื้อ:** \`${order.orderId}\``,
          `**สินค้า:** ${order.productName}`,
          `**จำนวน:** ${order.quantity}`,
          `**ยอดชำระ:** ฿${order.totalAmount.toLocaleString("th-TH")}`,
          "",
          "เลือกช่องทางที่ NEXORA รองรับสำหรับรายการนี้",
          "",
          "💚 **PromptPay**",
          "ชำระผ่าน PromptPay ของ NEXORA Payment Provider",
          "",
          "🟢 **TrueMoney**",
          "ชำระผ่าน TrueMoney ของ NEXORA Payment Provider",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Payment • ระบบชำระเงิน",
      });

  const row =
    new ActionRowBuilder<ButtonBuilder>();

  if (hasPromptPay) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_payment_select:promptpay:${order.orderId}`,
        )
        .setLabel(
          "PromptPay",
        )
        .setEmoji("💚")
        .setStyle(
          ButtonStyle.Success,
        ),
    );
  }

  if (hasTrueMoney) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `nexora_payment_select:truemoney:${order.orderId}`,
        )
        .setLabel(
          "TrueMoney",
        )
        .setEmoji("🟢")
        .setStyle(
          ButtonStyle.Success,
        ),
    );
  }

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
