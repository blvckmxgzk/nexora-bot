import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Order } from "../../models/Order.js";
import { isShopOpenAt } from "../../services/shopHoursService.js";
import { sellerLedgerService } from "../../services/sellerLedgerService.js";

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

  /*
   * Financially archived Shop:
   *
   * ห้ามแสดง operational controls เช่น
   * edit product / reopen / payment settings
   *
   * แต่ Seller ต้องยังถอนยอดคงเหลือได้
   */
  if (shop.deletedAt) {
    const balanceSatang =
      await sellerLedgerService
        .getAvailableBalanceSatang(
          interaction.user.id,
        );

    const financialRow =
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              "nexora_shop_payout_account",
            )
            .setLabel(
              "บัญชีถอนเงิน",
            )
            .setEmoji("🏦")
            .setStyle(
              ButtonStyle.Secondary,
            ),

          new ButtonBuilder()
            .setCustomId(
              "nexora_shop_payout_request",
            )
            .setLabel(
              "ถอนเงิน TEST",
            )
            .setEmoji("💸")
            .setStyle(
              ButtonStyle.Success,
            ),
        );

    const embed =
      new EmbedBuilder()
        .setColor(
          0x6b7280,
        )
        .setTitle(
          `🗄️ ร้านถูก Archive • ${shop.name}`,
        )
        .setDescription(
          [
            `**Shop ID:** \`${shop.shopId}\``,
            "",
            "ร้านนี้ถูกนำออกจาก Marketplace แล้ว",
            "แต่ข้อมูลทางการเงินถูกเก็บไว้เพื่อ audit และ settlement",
            "",
            `**ยอดคงเหลือ:** ฿${(
              balanceSatang /
              100
            ).toFixed(2)}`,
            "",
            `**Archive เมื่อ:** ${new Date(
              shop.deletedAt,
            ).toLocaleString(
              "th-TH",
              {
                timeZone:
                  "Asia/Bangkok",
              },
            )}`,
            "",
            "สามารถใช้เฉพาะเครื่องมือทางการเงินด้านล่าง",
          ].join(
            "\n",
          ),
        )
        .setFooter({
          text:
            "NEXORA Marketplace • Financial Archive",
        })
        .setTimestamp();

    await interaction.reply({
      embeds: [
        embed,
      ],

      components: [
        financialRow,
      ],

      ephemeral:
        true,
    });

    return;
  }

  const orders =
    await Order.countDocuments({
      shopId:
        shop.shopId,
    });

  const shopStatus =
    isShopOpenAt(shop);

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

  const paymentText =
    [
      "💳 NEXORA Platform Payment",
      "ช่องทางที่ Buyer เห็นขึ้นอยู่กับ Provider capability และ Category Policy",
      "บัญชี PromptPay/TrueMoney ส่วนตัวของ Seller ไม่ได้ใช้เป็นปลายทาง Charge",
    ].join("\n");

  const businessHoursText =
    shopStatus.schedule
      ? [
          shopStatus.open
            ? "🟢 ร้านเปิดอยู่"
            : "🔴 ร้านปิดอยู่",

          `วันนี้: ${shopStatus.schedule.open} - ${shopStatus.schedule.close}`,

          `Timezone: ${shop.timezone ?? "Asia/Bangkok"}`,
        ].join("\n")
      : "🔴 วันนี้ร้านปิด";

  const embed =
    new EmbedBuilder()
      .setColor(
        shop.status ===
          "verified" &&
        shopStatus.open
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
          `**สถานะร้าน:** ${
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
          "**🕐 เวลาทำการ**",
          businessHoursText,
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
            "การรับชำระเงิน",
          )
          .setEmoji("💳")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  const settingsRow =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_hours",
          )
          .setLabel(
            "เวลาทำการ",
          )
          .setEmoji("🕐")
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_payout_account",
          )
          .setLabel(
            "บัญชีถอนเงิน",
          )
          .setEmoji("🏦")
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_shop_payout_request",
          )
          .setLabel(
            "ถอนเงิน TEST",
          )
          .setEmoji("💸")
          .setStyle(
            ButtonStyle.Success,
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
    [
      mainRow,
      settingsRow,
    ];

  if (
    actionRow.components.length >
    0
  ) {
    components.push(
      actionRow,
    );
  }

  await interaction.reply({
    embeds: [
      embed,
    ],
    components,
    ephemeral: true,
  });
}
