import {
  type ButtonInteraction,
} from "discord.js";

import {
  orderService,
} from "../../services/orderService.js";

import {
  Order,
} from "../../models/Order.js";

import {
  getMarketplaceDiscordClient,
} from "../../services/marketplace/marketplaceNotificationService.js";

export const customId =
  "nexora_order_start:";

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
    order.sellerId !==
    interaction.user.id
  ) {
    await interaction.reply({
      content:
        "❌ คุณไม่มีสิทธิ์ดำเนินการกับคำสั่งซื้อนี้",
      ephemeral: true,
    });
    return;
  }

  if (
    order.status ===
    "processing"
  ) {
    await interaction.reply({
      content:
        "ℹ️ คำสั่งซื้อนี้กำลังดำเนินการอยู่แล้ว",
      ephemeral: true,
    });
    return;
  }

  if (
    order.status !==
    "paid"
  ) {
    await interaction.reply({
      content:
        `❌ Order นี้อยู่ในสถานะ \`${order.status}\` และไม่สามารถเริ่มดำเนินการได้`,
      ephemeral: true,
    });
    return;
  }

  try {
    const processing =
      await orderService.markProcessing(
        orderId,
      );

    await interaction.update({
      content:
        [
          "📦 **เริ่มดำเนินการคำสั่งซื้อแล้ว**",
          "",
          `🧾 Order ID: \`${processing.orderId}\``,
          `📦 สินค้า: **${processing.productName}**`,
          "",
          "กรุณาติดต่อผู้ซื้อและดำเนินการส่งมอบสินค้า",
          "",
          "เมื่อส่งมอบสินค้าเรียบร้อยแล้ว ให้ดำเนินการตามขั้นตอนการส่งมอบ",
        ].join("\n"),
      embeds: [],
      components: [],
    });

    /*
     * แจ้ง Buyer ว่า Seller เริ่มดำเนินการแล้ว
     */
    try {
      const client =
        getMarketplaceDiscordClient();

      const buyer =
        await client.users.fetch(
          processing.buyerId,
        );

      await buyer.send({
        content:
          [
            "📦 **ร้านค้าเริ่มดำเนินการแล้ว**",
            "",
            `🧾 Order ID: \`${processing.orderId}\``,
            `📦 สินค้า: **${processing.productName}**`,
            "",
            "ร้านค้ากำลังดำเนินการส่งมอบสินค้าให้คุณ",
            "กรุณารอการส่งมอบ และกด 🟢 Complete เมื่อได้รับและตรวจสอบสินค้าเรียบร้อยแล้ว",
          ].join("\n"),
      });

      console.log(
        `📩 Processing DM sent to buyer: ${processing.orderId}`,
      );
    } catch (buyerError) {
      console.error(
        `⚠️ Failed to notify buyer about processing order ${processing.orderId}:`,
        buyerError,
      );
    }
  } catch (error) {
    console.error(
      "❌ Failed to start order processing:",
      error,
    );

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถเริ่มดำเนินการคำสั่งซื้อได้",
      ephemeral: true,
    });
  }
}
