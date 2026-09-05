import {
  type ButtonInteraction,
} from "discord.js";

export const customId =
  "nexora_product_delete_cancel";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.update({
    content:
      "↩️ ยกเลิกการลบสินค้าแล้ว",
    components: [],
  });
}
