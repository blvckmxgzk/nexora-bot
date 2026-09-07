import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  minerShopService,
} from "../../services/nexo/minerShopService.js";

import {
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

import {
  toSuffix,
} from "../../services/nexo/NexoNumber.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "miner-shop",
    )
    .setDescription(
      "NEXO Miner Simulator Shop",
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "view",
          )
          .setDescription(
            "ดู Miner Shop",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "buy",
          )
          .setDescription(
            "ซื้อ Miner Item",
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
          )
          .addIntegerOption(
            (
              o,
            ) =>
              o
                .setName(
                  "quantity",
                )
                .setDescription(
                  "จำนวน",
                )
                .setMinValue(
                  1,
                )
                .setMaxValue(
                  100,
                ),
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
) {
  const sub =
    interaction.options
      .getSubcommand();

  if (
    sub ===
    "view"
  ) {
    const catalog =
      minerShopService
        .getCatalog();

    const lines =
      catalog
        .slice(
          0,
          25,
        )
        .map(
          (
            item,
          ) => {
            const rarity =
              MINER_RARITY_MAP.get(
                item.rarity,
              );

            return `${rarity?.emoji ?? "📦"} **${item.name}**\n> ${rarity?.name} • 💰 ${toSuffix(item.shopPrice!)} NEXO • \`${item.id}\``;
          },
        );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "🛒 NEXO Miner Shop",
          )
          .setDescription(
            lines.join(
              "\n\n",
            ),
          )
          .setFooter({
            text:
              `Showing 25 / ${catalog.length} items`,
          }),
      ],
    });

    return;
  }

  await interaction.deferReply();

  try {
    const result =
      await minerShopService
        .buy(
          interaction.user.id,

          interaction.options
            .getString(
              "item",
              true,
            )
            .trim(),

          interaction.options
            .getInteger(
              "quantity",
            ) ??
            1,
        );

    await interaction.editReply(
      [
        "🛒 **ซื้อสำเร็จ!**",
        "",
        `${result.item.emoji} **${result.item.name} ×${result.quantity}**`,
        `จ่าย: **${toSuffix(result.total)} NEXO**`,
        `เหลือ: **${toSuffix(result.balance)} NEXO**`,
      ].join(
        "\n",
      ),
    );
  } catch (error) {
    await interaction.editReply(
      `❌ ${error instanceof Error ? error.message : "ซื้อไม่สำเร็จ"}`,
    );
  }
}
