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
  "nexora_shop_hours_weekend";

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

  const hours =
    ensureBusinessHours(
      shop,
    );

  const modal =
    new ModalBuilder()
      .setCustomId(
        "nexora_shop_hours_weekend",
      )
      .setTitle(
        "🕐 เสาร์ • อาทิตย์ • Timezone",
      );

  const saturday =
    new TextInputBuilder()
      .setCustomId(
        "saturday",
      )
      .setLabel(
        "เสาร์",
      )
      .setPlaceholder(
        "09:00-22:00 หรือ closed",
      )
      .setValue(
        formatSchedule(
          hours.saturday,
        ),
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setRequired(true)
      .setMaxLength(20);

  const sunday =
    new TextInputBuilder()
      .setCustomId(
        "sunday",
      )
      .setLabel(
        "อาทิตย์",
      )
      .setPlaceholder(
        "09:00-22:00 หรือ closed",
      )
      .setValue(
        formatSchedule(
          hours.sunday,
        ),
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setRequired(true)
      .setMaxLength(20);

  const timezone =
    new TextInputBuilder()
      .setCustomId(
        "timezone",
      )
      .setLabel(
        "Timezone",
      )
      .setPlaceholder(
        "เช่น Asia/Bangkok",
      )
      .setValue(
        shop.timezone ??
          "Asia/Bangkok",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setRequired(true)
      .setMaxLength(100);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        saturday,
      ),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        sunday,
      ),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        timezone,
      ),
  );

  await interaction.showModal(
    modal,
  );
}
