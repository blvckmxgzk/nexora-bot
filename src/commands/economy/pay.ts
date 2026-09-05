import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import {
  economyService,
} from "../../services/economyService.js";

export const data = new SlashCommandBuilder()
  .setName("pay")
  .setDescription(
    "Transfer NEXO to another member.",
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription(
        "Member who will receive the NEXO.",
      )
      .setRequired(true),
  )
  .addIntegerOption((option) =>
    option
      .setName("amount")
      .setDescription(
        "Amount of NEXO to transfer.",
      )
      .setRequired(true)
      .setMinValue(1),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const receiver =
    interaction.options.getUser(
      "user",
      true,
    );

  const amount =
    interaction.options.getInteger(
      "amount",
      true,
    );

  if (receiver.bot) {
    await interaction.reply({
      content:
        "❌ ไม่สามารถโอนเงินให้บอทได้",
      ephemeral: true,
    });

    return;
  }

  if (
    receiver.id === interaction.user.id
  ) {
    await interaction.reply({
      content:
        "❌ ไม่สามารถโอนเงินให้ตัวเองได้",
      ephemeral: true,
    });

    return;
  }

  try {
    const result =
      await economyService.transfer(
        interaction.user.id,
        receiver.id,
        amount,
      );

    const embed =
      new EmbedBuilder()
        .setTitle("💸 NEXORA Transfer")
        .setDescription(
          `โอนเงินสำเร็จ!`,
        )
        .addFields(
          {
            name: "👤 ผู้โอน",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
          {
            name: "📥 ผู้รับ",
            value: `<@${receiver.id}>`,
            inline: true,
          },
          {
            name: "💰 จำนวน",
            value: `**${amount.toLocaleString()} NEXO**`,
            inline: false,
          },
          {
            name: "💳 ยอดคงเหลือ",
            value: `**${result.sender.balance.toLocaleString()} NEXO**`,
            inline: false,
          },
        )
        .setThumbnail(
          receiver.displayAvatarURL({
            size: 256,
          }),
        )
        .setFooter({
          text: "NEXORA Economy",
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "Insufficient balance."
    ) {
      await interaction.reply({
        content:
          "❌ ยอดเงินของคุณไม่เพียงพอสำหรับการโอนครั้งนี้",
        ephemeral: true,
      });

      return;
    }

    console.error(
      "❌ Payment transfer failed:",
      error,
    );

    await interaction.reply({
      content:
        "❌ เกิดข้อผิดพลาดขณะโอนเงิน กรุณาลองใหม่อีกครั้ง",
      ephemeral: true,
    });
  }
}
