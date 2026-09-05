import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { paymentAccountService } from "../../services/paymentAccountService.js";

export const customId =
  "nexora_shop_payment_settings";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop =
    await Shop.findOne({
      ownerId: interaction.user.id,
    });

  if (!shop) {
    await interaction.reply({
      content:
        "❌ คุณยังไม่มีร้านค้า",
      ephemeral: true,
    });
    return;
  }

  const account =
    await paymentAccountService.getByShopId(
      shop.shopId,
    );

  const modal =
    new ModalBuilder()
      .setCustomId(
        "nexora_shop_payment_settings_modal",
      )
      .setTitle(
        "💳 ตั้งค่าการรับเงิน",
      );

  const promptpay =
    new TextInputBuilder()
      .setCustomId(
        "promptpay",
      )
      .setLabel(
        "PromptPay",
      )
      .setPlaceholder(
        "เบอร์โทรศัพท์ หรือ PromptPay ID",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(100)
      .setValue(
        account?.promptpay?.account ??
          "",
      )
      .setRequired(false);

  const truemoney =
    new TextInputBuilder()
      .setCustomId(
        "truemoney",
      )
      .setLabel(
        "TrueMoney",
      )
      .setPlaceholder(
        "เบอร์/ข้อมูลรับเงิน TrueMoney",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(100)
      .setValue(
        account?.truemoney?.account ??
          "",
      )
      .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        promptpay,
      ),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        truemoney,
      ),
  );

  await interaction.showModal(
    modal,
  );
}
