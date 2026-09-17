import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  MinerInventoryItem,
} from "../../models/MinerInventoryItem.js";

import {
  MINER_ITEM_MAP,
} from "../../game/nexoMiner/itemCatalog.js";

import {
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

import {
  minerBoostService,
} from "../../services/nexo/minerBoostService.js";

import {
  toSuffix,
} from "../../services/nexo/NexoNumber.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "miner-item",
    )
    .setDescription(
      "จัดการ Miner Items",
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "inventory",
          )
          .setDescription(
            "ดู Miner Items",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "use",
          )
          .setDescription(
            "ใช้ Item",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "item",
                )
                .setDescription(
                  "Item ID",
                )
                .setRequired(
                  true,
                ),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "boosts",
          )
          .setDescription(
            "ดู Boost ที่ทำงานอยู่",
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
) {
  const sub =
    interaction.options
      .getSubcommand();

  const userId =
    interaction.user.id;

  if (
    sub ===
    "inventory"
  ) {
    const inventory =
      await MinerInventoryItem
        .find({
          discordId:
            userId,

          quantity: {
            $gt:
              0,
          },
        });

    if (
      inventory.length ===
      0
    ) {
      await interaction.reply({
        content:
          "🎒 ยังไม่มี Miner Item",

        ephemeral:
          true,
      });

      return;
    }

    const lines =
      inventory.map(
        (
          entry,
        ) => {
          const item =
            MINER_ITEM_MAP.get(
              entry.itemId,
            );

          const rarity =
            item
              ? MINER_RARITY_MAP
                  .get(
                    item.rarity,
                  )
              : null;

          return `${item?.emoji ?? "📦"} **${item?.name ?? entry.itemId} ×${toSuffix(String(entry.quantity))}**\n> ${rarity?.emoji ?? ""} ${rarity?.name ?? "Unknown"} • 💎 ${item ? toSuffix(item.netWorth) : "?"} • \`${entry.itemId}\``;
        },
      );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🎒 Miner Items",
          )
          .setDescription(
            lines.join(
              "\n\n",
            ),
          ),
      ],
    });

    return;
  }

  if (
    sub ===
    "boosts"
  ) {
    const boosts =
      await minerBoostService
        .getActive(
          userId,
        );

    if (
      boosts.length ===
      0
    ) {
      await interaction.reply({
        content:
          "🧪 ไม่มี Boost ที่กำลังทำงาน",

        ephemeral:
          true,
      });

      return;
    }

    const lines =
      boosts.map(
        (
          boost,
        ) => {
          const seconds =
            Math.max(
              0,

              Math.floor(
                (
                  boost
                    .expiresAt
                    .getTime() -
                  Date.now()
                ) /
                1000,
              ),
            );

          return `🧪 **${boost.stat.toUpperCase()} ×${toSuffix(boost.multiplier)}** — <t:${Math.floor(boost.expiresAt.getTime() / 1000)}:R>\n> ${toSuffix(String(seconds))}s remaining`;
        },
      );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🧪 Active Miner Boosts",
          )
          .setDescription(
            lines.join(
              "\n\n",
            ),
          ),
      ],
    });

    return;
  }

  await interaction.deferReply({
    ephemeral:
      true,
  });

  try {
    const result =
      await minerBoostService
        .useItem(
          userId,

          interaction.options
            .getString(
              "item",
              true,
            )
            .trim(),
        );

    if (
      result.type ===
      "boost"
    ) {
      await interaction.editReply(
        `🧪 Boost เปิดแล้ว: **${result.stat.toUpperCase()} ×${toSuffix(result.multiplier)}**`,
      );

      return;
    }

    await interaction.editReply(
      result.permanent
        ? "♾️ **Permanent Infinite Bag เปิดใช้งานแล้ว!**"
        : `♾️ **Infinite Bag เปิดแล้ว** — <t:${Math.floor(result.expiresAt.getTime() / 1000)}:R>`,
    );
  } catch (error) {
    await interaction.editReply(
      `❌ ${error instanceof Error ? error.message : "ใช้ Item ไม่สำเร็จ"}`,
    );
  }
}
