import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

export const data =
  new SlashCommandBuilder()
    .setName("shop-panel")
    .setDescription("Post the NEXORA Marketplace panel.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString(),
    );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle("🏪 NEXORA MARKETPLACE")
      .setDescription(
        [
          "**ศูนย์กลางซื้อขายสินค้าและบริการดิจิทัลของ NEXORA**",
          "",
          "🎮 Game Top-up",
          "🔑 Game Keys",
          "🎁 Gift Cards",
          "🛠️ Digital Services",
          "",
          "สมาชิกสามารถเปิดร้านของตัวเองและสร้างสินค้าเพื่อขายได้",
          "",
          "**📌 เมนูสำหรับสมาชิก**",
          "",
          "🏪 **เปิดร้านค้า**",
          "└─ สร้างร้านค้าของคุณและเริ่มต้นเป็นผู้ขาย",
          "",
          "🛍️ **ดูร้านค้า**",
          "└─ เลือกดูร้านค้าและสินค้าต่าง ๆ ใน Marketplace",
          "",
          "📦 **คำสั่งซื้อของฉัน**",
          "└─ ตรวจสอบและติดตามคำสั่งซื้อของคุณ",
          "",
          "⚙️ **จัดการร้านค้า**",
          "└─ จัดการร้าน สินค้า การตั้งค่า และข้อมูลของร้านคุณ",
          "",
          "🛡️ **Verified Seller**",
          "สถานะ Verified มีไว้เพื่อแสดงว่าร้านผ่านการตรวจสอบจากทีมงาน NEXORA",
          "ไม่ได้เป็นเงื่อนไขในการเปิดร้านหรือเพิ่มสินค้า",
        ].join("\n"),
      )
      .setFooter({
        text: "NEXORA Marketplace • ซื้อขายอย่างเป็นระบบ",
      })
      .setTimestamp();

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId("nexora_shop_open")
          .setLabel("เปิดร้านค้า")
          .setEmoji("🏪")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("nexora_shop_browse")
          .setLabel("ดูร้านค้า")
          .setEmoji("🛍️")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("nexora_shop_orders")
          .setLabel("คำสั่งซื้อของฉัน")
          .setEmoji("📦")
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId("nexora_shop_manage")
          .setLabel("จัดการร้านค้า")
          .setEmoji("⚙️")
          .setStyle(ButtonStyle.Secondary),
      );

  await interaction.reply({
    embeds: [embed],
    components: [row],
  });
}
