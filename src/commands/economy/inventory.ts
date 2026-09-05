import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import {
  itemService,
} from "../../services/itemService.js";

const rarityEmoji: Record<
  string,
  string
> = {
  common: "⚪",
  uncommon: "🟢",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
};

export const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription(
    "View your NEXORA inventory.",
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const inventory =
    await itemService.getInventory(
      interaction.user.id,
    );

  if (inventory.length === 0) {
    const embed =
      new EmbedBuilder()
        .setTitle("🎒 NEXORA Inventory")
        .setDescription(
          "กระเป๋าของคุณยังว่างอยู่\n\nลองเข้าร่วมกิจกรรมหรือรับไอเทมจากระบบต่าง ๆ ของ NEXORA!",
        )
        .setThumbnail(
          interaction.user.displayAvatarURL(),
        )
        .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });

    return;
  }

  const items = inventory
    .map(
      ({ item, quantity }) => {
        const rarity =
          rarityEmoji[
            item.rarity
          ] ?? "⚪";

        return [
          `${item.emoji} **${item.name}** × ${quantity}`,
          `> ${rarity} ${item.rarity} • ${item.description || "ไม่มีคำอธิบาย"}`,
        ].join("\n");
      },
    )
    .join("\n\n");

  const embed =
    new EmbedBuilder()
      .setTitle("🎒 NEXORA Inventory")
      .setDescription(items)
      .setThumbnail(
        interaction.user.displayAvatarURL(),
      )
      .setFooter({
        text: `${inventory.length} item type(s)`,
      })
      .setTimestamp();

  await interaction.reply({
    embeds: [embed],
  });
}
