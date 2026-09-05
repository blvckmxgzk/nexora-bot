import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Order } from "../../models/Order.js";
import { Shop } from "../../models/Shop.js";
import { paymentAccountService } from "../../services/paymentAccountService.js";

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

  const account =
    await paymentAccountService.getByShopId(
      shop.shopId,
    );

  if (!account) {
    await interaction.reply({
      content:
        "❌ ร้านค้านี้ยังไม่ได้ตั้งค่าช่องทางรับเงิน",
      ephemeral: true,
    });
    return;
  }

  const hasPromptPay =
    account.promptpay?.enabled === true &&
    !!account.promptpay?.account;

  const hasTrueMoney =
    account.truemoney?.enabled === true &&
    !!account.truemoney?.account;

  if (
    !hasPromptPay &&
    !hasTrueMoney
  ) {
    await interaction.reply({
      content:
        "❌ ร้านค้านี้ยังไม่มีช่องทางรับเงินที่พร้อมใช้งาน",
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
          "เลือกช่องทางที่ต้องการชำระเงิน",
          "",
          "💚 **PromptPay**",
          "ชำระผ่าน PromptPay ของร้าน",
          "",
          "🟢 **TrueMoney**",
          "ชำระผ่าน TrueMoney ของร้าน",
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
