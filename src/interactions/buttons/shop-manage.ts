import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Order } from "../../models/Order.js";
import { paymentAccountService } from "../../services/paymentAccountService.js";

export const customId =
  "nexora_shop_manage";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId:
        interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ คุณยังไม่มีร้านค้า",
      ephemeral: true,
    });
    return;
  }

  const orders =
    await Order.countDocuments({
      shopId:
        shop.shopId,
    });

  const account =
    await paymentAccountService.getByShopId(
      shop.shopId,
    );

  const statusNames: Record<
    string,
    string
  > = {
    pending:
      "🟡 รอตรวจสอบ",
    verified:
      "🟢 Verified",
    rejected:
      "🔴 ถูกปฏิเสธ",
    suspended:
      "⛔ ถูกระงับ",
    closed:
      "⚫ ปิดร้าน",
  };

  const hasPromptPay =
    account?.promptpay?.enabled ===
      true &&
    !!account.promptpay?.account;

  const hasTrueMoney =
    account?.truemoney?.enabled ===
      true &&
    !!account.truemoney?.account;

  const paymentText =
    [
      hasPromptPay
        ? "💚 PromptPay"
        : null,

      hasTrueMoney
        ? "🟢 TrueMoney"
        : null,
    ]
      .filter(Boolean)
      .join("\n") ||
    "❌ ยังไม่ได้ตั้งค่า";

  const embed =
    new EmbedBuilder()
      .setColor(
        shop.status ===
          "verified"
          ? 0x22c55e
          : 0x8b5cf6,
      )
      .setTitle(
        `⚙️ จัดการร้านค้า • ${shop.name}`,
      )
      .setDescription(
        [
          `**Shop ID:** \`${shop.shopId}\``,
          "",
          `**สถานะ:** ${
            statusNames[
              shop.status
            ] ??
            shop.status
          }`,
          "",
          `**หมวดหมู่:** ${shop.category}`,
          `**คำสั่งซื้อ:** ${orders}`,
          `**คะแนน:** ⭐ ${shop.rating.toFixed(1)} (${shop.reviewCount} รีวิว)`,
          `**คำสั่งซื้อสำเร็จ:** ${shop.completedOrders}`,
          "",
          "**💳 ช่องทางรับเงิน**",
          paymentText,
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • จัดการร้านค้าของคุณ",
      })
      .setTimestamp();

  const mainRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_edit",
          )
          .setLabel(
            "แก้ไขร้านค้า",
          )
          .setEmoji("✏️")
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_product_manage",
          )
          .setLabel(
            "จัดการสินค้า",
          )
          .setEmoji("📦")
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_payment_settings",
          )
          .setLabel(
            "ช่องทางรับเงิน",
          )
          .setEmoji("💳")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  const actionRow =
    new ActionRowBuilder<ButtonBuilder>();

  if (
    shop.status ===
      "pending" ||
    shop.status ===
      "rejected"
  ) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          "nexora_shop_request_verification",
        )
        .setLabel(
          "ขอยืนยันร้านค้า",
        )
        .setEmoji("🛡️")
        .setStyle(
          ButtonStyle.Success,
        ),
    );
  }

  if (
    shop.status ===
      "pending" ||
    shop.status ===
      "verified" ||
    shop.status ===
      "rejected"
  ) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          "nexora_shop_close",
        )
        .setLabel(
          "ปิดร้าน",
        )
        .setEmoji("🔒")
        .setStyle(
          ButtonStyle.Secondary,
        ),
    );
  }

  if (
    shop.status ===
    "closed"
  ) {
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(
          "nexora_shop_reopen",
        )
        .setLabel(
          "เปิดร้านอีกครั้ง",
        )
        .setEmoji("🔓")
        .setStyle(
          ButtonStyle.Success,
        ),
    );
  }

  actionRow.addComponents(
    new ButtonBuilder()
      .setCustomId(
        "nexora_shop_delete",
      )
      .setLabel(
        "ลบร้านค้า",
      )
      .setEmoji("🗑️")
      .setStyle(
        ButtonStyle.Danger,
      ),
  );

  const components =
    [mainRow];

  if (
    actionRow.components.length >
    0
  ) {
    components.push(
      actionRow,
    );
  }

  await interaction.reply({
    embeds: [embed],
    components,
    ephemeral: true,
  });
}
