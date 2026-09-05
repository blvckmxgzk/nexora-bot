import {
  type ButtonInteraction,
} from "discord.js";

import { shopDraftService } from "../../services/shopDraftService.js";

export const customId = "nexora_shop_cancel";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  shopDraftService.delete(
    interaction.user.id,
  );

  await interaction.update({
    content:
      "❌ ยกเลิกการเปิดร้านค้าแล้ว",
    embeds: [],
    components: [],
  });
}
