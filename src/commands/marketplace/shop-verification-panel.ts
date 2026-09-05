import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { env } from "../../config/env.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "shop-verification-panel",
    )
    .setDescription(
      "สร้าง Panel สำหรับยื่นขอ Verified Seller",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString(),
    );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content:
        "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์",
      ephemeral: true,
    });
    return;
  }

  const channel =
    await interaction.client.channels.fetch(
      env.MARKETPLACE_VERIFICATION_PANEL_CHANNEL_ID,
    );

  if (!channel) {
    await interaction.reply({
      content:
        "❌ ไม่พบช่องสำหรับ Panel ยืนยันร้านค้า",
      ephemeral: true,
    });
    return;
  }

  if (
    !channel.isTextBased() ||
    !("send" in channel) ||
    typeof channel.send !== "function"
  ) {
    await interaction.reply({
      content:
        "❌ ช่องสำหรับ Panel ต้องเป็นช่องที่สามารถส่งข้อความได้",
      ephemeral: true,
    });
    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        "🛡️ VERIFIED SELLER",
      )
      .setDescription(
        [
          "## 🏪 ขอ Verified Seller",
          "",
          "ร้านค้าทุกแห่งสามารถยื่นขอ **Verified Seller** เพื่อแสดงตราความน่าเชื่อถือจากทีมงาน NEXORA",
          "",
          "### 🛡️ Verified Seller คืออะไร?",
          "Verified Seller คือสถานะที่แสดงว่า **ทีมงาน NEXORA ได้ตรวจสอบร้านค้าแล้ว**",
          "",
          "⚠️ การได้รับ Verified Seller **ไม่ใช่การรับประกันสินค้า และไม่ใช่การรับประกันว่าผู้ขายจะไม่โกงในอนาคต**",
          "",
          "### 📋 ขั้นตอน",
          "1️⃣ กดปุ่ม **ขอยืนยันร้านค้า**",
          "2️⃣ อ่านกฎ Marketplace",
          "3️⃣ กดยอมรับกฎ",
          "4️⃣ ระบบส่งคำขอให้ทีมงานตรวจสอบ",
          "5️⃣ รอผลการตรวจสอบผ่าน DM",
          "",
          "### ⚠️ โปรดทราบ",
          "• ข้อมูลที่ส่งต้องเป็นความจริง",
          "• ร้านค้าต้องปฏิบัติตามกฎ Marketplace",
          "• ทีมงานสามารถปฏิเสธหรือระงับร้านค้าที่ละเมิดกฎได้",
          "• การยื่นคำขอไม่ได้หมายความว่าจะได้รับการอนุมัติ",
          "",
          "**กดปุ่มด้านล่างเพื่อเริ่มขั้นตอนการยืนยันร้านค้า**",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Seller Verification",
      })
      .setTimestamp();

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_request_verification",
          )
          .setLabel(
            "ขอยืนยันร้านค้า",
          )
          .setEmoji("🛡️")
          .setStyle(
            ButtonStyle.Primary,
          ),
      );

  await channel.send({
    embeds: [embed],
    components: [row],
  });

  await interaction.reply({
    content:
      `✅ สร้าง Panel เรียบร้อยแล้วที่ <#${channel.id}>`,
    ephemeral: true,
  });
}
