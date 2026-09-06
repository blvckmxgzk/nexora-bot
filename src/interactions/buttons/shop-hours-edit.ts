import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import {
  ensureBusinessHours,
} from "../../services/shopHoursService.js";

export const customId =
  "nexora_shop_hours_edit";

function formatSchedule(
  schedule: any,
): string {
  if (
    !schedule ||
    !schedule.enabled
  ) {
    return "closed";
  }

  return `${schedule.open}-${schedule.close}`;
}

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
    shop.status ===
      "closed" ||
    shop.status ===
      "suspended"
  ) {
    await interaction.reply({
      content:
        "❌ ไม่สามารถแก้ไขเวลาทำการของร้านในสถานะนี้ได้",
      ephemeral: true,
    });

    return;
  }

  const hours =
    ensureBusinessHours(
      shop,
    );

  const modal =
    new ModalBuilder()
      .setCustomId(
        "nexora_shop_hours_weekdays",
      )
      .setTitle(
        "🕐 เวลาทำการ • จ-ศ",
      );

  const fields = [
    {
      id: "monday",
      label: "จันทร์",
      value:
        formatSchedule(
          hours.monday,
        ),
    },
    {
      id: "tuesday",
      label: "อังคาร",
      value:
        formatSchedule(
          hours.tuesday,
        ),
    },
    {
      id: "wednesday",
      label: "พุธ",
      value:
        formatSchedule(
          hours.wednesday,
        ),
    },
    {
      id: "thursday",
      label: "พฤหัสบดี",
      value:
        formatSchedule(
          hours.thursday,
        ),
    },
    {
      id: "friday",
      label: "ศุกร์",
      value:
        formatSchedule(
          hours.friday,
        ),
    },
  ];

  for (const field of fields) {
    const input =
      new TextInputBuilder()
        .setCustomId(
          field.id,
        )
        .setLabel(
          field.label,
        )
        .setPlaceholder(
          "09:00-22:00 หรือ closed",
        )
        .setValue(
          field.value,
        )
        .setStyle(
          TextInputStyle.Short,
        )
        .setRequired(true)
        .setMaxLength(20);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>()
        .addComponents(
          input,
        ),
    );
  }

  await interaction.showModal(
    modal,
  );
}
