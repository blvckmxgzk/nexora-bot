import {
  EmbedBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

import { itemService } from "../../services/itemService.js";

const rarityEmoji: Record<string, string> = {
  common: "⚪",
  uncommon: "🟢",
  rare: "🔵",
  epic: "🟣",
  legendary: "🟡",
};

const typeName: Record<string, string> = {
  consumable: "Consumable",
  collectible: "Collectible",
  utility: "Utility",
  special: "Special",
};

function isAdmin(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (!interaction.inGuild()) {
    return false;
  }

  return (
    interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator,
    ) === true ||
    interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild,
    ) === true
  );
}

function errorEmbed(message: string) {
  return new EmbedBuilder()
    .setColor(0xff4d4d)
    .setTitle("❌ NEXORA Item System")
    .setDescription(message)
    .setTimestamp();
}

export const data = new SlashCommandBuilder()
  .setName("item")
  .setDescription("Manage NEXORA items.")
  .setDefaultMemberPermissions(
    PermissionFlagsBits.ManageGuild.toString(),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("give")
      .setDescription("Give an item to a member.")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Member who will receive the item.")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("item")
          .setDescription("Item ID to give.")
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount of items to give.")
          .setMinValue(1)
          .setMaxValue(100000)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("remove")
      .setDescription("Remove an item from a member.")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Member whose item will be removed.")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("item")
          .setDescription("Item ID to remove.")
          .setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName("amount")
          .setDescription("Amount of items to remove.")
          .setMinValue(1)
          .setMaxValue(100000)
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("info")
      .setDescription("View information about an item.")
      .addStringOption((option) =>
        option
          .setName("item")
          .setDescription("Item ID to inspect.")
          .setRequired(true),
      ),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "คำสั่งนี้สามารถใช้ได้เฉพาะภายในเซิร์ฟเวอร์เท่านั้น",
        ),
      ],
      ephemeral: true,
    });

    return;
  }

  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "info") {
    const itemId =
      interaction.options.getString("item", true).trim();

    const item = await itemService.getItem(itemId);

    if (!item) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `ไม่พบไอเทม \`${itemId}\`\n\nตรวจสอบ Item ID อีกครั้ง`,
          ),
        ],
        ephemeral: true,
      });

      return;
    }

    const rarity =
      rarityEmoji[item.rarity] ?? "⚪";

    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`${item.emoji} ${item.name}`)
      .setDescription(
        item.description || "ไม่มีคำอธิบายสำหรับไอเทมนี้",
      )
      .addFields(
        {
          name: "🆔 Item ID",
          value: `\`${item.itemId}\``,
          inline: true,
        },
        {
          name: "💎 Rarity",
          value: `${rarity} ${item.rarity.charAt(0).toUpperCase()}${item.rarity.slice(1)}`,
          inline: true,
        },
        {
          name: "📦 Type",
          value: typeName[item.type] ?? item.type,
          inline: true,
        },
        {
          name: "📚 Stackable",
          value: item.stackable ? "✅ Yes" : "❌ No",
          inline: true,
        },
        {
          name: "🔄 Tradeable",
          value: item.tradeable ? "✅ Yes" : "❌ No",
          inline: true,
        },
        {
          name: "🛠️ Usable",
          value: item.usable ? "✅ Yes" : "❌ No",
          inline: true,
        },
      )
      .setFooter({
        text: "NEXORA • Item System",
      })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
    });

    return;
  }

  if (!isAdmin(interaction)) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "คุณไม่มีสิทธิ์ใช้คำสั่งนี้\n\n🔐 ต้องมี **Administrator** หรือ **Manage Server**",
        ),
      ],
      ephemeral: true,
    });

    return;
  }

  const target =
    interaction.options.getUser("user", true);

  const itemId =
    interaction.options.getString("item", true).trim();

  const amount =
    interaction.options.getInteger("amount", true);

  if (target.bot) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          "ไม่สามารถจัดการ Inventory ของ Bot ได้",
        ),
      ],
      ephemeral: true,
    });

    return;
  }

  const item = await itemService.getItem(itemId);

  if (!item) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          `ไม่พบไอเทม \`${itemId}\`\n\nตรวจสอบ Item ID อีกครั้ง`,
        ),
      ],
      ephemeral: true,
    });

    return;
  }

  if (subcommand === "give") {
    try {
      await itemService.addItem(
        target.id,
        item.itemId,
        amount,
      );

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("🎁 Item Granted")
        .setDescription(
          `มอบไอเทมให้ <@${target.id}> สำเร็จ!`,
        )
        .addFields(
          {
            name: "📦 Item",
            value: `${item.emoji} **${item.name}**`,
            inline: true,
          },
          {
            name: "🔢 Amount",
            value: `**×${amount.toLocaleString()}**`,
            inline: true,
          },
          {
            name: "🆔 Item ID",
            value: `\`${item.itemId}\``,
            inline: true,
          },
          {
            name: "👤 Recipient",
            value: `<@${target.id}>`,
            inline: true,
          },
          {
            name: "🛡️ Moderator",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
        )
        .setThumbnail(
          target.displayAvatarURL({
            size: 256,
          }),
        )
        .setFooter({
          text: "NEXORA • Item System",
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("❌ Item give failed:", error);

      await interaction.reply({
        embeds: [
          errorEmbed(
            error instanceof Error
              ? error.message
              : "เกิดข้อผิดพลาดขณะมอบไอเทม",
          ),
        ],
        ephemeral: true,
      });
    }

    return;
  }

  if (subcommand === "remove") {
    try {
      await itemService.removeItem(
        target.id,
        item.itemId,
        amount,
      );

      const embed = new EmbedBuilder()
        .setColor(0xffa940)
        .setTitle("🗑️ Item Removed")
        .setDescription(
          `ลบไอเทมจาก <@${target.id}> สำเร็จ!`,
        )
        .addFields(
          {
            name: "📦 Item",
            value: `${item.emoji} **${item.name}**`,
            inline: true,
          },
          {
            name: "🔢 Amount",
            value: `**×${amount.toLocaleString()}**`,
            inline: true,
          },
          {
            name: "🆔 Item ID",
            value: `\`${item.itemId}\``,
            inline: true,
          },
          {
            name: "👤 Member",
            value: `<@${target.id}>`,
            inline: true,
          },
          {
            name: "🛡️ Moderator",
            value: `<@${interaction.user.id}>`,
            inline: true,
          },
        )
        .setThumbnail(
          target.displayAvatarURL({
            size: 256,
          }),
        )
        .setFooter({
          text: "NEXORA • Item System",
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
      });
    } catch (error) {
      console.error("❌ Item remove failed:", error);

      await interaction.reply({
        embeds: [
          errorEmbed(
            error instanceof Error
              ? error.message
              : "เกิดข้อผิดพลาดขณะลบไอเทม",
          ),
        ],
        ephemeral: true,
      });
    }
  }
}
