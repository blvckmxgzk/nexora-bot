import { type ButtonInteraction } from "discord.js";
import { entrySecurityService } from "../../services/community/entrySecurityService.js";

export const customId = "nexora_entry_verify";

export async function execute(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) return;

  await interaction.deferReply({ ephemeral: true });
  const result = await entrySecurityService.requestVerification(
    interaction.guild,
    interaction.user,
  );

  if (result.status === "already_verified") {
    await interaction.editReply({
      content: "✅ บัญชีของคุณผ่าน Verification อยู่แล้ว",
    });
    return;
  }

  if (result.status === "approved") {
    await interaction.editReply({
      content: "✅ **Verification ผ่านแล้ว**\nยินดีต้อนรับเข้าสู่ NEXORA",
    });
    return;
  }

  await interaction.editReply({
    content: [
      "🕵️ **ส่ง Verification Request แล้ว**",
      "",
      `Account age: **${result.age.toFixed(1)} ชั่วโมง**`,
      `Risk: **${result.risk.toUpperCase()}**`,
      "",
      "บัญชีของคุณจะอยู่ใน Quarantine จนกว่าทีมงานจะตรวจสอบ",
      "NEXORA จะไม่ขอ Password, OTP, Token หรือ Cookie จากคุณ",
    ].join("\n"),
  });
}
