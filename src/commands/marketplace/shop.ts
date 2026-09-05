import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { env } from "../../config/env.js";
import { Shop } from "../../models/Shop.js";
import { updateShopForum } from "../../services/shopForumService.js";
import {
  shopNotificationService,
} from "../../services/shopNotificationService.js";

export const data =
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription(
      "จัดการร้านค้า NEXORA Marketplace",
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString(),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("pending")
        .setDescription(
          "ดูร้านค้าที่รอการตรวจสอบ",
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("suspend")
        .setDescription(
          "ระงับร้านค้า",
        )
        .addStringOption((option) =>
          option
            .setName("shop_id")
            .setDescription(
              "Shop ID",
            )
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription(
              "เหตุผลที่ระงับร้านค้า",
            )
            .setRequired(true),
        ),
    );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({
      content:
        "❌ คำสั่งนี้ใช้ได้เฉพาะในเซิร์ฟเวอร์",
      ephemeral: true,
    });
    return;
  }

  if (
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.Administrator,
    ) &&
    !interaction.memberPermissions?.has(
      PermissionFlagsBits.ManageGuild,
    )
  ) {
    await interaction.reply({
      content:
        "❌ คุณไม่มีสิทธิ์จัดการร้านค้า",
      ephemeral: true,
    });
    return;
  }

  const subcommand =
    interaction.options.getSubcommand();

  /*
   * /shop pending
   */

  if (subcommand === "pending") {
    const shops =
      await Shop.find({
        status: "pending",
      })
        .sort({
          createdAt: 1,
        })
        .limit(20);

    if (shops.length === 0) {
      await interaction.reply({
        content:
          "✅ ไม่มีร้านค้าที่รอการตรวจสอบ",
        ephemeral: true,
      });
      return;
    }

    const lines =
      shops.map(
        (shop) =>
          [
            `🏪 **${shop.name}**`,
            `🆔 \`${shop.shopId}\``,
            `👤 <@${shop.ownerId}>`,
            `📂 ${shop.category}`,
          ].join(" • "),
      );

    await interaction.reply({
      content:
        "🟡 **ร้านค้าที่รอการตรวจสอบ**\n\n" +
        lines.join("\n"),
      ephemeral: true,
    });

    return;
  }

  /*
   * /shop suspend
   */

  if (subcommand === "suspend") {
    const shopId =
      interaction.options.getString(
        "shop_id",
        true,
      );

    const reason =
      interaction.options.getString(
        "reason",
        true,
      ).trim();

    if (reason.length < 5) {
      await interaction.reply({
        content:
          "❌ เหตุผลต้องมีอย่างน้อย 5 ตัวอักษร",
        ephemeral: true,
      });
      return;
    }

    const shop =
      await Shop.findOne({
        shopId,
      });

    if (!shop) {
      await interaction.reply({
        content:
          "❌ ไม่พบร้านค้านี้",
        ephemeral: true,
      });
      return;
    }

    if (shop.status === "suspended") {
      await interaction.reply({
        content:
          "🚫 ร้านค้านี้ถูกระงับอยู่แล้ว",
        ephemeral: true,
      });
      return;
    }

    if (shop.status === "closed") {
      await interaction.reply({
        content:
          "🔒 ร้านค้านี้ปิดชั่วคราวอยู่ ไม่สามารถระงับซ้ำได้",
        ephemeral: true,
      });
      return;
    }

    if (shop.status === "rejected") {
      await interaction.reply({
        content:
          "🔴 ร้านค้านี้ถูกปฏิเสธอยู่แล้ว",
        ephemeral: true,
      });
      return;
    }

    shop.status = "suspended";

    await shop.save();

    try {
      await updateShopForum(
        interaction.client,
        shop.shopId,
      );
    } catch (error) {
      console.error(
        "⚠️ Failed to sync suspended shop forum:",
        error,
      );
    }

    await shopNotificationService.notifySuspended(
      interaction.client,
      shop,
      interaction.user.id,
      reason,
    );

    await interaction.reply({
      content:
        "🚫 **ระงับร้านค้าสำเร็จ**\n\n" +
        `🏪 ร้าน: **${shop.name}**\n` +
        `🆔 Shop ID: \`${shop.shopId}\`\n` +
        `👤 เจ้าของ: <@${shop.ownerId}>\n` +
        `📝 เหตุผล: **${reason}**\n\n` +
        "📩 ส่งการแจ้งเตือนไปยัง DM ของเจ้าของร้านแล้ว",
      ephemeral: true,
    });

    return;
  }
}
