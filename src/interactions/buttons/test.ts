import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ButtonInteraction,
} from "discord.js";

export const customId = "nexora_test_button";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const selectMenu =
    new StringSelectMenuBuilder()
      .setCustomId("nexora_test_select")
      .setPlaceholder("เลือกเมนูทดสอบ")
      .addOptions([
        {
          label: "ตัวเลือกที่ 1",
          description: "ทดสอบ Select Menu",
          value: "option_1",
          emoji: "🟢",
        },
        {
          label: "ตัวเลือกที่ 2",
          description: "ทดสอบอีกหนึ่งตัวเลือก",
          value: "option_2",
          emoji: "🔵",
        },
        {
          label: "ตัวเลือกที่ 3",
          description: "ทดสอบตัวเลือกสุดท้าย",
          value: "option_3",
          emoji: "🟣",
        },
      ]);

  const selectRow =
    new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

  const modalButton =
    new ButtonBuilder()
      .setCustomId("nexora_open_modal")
      .setLabel("เปิด Modal")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Secondary);

  const buttonRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(modalButton);

  await interaction.reply({
    content:
      "🎛️ **NEXORA Interaction Test**\n\nเลือกตัวเลือกจากเมนู หรือเปิด Modal เพื่อทดสอบระบบ",
    components: [
      selectRow,
      buttonRow,
    ],
    ephemeral: true,
  });
}
