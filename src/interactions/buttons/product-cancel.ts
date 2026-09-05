import {
  type ButtonInteraction,
} from "discord.js";

import { productDraftService } from "../../services/productDraftService.js";

export const customId =
  "nexora_product_cancel";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  productDraftService.delete(
    interaction.user.id,
  );

  await interaction.update({
    content:
      "❌ **ยกเลิกการเพิ่มสินค้าแล้ว**",
    embeds: [],
    components: [],
  });
}
