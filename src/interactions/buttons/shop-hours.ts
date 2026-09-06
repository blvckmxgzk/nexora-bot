import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import {
  isShopOpenAt,
} from "../../services/shopHoursService.js";

export const customId =
  "nexora_shop_hours";

type ScheduleValue = {
  enabled: boolean;
  open: string;
  close: string;
};

type DayEntry = {
  name: string;
  schedule:
    | ScheduleValue
    | undefined;
};

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
        "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });

    return;
  }

  if (
    shop.status === "closed" ||
    shop.status === "suspended"
  ) {
    await interaction.reply({
      content:
        shop.status === "closed"
          ? "🔒 ร้านค้าของคุณปิดอยู่ กรุณาเปิดร้านก่อนจัดการเวลาทำการ"
          : "🚫 ร้านค้าของคุณถูกระงับ ไม่สามารถตั้งค่าเวลาทำการได้",
      ephemeral: true,
    });

    return;
  }

  const shopStatus =
    isShopOpenAt(shop);

  const hours =
    shop.businessHours;

  const days: DayEntry[] = [
    {
      name: "จันทร์",
      schedule:
        hours?.monday,
    },
    {
      name: "อังคาร",
      schedule:
        hours?.tuesday,
    },
    {
      name: "พุธ",
      schedule:
        hours?.wednesday,
    },
    {
      name: "พฤหัสบดี",
      schedule:
        hours?.thursday,
    },
    {
      name: "ศุกร์",
      schedule:
        hours?.friday,
    },
    {
      name: "เสาร์",
      schedule:
        hours?.saturday,
    },
    {
      name: "อาทิตย์",
      schedule:
        hours?.sunday,
    },
  ];

  const description =
    days
      .map(
        (day) => {
          if (
            !day.schedule ||
            !day.schedule.enabled
          ) {
            return `🔴 **${day.name}** — ปิด`;
          }

          return [
            `🟢 **${day.name}**`,
            `— ${day.schedule.open} - ${day.schedule.close}`,
          ].join(" ");
        },
      )
      .join("\n");

  const embed =
    new EmbedBuilder()
      .setColor(
        shopStatus.open
          ? 0x57f287
          : 0xed4245,
      )
      .setTitle(
        "🕐 เวลาทำการร้านค้า",
      )
      .setDescription(
        [
          `🏪 **${shop.name}**`,
          "",
          shopStatus.open
            ? "🟢 **ร้านกำลังเปิดอยู่**"
            : "🔴 **ร้านกำลังปิดอยู่**",
          "",
          description,
          "",
          `🌏 Timezone: \`${shop.timezone ?? "Asia/Bangkok"}\``,
          "",
          shop.autoOpenClose
            ? "⚡ ระบบเปิด/ปิดตามเวลาทำการ: **เปิดใช้งาน**"
            : "⚪ ระบบเปิด/ปิดตามเวลาทำการ: **ปิดใช้งาน**",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Business Hours",
      })
      .setTimestamp();

  const editButton =
    new ButtonBuilder()
      .setCustomId(
        "nexora_shop_hours_edit",
      )
      .setLabel(
        "แก้ไขเวลาทำการ",
      )
      .setEmoji("✏️")
      .setStyle(
        ButtonStyle.Primary,
      );

  const backButton =
    new ButtonBuilder()
      .setCustomId(
        "nexora_shop_manage",
      )
      .setLabel("กลับ")
      .setEmoji("↩️")
      .setStyle(
        ButtonStyle.Secondary,
      );

  const row =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        editButton,
        backButton,
      );

  await interaction.reply({
    embeds: [
      embed,
    ],
    components: [
      row,
    ],
    ephemeral: true,
  });
}
