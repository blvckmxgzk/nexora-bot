import {
  type ButtonInteraction,
} from "discord.js";

export const customId =
  "nexora_shop_verification_cancel";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.update({
    content:
      "❌ ยกเลิกการยื่นขอ Verified Seller แล้ว",
    embeds: [],
    components: [],
  });
}
