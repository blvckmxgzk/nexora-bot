import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  minerTradeService,
} from "../../services/nexo/minerTradeService.js";

import {
  toSuffix,
} from "../../services/nexo/NexoNumber.js";

function sideLines(
  side:
    any,

  value:
    any,
) {
  const lines = [
    `💰 NEXO: **${toSuffix(side.nexo)}**`,
  ];

  for (
    const item
    of side.items
  ) {
    lines.push(
      `📦 ${item.itemId} ×${toSuffix(String(item.quantity))} — ${toSuffix(item.netWorth)} each`,
    );
  }

  for (
    const ore
    of side.ores
  ) {
    lines.push(
      `⛏️ ${ore.definitionId} — ${toSuffix(ore.totalWeight)}kg — 💎 ${toSuffix(ore.totalNetWorth)}`,
    );
  }

  for (
    const pickaxe
    of side.pickaxes
  ) {
    lines.push(
      `⛏️ ${pickaxe.definitionId} — 💎 ${toSuffix(pickaxe.netWorth)} — \`${pickaxe.pickaxeInstanceId}\``,
    );
  }

  lines.push(
    "",
    `💎 **Total: ${value.toSuffix()}**`,
    side.confirmedAt
      ? "✅ Confirmed"
      : "⌛ Not confirmed",
  );

  return lines.join(
    "\n",
  );
}

export const data =
  new SlashCommandBuilder()
    .setName(
      "trade",
    )
    .setDescription(
      "NEXO Miner Trading",
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "create",
          )
          .setDescription(
            "สร้าง Trade",
          )
          .addUserOption(
            (
              o,
            ) =>
              o
                .setName(
                  "user",
                )
                .setDescription(
                  "ผู้เล่นที่ต้องการ Trade",
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
            "view",
          )
          .setDescription(
            "ดู Trade",
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
                  "Trade ID",
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
            "offer-nexo",
          )
          .setDescription(
            "ตั้งจำนวน NEXO ที่เสนอ",
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
                  "Trade ID",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName(
                  "amount",
                )
                .setDescription(
                  "จำนวน เช่น 1000000 หรือ 1e6",
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
            "offer-item",
          )
          .setDescription(
            "เสนอ Miner Item",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("id")
                .setDescription("Trade ID")
                .setRequired(true),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("item")
                .setDescription("Item ID")
                .setRequired(true),
          )
          .addIntegerOption(
            (
              o,
            ) =>
              o
                .setName("quantity")
                .setDescription("จำนวน")
                .setRequired(true)
                .setMinValue(1),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "offer-ore",
          )
          .setDescription(
            "เสนอ Ore stack ทั้งกอง",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("id")
                .setDescription("Trade ID")
                .setRequired(true),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("ore")
                .setDescription("Ore ID")
                .setRequired(true),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "offer-pickaxe",
          )
          .setDescription(
            "เสนอ Pickaxe",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("id")
                .setDescription("Trade ID")
                .setRequired(true),
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("pickaxe")
                .setDescription("Pickaxe Instance ID")
                .setRequired(true),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "clear",
          )
          .setDescription(
            "ล้าง Offer ของคุณ",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("id")
                .setDescription("Trade ID")
                .setRequired(true),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "confirm",
          )
          .setDescription(
            "Confirm Trade",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("id")
                .setDescription("Trade ID")
                .setRequired(true),
          ),
    )
    .addSubcommand(
      (
        c,
      ) =>
        c
          .setName(
            "cancel",
          )
          .setDescription(
            "ยกเลิก Trade",
          )
          .addStringOption(
            (
              o,
            ) =>
              o
                .setName("id")
                .setDescription("Trade ID")
                .setRequired(true),
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
) {
  if (
    !interaction.inGuild()
  ) {
    await interaction.reply({
      content:
        "❌ Trade ใช้ได้เฉพาะใน NEXORA",

      ephemeral:
        true,
    });

    return;
  }

  const sub =
    interaction.options
      .getSubcommand();

  const userId =
    interaction.user.id;

  await interaction.deferReply({
    ephemeral:
      true,
  });

  try {
    if (
      sub ===
      "create"
    ) {
      const user =
        interaction.options
          .getUser(
            "user",
            true,
          );

      if (user.bot) {
        throw new Error(
          "ไม่สามารถ Trade กับ Bot",
        );
      }

      const trade =
        await minerTradeService
          .create(
            interaction.guildId!,
            userId,
            user.id,
          );

      await interaction.editReply(
        [
          "🤝 **สร้าง Trade แล้ว**",
          "",
          `Trade ID: \`${trade.tradeId}\``,
          `กับ: <@${user.id}>`,
          "หมดอายุใน **30 นาที**",
          "",
          "ทั้งสองฝ่ายเพิ่ม Offer แล้วใช้ `/trade confirm`",
          "ระบบจะยอมรับเฉพาะดีลที่ต่างกันไม่เกิน **10%**",
        ].join(
          "\n",
        ),
      );

      return;
    }

    const tradeId =
      interaction.options
        .getString(
          "id",
          true,
        )
        .trim();

    if (
      sub ===
      "view"
    ) {
      const result =
        await minerTradeService
          .get(
            tradeId,
            userId,
          );

      const {
        trade,
        sideAValue,
        sideBValue,
      } =
        result;

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              `🤝 Trade ${trade.tradeId}`,
            )
            .addFields(
              {
                name:
                  `🅰️ <@${trade.sideA.userId}>`,

                value:
                  sideLines(
                    trade.sideA,
                    sideAValue,
                  ),
              },
              {
                name:
                  `🅱️ <@${trade.sideB.userId}>`,

                value:
                  sideLines(
                    trade.sideB,
                    sideBValue,
                  ),
              },
            )
            .setFooter({
              text:
                `Status: ${trade.status} • Fairness limit ±10%`,
            }),
        ],
      });

      return;
    }

    if (
      sub ===
      "offer-nexo"
    ) {
      await minerTradeService
        .offerNexo(
          tradeId,
          userId,
          interaction.options
            .getString(
              "amount",
              true,
            )
            .trim(),
        );

      await interaction.editReply(
        "💰 NEXO offer อัปเดตแล้ว และ Confirm ทั้งสองฝ่ายถูก reset",
      );

      return;
    }

    if (
      sub ===
      "offer-item"
    ) {
      await minerTradeService
        .offerItem(
          tradeId,
          userId,
          interaction.options
            .getString(
              "item",
              true,
            )
            .trim(),

          interaction.options
            .getInteger(
              "quantity",
              true,
            ),
        );

      await interaction.editReply(
        "📦 Item ถูกล็อกเข้า Trade แล้ว",
      );

      return;
    }

    if (
      sub ===
      "offer-ore"
    ) {
      await minerTradeService
        .offerOre(
          tradeId,
          userId,
          interaction.options
            .getString(
              "ore",
              true,
            )
            .trim()
            .toLowerCase(),
        );

      await interaction.editReply(
        "⛏️ Ore stack ถูกล็อกเข้า Trade แล้ว",
      );

      return;
    }

    if (
      sub ===
      "offer-pickaxe"
    ) {
      await minerTradeService
        .offerPickaxe(
          tradeId,
          userId,
          interaction.options
            .getString(
              "pickaxe",
              true,
            )
            .trim(),
        );

      await interaction.editReply(
        "⛏️ Pickaxe ถูกล็อกเข้า Trade แล้ว",
      );

      return;
    }

    if (
      sub ===
      "clear"
    ) {
      await minerTradeService
        .clear(
          tradeId,
          userId,
        );

      await interaction.editReply(
        "🧹 Offer ของคุณถูกล้างและปลด Asset lock แล้ว",
      );

      return;
    }

    if (
      sub ===
      "cancel"
    ) {
      await minerTradeService
        .cancel(
          tradeId,
          userId,
        );

      await interaction.editReply(
        "❌ Trade ถูกยกเลิกและปลด Asset lock แล้ว",
      );

      return;
    }

    const result =
      await minerTradeService
        .confirm(
          tradeId,
          userId,
        );

    await interaction.editReply(
      result.completed
        ? "✅ **TRADE COMPLETED!** ทรัพย์สินถูกแลกเปลี่ยนเรียบร้อยแล้ว"
        : "✅ Confirm แล้ว — รออีกฝ่าย Confirm",
    );
  } catch (error) {
    await interaction.editReply(
      `❌ ${error instanceof Error ? error.message : "Trade operation failed"}`,
    );
  }
}
