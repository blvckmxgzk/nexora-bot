import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  minerPickaxeService,
} from "../../services/nexo/minerPickaxeService.js";

import {
  PICKAXE_MAP,
} from "../../game/nexoMiner/pickaxeCatalog.js";

import {
  MINER_RARITY_MAP,
} from "../../game/nexoMiner/rarityCatalog.js";

import {
  toSuffix,
} from "../../services/nexo/NexoNumber.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "pickaxe",
    )
    .setDescription(
      "จัดการ Pickaxe",
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
            "ดู Pickaxe ทั้งหมด",
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "equip",
          )
          .setDescription(
            "Equip Pickaxe",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "id",
                )
                .setDescription(
                  "Pickaxe Instance ID",
                )
                .setRequired(
                  true,
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

  const userId =
    interaction.user.id;

  if (
    sub ===
    "inventory"
  ) {
    const pickaxes =
      await minerPickaxeService
        .list(
          userId,
        );

    const lines =
      pickaxes.map(
        (
          pickaxe,
        ) => {
          const definition =
            PICKAXE_MAP.get(
              pickaxe
                .definitionId,
            );

          const rarity =
            MINER_RARITY_MAP.get(
              pickaxe.rarity as
                any,
            );

          return [
            `${pickaxe.equipped ? "✅" : "⛏️"} ${rarity?.emoji ?? ""} **${definition?.name ?? pickaxe.definitionId}**`,
            `> ${rarity?.name} • Power Lv.${toSuffix(String(pickaxe.powerLevel))} • Luck Lv.${toSuffix(String(pickaxe.luckLevel))}`,
            `> 💎 ${toSuffix(pickaxe.baseNetWorth)} • \`${pickaxe.pickaxeInstanceId}\``,
          ].join(
            "\n",
          );
        },
      );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            "⛏️ Pickaxe Collection",
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
    const pickaxe =
      await minerPickaxeService
        .equip(
          userId,

          interaction.options
            .getString(
              "id",
              true,
            )
            .trim(),
        );

    const definition =
      PICKAXE_MAP.get(
        pickaxe.definitionId,
      );

    await interaction.editReply(
      `✅ Equip **${definition?.name ?? pickaxe.definitionId}** แล้ว`,
    );
  } catch (error) {
    await interaction.editReply(
      `❌ ${error instanceof Error ? error.message : "Equip ไม่สำเร็จ"}`,
    );
  }
}
