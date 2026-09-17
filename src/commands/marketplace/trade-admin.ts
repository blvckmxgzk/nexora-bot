import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import {
  marketplaceV2Service,
} from "../../services/marketplace/marketplaceV2Service.js";

export const data =
  new SlashCommandBuilder()
    .setName(
      "trade-admin",
    )
    .setDescription(
      "จัดการ Marketplace Trade Requests",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits
        .ManageGuild
        .toString(),
    )

    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "open",
          )
          .setDescription(
            "ดู Trade Requests ที่ยังไม่จบ",
          ),
    )

    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "history",
          )
          .setDescription(
            "ดูประวัติ Trade ล่าสุด",
          )
          .addUserOption(
            (
              option,
            ) =>
              option
                .setName(
                  "user",
                )
                .setDescription(
                  "กรองตามสมาชิก",
                )
                .setRequired(
                  false,
                ),
          ),
    )

    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "cancel",
          )
          .setDescription(
            "ยกเลิก Trade Request",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "trade_id",
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
              option,
            ) =>
              option
                .setName(
                  "reason",
                )
                .setDescription(
                  "เหตุผล",
                )
                .setRequired(
                  true,
                ),
          ),
    )

    .addSubcommand(
      (
        subcommand,
      ) =>
        subcommand
          .setName(
            "review-delete",
          )
          .setDescription(
            "ลบ Review ที่ผิดกฎ",
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "review_id",
                )
                .setDescription(
                  "Review ID",
                )
                .setRequired(
                  true,
                ),
          )
          .addStringOption(
            (
              option,
            ) =>
              option
                .setName(
                  "reason",
                )
                .setDescription(
                  "เหตุผล",
                )
                .setRequired(
                  true,
                ),
          ),
    );

export async function execute(
  interaction:
    ChatInputCommandInteraction,
): Promise<void> {
  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  if (
    !interaction.guild ||
    !interaction.memberPermissions
      ?.has(
        PermissionFlagsBits
          .ManageGuild,
      )
  ) {
    await interaction.editReply({
      content:
        "❌ ไม่มีสิทธิ์ใช้งานคำสั่งนี้",
    });

    return;
  }

  try {
    const subcommand =
      interaction.options
        .getSubcommand();

    if (
      subcommand ===
      "open"
    ) {
      const trades =
        await marketplaceV2Service
          .getOpenTrades();

      await interaction.editReply({
        content:
          trades.length ===
          0
            ? "✅ ไม่มี Trade Request ที่เปิดอยู่"
            : [
                "🛒 **Open Trade Requests**",
                "",
                ...trades.map(
                  (
                    trade,
                  ) =>
                    [
                      `\`${trade.requestId}\``,
                      `**${trade.productName}**`,
                      `<@${trade.buyerId}> → <@${trade.sellerId}>`,
                      `**${trade.status}**`,
                    ].join(
                      " • ",
                    ),
                ),
              ].join(
                "\n",
              ),
      });

      return;
    }

    if (
      subcommand ===
      "history"
    ) {
      const user =
        interaction.options
          .getUser(
            "user",
          );

      const trades =
        await marketplaceV2Service
          .getHistory(
            user?.id,
          );

      await interaction.editReply({
        content:
          trades.length ===
          0
            ? "ไม่มีประวัติ Trade"
            : [
                "📜 **Trade History**",
                "",
                ...trades.map(
                  (
                    trade,
                  ) =>
                    [
                      `\`${trade.requestId}\``,
                      `**${trade.productName}**`,
                      `<@${trade.buyerId}> → <@${trade.sellerId}>`,
                      `**${trade.status}**`,
                    ].join(
                      " • ",
                    ),
                ),
              ].join(
                "\n",
              ),
      });

      return;
    }

    if (
      subcommand ===
      "cancel"
    ) {
      const tradeId =
        interaction.options
          .getString(
            "trade_id",
            true,
          );

      const reason =
        interaction.options
          .getString(
            "reason",
            true,
          )
          .trim();

      await marketplaceV2Service
        .adminCancel(
          interaction.client,
          tradeId,
          interaction.user.id,
          reason,
        );

      await interaction.editReply({
        content:
          `✅ Staff ยกเลิก Trade \`${tradeId}\` แล้ว`,
      });

      return;
    }

    if (
      subcommand ===
      "review-delete"
    ) {
      const reviewId =
        interaction.options
          .getString(
            "review_id",
            true,
          );

      const reason =
        interaction.options
          .getString(
            "reason",
            true,
          )
          .trim();

      await marketplaceV2Service
        .deleteReview(
          interaction.client,
          reviewId,
          interaction.user.id,
          reason,
        );

      await interaction.editReply({
        content:
          `✅ ลบ Review \`${reviewId}\` แล้ว`,
      });

      return;
    }
  } catch (
    error
  ) {
    await interaction.editReply({
      content:
        `❌ ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
