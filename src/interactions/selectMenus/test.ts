import {
  type StringSelectMenuInteraction,
} from "discord.js";

export const customId = "nexora_test_select";

export async function execute(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const selected =
    interaction.values[0] ?? "ไม่มีข้อมูล";

  await interaction.reply({
    content: `✅ เลือกสำเร็จ: **${selected}**`,
    ephemeral: true,
  });
}
