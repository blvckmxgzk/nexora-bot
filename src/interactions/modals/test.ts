import {
  type ModalSubmitInteraction,
} from "discord.js";

export const customId = "nexora_test_modal";

export async function execute(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const message =
    interaction.fields.getTextInputValue(
      "nexora_test_input",
    );

  await interaction.reply({
    content: `✅ ได้รับข้อความแล้ว:\n> ${message}`,
    ephemeral: true,
  });
}
