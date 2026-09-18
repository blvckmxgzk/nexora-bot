import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import {
  TradeRequest,
} from "../../models/TradeRequest.js";

export const customId =
  "nexora_shop_orders";

const statusNames:
  Record<
    string,
    string
  > = {
    waiting_seller:
      "🟡 รอ Seller",

    contacted:
      "🔵 ติดต่อแล้ว",

    buyer_confirmed:
      "🟣 รอ Seller ยืนยัน",

    completed:
      "🟢 สำเร็จ",

    cancelled:
      "🔴 ยกเลิก",

    expired:
      "⚫ หมดอายุ",
  };

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  const trades =
    await TradeRequest
      .find({
        $or: [
          {
            buyerId:
              interaction.user.id,
          },

          {
            sellerId:
              interaction.user.id,
          },
        ],
      })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        10,
      );

  if (
    trades.length ===
    0
  ) {
    await interaction.reply({
      content:
        "🤝 คุณยังไม่มี Trade Request",

      ephemeral:
        true,
    });

    return;
  }

  const description =
    trades
      .map(
        (
          trade,
        ) => {
          const buyer =
            trade.buyerId ===
            interaction.user.id;

          const counterpart =
            buyer
              ? trade.sellerId
              : trade.buyerId;

          return [
            `**${trade.productName}**`,
            `└ \`${trade.requestId}\` • ${statusNames[trade.status] ?? trade.status}`,
            `└ ${buyer ? "Buyer" : "Seller"} • กับ <@${counterpart}>`,
          ].join(
            "\n",
          );
        },
      )
      .join(
        "\n\n",
      );

  const embed =
    new EmbedBuilder()
      .setColor(
        0x5338e8,
      )
      .setTitle(
        "🤝 Trade ของฉัน",
      )
      .setDescription(
        description,
      )
      .setFooter({
        text:
          "NEXORA Marketplace v2 • 10 รายการล่าสุด",
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [
      embed,
    ],

    ephemeral:
      true,
  });
}
