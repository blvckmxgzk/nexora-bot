import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

import {
  Shop,
} from "../../models/Shop.js";

import {
  sellerPayoutAccountService,
} from "../../services/sellerPayoutAccountService.js";

export const customId =
  "nexora_shop_payout_account";

export async function execute(
  interaction:
    ButtonInteraction,
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
      ephemeral:
        true,
    });

    return;
  }

  const existing =
    await sellerPayoutAccountService
      .getBySellerId(
        interaction.user.id,
      );

  if (
    existing &&
    existing.status !==
      "creating"
  ) {
    let account =
      existing;

    try {
      account =
        (
          await sellerPayoutAccountService
            .refresh(
              interaction.user.id,
            )
        ) ??
        existing;
    } catch {
      account =
        existing;
    }

    const embed =
      new EmbedBuilder()
        .setColor(
          account.status ===
            "ready"
            ? 0x22c55e
            : 0xf59e0b,
        )
        .setTitle(
          "🏦 บัญชีถอนเงิน • TEST",
        )
        .setDescription(
          [
            `**สถานะ:** ${
              account.status ===
                "ready"
                ? "✅ พร้อมถอนเงิน"
                : "🟡 รอตรวจสอบ"
            }`,
            "",
            `**ธนาคาร:** ${account.bankBrand ?? account.bankCode ?? "-"}`,
            `**เลขท้าย:** •••• ${account.bankLastDigits ?? "-"}`,
            `**Recipient:** \`${account.recipientId ?? "-"}\``,
            "",
            "🧪 ขณะนี้เป็น **Omise Test Mode เท่านั้น**",
          ].join(
            "\n",
          ),
        );

    await interaction.reply({
      embeds: [
        embed,
      ],
      ephemeral:
        true,
    });

    return;
  }

  const modal =
    new ModalBuilder()
      .setCustomId(
        "nexora_shop_payout_account_modal",
      )
      .setTitle(
        "🏦 บัญชีถอนเงิน TEST",
      );

  const name =
    new TextInputBuilder()
      .setCustomId(
        "account_holder_name",
      )
      .setLabel(
        "ชื่อเจ้าของบัญชี (ข้อมูลทดสอบ)",
      )
      .setPlaceholder(
        "NEXORA TEST SELLER",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMinLength(2)
      .setMaxLength(100)
      .setRequired(true);

  const bankCode =
    new TextInputBuilder()
      .setCustomId(
        "bank_code",
      )
      .setLabel(
        "Bank Code",
      )
      .setPlaceholder(
        "test",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setValue(
        "test",
      )
      .setRequired(true);

  const accountNumber =
    new TextInputBuilder()
      .setCustomId(
        "account_number",
      )
      .setLabel(
        "เลขบัญชีทดสอบ",
      )
      .setPlaceholder(
        "acc12345",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMinLength(4)
      .setMaxLength(50)
      .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        name,
      ),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        bankCode,
      ),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        accountNumber,
      ),
  );

  await interaction.showModal(
    modal,
  );
}
