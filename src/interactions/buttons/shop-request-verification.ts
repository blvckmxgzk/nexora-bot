import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import {
  shopVerificationService,
} from "../../services/shopVerificationService.js";

export const customId =
  "nexora_shop_request_verification";

const RULES_VERSION = "1.0";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId: interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ คุณยังไม่มีร้านค้า",
      ephemeral: true,
    });
    return;
  }

  if (shop.status === "verified") {
    await interaction.reply({
      content:
        "🟢 ร้านค้าของคุณได้รับ Verified Seller แล้ว",
      ephemeral: true,
    });
    return;
  }

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.reply({
      content:
        shop.status === "closed"
          ? "🔒 กรุณาเปิดร้านก่อนยื่นขอ Verified Seller"
          : "🚫 ร้านค้าของคุณถูกระงับและไม่สามารถยื่นขอ Verified Seller ได้",
      ephemeral: true,
    });
    return;
  }

  const pending =
    await shopVerificationService
      .getPendingByShopId(
        shop.shopId,
      );

  if (pending) {
    await interaction.reply({
      content:
        "⏳ ร้านของคุณมีคำขอที่กำลังรอทีมงานตรวจสอบอยู่แล้ว",
      ephemeral: true,
    });
    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle(
        "🛡️ ขอ Verified Seller",
      )
      .setDescription(
        [
          `คุณกำลังยื่นขอ Verified Seller สำหรับร้าน **${shop.name}**`,
          "",
          "ก่อนยื่นคำขอ กรุณาอ่านกฎการขายของ NEXORA Marketplace ให้ครบถ้วน",
          "",
          "### 📜 กฎสำคัญ",
          "• ห้ามหลอกลวงหรือฉ้อโกงผู้ซื้อ",
          "• ห้ามขายสินค้าผิดกฎหมายหรือสินค้าที่ได้มาโดยมิชอบ",
          "• รายละเอียดสินค้าและราคาต้องตรงกับสินค้าจริง",
          "• ต้องส่งมอบสินค้าตามที่ระบุไว้",
          "• ห้ามสร้างรีวิวหรือธุรกรรมปลอม",
          "• ห้ามใช้ Marketplace เพื่อโจมตี หลอก หรือเอาเปรียบสมาชิก",
          "• ต้องปฏิบัติตามคำสั่งและการตัดสินของทีมงาน NEXORA",
          "",
          "### 🛡️ Verified Seller คืออะไร?",
          "Verified Seller เป็น **ตราความน่าเชื่อถือ** ที่แสดงว่าทีมงานได้ตรวจสอบร้านแล้ว",
          "",
          "⚠️ Verified Seller **ไม่ใช่การรับประกันสินค้าและไม่ใช่การรับประกันว่าผู้ขายจะไม่โกงในอนาคต**",
          "",
          "### ⚠️ การละเมิดกฎ",
          "ทีมงานสามารถปฏิเสธ ระงับ หรือดำเนินการกับร้านค้าที่ละเมิดกฎได้",
          "",
          `📌 Rules Version: **${RULES_VERSION}**`,
          "",
          "**เมื่อกด “ยอมรับและยื่นคำขอ” ถือว่าคุณได้อ่านและยอมรับกฎทั้งหมดแล้ว**",
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
            "nexora_shop_verification_accept",
          )
          .setLabel(
            "ยอมรับและยื่นคำขอ",
          )
          .setEmoji("✅")
          .setStyle(
            ButtonStyle.Success,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_verification_cancel",
          )
          .setLabel("ยกเลิก")
          .setEmoji("❌")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  await interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}
