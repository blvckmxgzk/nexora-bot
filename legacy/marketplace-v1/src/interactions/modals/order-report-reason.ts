import {
  EmbedBuilder,
  type ModalSubmitInteraction,
} from "discord.js";

import {
  reportService,
} from "../../services/reportService.js";

import {
  getMarketplaceDiscordClient,
} from "../../services/marketplace/marketplaceNotificationService.js";

export const customId =
  "nexora_order_report_reason:";

export async function execute(
  interaction: ModalSubmitInteraction,
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

  const reason =
    interaction.fields
      .getTextInputValue(
        "report_reason",
      )
      .trim();

  if (reason.length < 10) {
    await interaction.reply({
      content:
        "❌ กรุณาระบุรายละเอียดอย่างน้อย 10 ตัวอักษร",
      ephemeral: true,
    });
    return;
  }

  try {
    const report =
      await reportService.createScamReport(
        orderId,
        interaction.user.id,
        reason,
      );

    const client =
      getMarketplaceDiscordClient();

    /*
     * แจ้ง Server Owner
     *
     * env ของโปรเจกต์นี้มี DISCORD_GUILD_ID
     * อยู่ใน env.ts แล้ว ดังนั้นใช้ process.env
     * หลังจากตรวจสอบค่าอีกครั้งเพื่อให้ TypeScript
     * มองเป็น string แน่นอน
     */
    const guildId =
      process.env.DISCORD_GUILD_ID;

    if (!guildId) {
      throw new Error(
        "Missing environment variable: DISCORD_GUILD_ID",
      );
    }

    try {
      const guild =
        await client.guilds.fetch(
          guildId,
        );

      const owner =
        await guild.fetchOwner();

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🚨 NEXORA Scam Report",
          )
          .setDescription(
            "มีสมาชิกส่งรายงานเกี่ยวกับ Marketplace",
          )
          .addFields(
            {
              name:
                "🆔 Report ID",
              value:
                `\`${report.reportId}\``,
              inline: true,
            },
            {
              name:
                "🧾 Order ID",
              value:
                `\`${report.orderId}\``,
              inline: true,
            },
            {
              name:
                "👤 Buyer",
              value:
                `<@${report.buyerId}>`,
              inline: true,
            },
            {
              name:
                "🏪 Seller",
              value:
                `<@${report.sellerId}>`,
              inline: true,
            },
            {
              name:
                "📝 รายละเอียด",
              value:
                reason,
            },
          )
          .setTimestamp()
          .setFooter({
            text:
              "NEXORA Marketplace • Admin Investigation",
          });

      await owner.send({
        embeds: [embed],
      });
    } catch (adminError) {
      /*
       * การส่งแจ้ง Admin ล้มเหลว
       * ไม่ควรทำให้ Report ที่บันทึกลง MongoDB
       * กลายเป็นล้มเหลว
       */
      console.error(
        "⚠️ Failed to notify server owner about report:",
        adminError,
      );
    }

    await interaction.reply({
      content:
        [
          "🚨 **ส่ง Report แล้ว**",
          "",
          `Report ID: \`${report.reportId}\``,
          `Order ID: \`${report.orderId}\``,
          "",
          "ทีมงานได้รับเรื่องแล้วและจะตรวจสอบต่อไป",
          "กรุณาเก็บหลักฐาน เช่น รูปแชต สลิป หรือข้อมูลการส่งมอบสินค้าไว้ด้วย",
        ].join("\n"),
      ephemeral: true,
    });
  } catch (error) {
    console.error(
      "❌ Failed to create scam report:",
      error,
    );

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction.editReply({
        content:
          error instanceof Error
            ? `❌ ${error.message}`
            : "❌ ไม่สามารถส่ง Report ได้",
      });
      return;
    }

    await interaction.reply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ ไม่สามารถส่ง Report ได้",
      ephemeral: true,
    });
  }
}
