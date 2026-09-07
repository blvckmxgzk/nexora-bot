import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "pay",
    )
    .setDescription(
      "Direct NEXO transfer status.",
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  await interaction.reply({
    content: [
      "🔒 **Direct NEXO Transfer ถูกปิดแล้ว**",
      "",
      "เพื่อป้องกันการแจกเงินฟรี, Alt Farming และการโยกทรัพย์สินแบบไม่สมดุล",
      "การแลก NEXO / Ore / Pickaxe / Item ระหว่างสมาชิกจะต้องผ่าน **NEXO Trade System** เท่านั้น",
      "",
      "Trade จะอนุญาตส่วนต่างมูลค่าได้สูงสุด **10%**",
    ].join(
      "\n",
    ),

    ephemeral:
      true,
  });
}
