import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
} from "discord.js";

export const customId =
  "nexora_product_create";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const modal =
    new ModalBuilder()
      .setCustomId(
        "nexora_product_create_modal",
      )
      .setTitle(
        "➕ เพิ่มสินค้า",
      );

  const name =
    new TextInputBuilder()
      .setCustomId("product_name")
      .setLabel("ชื่อสินค้า")
      .setPlaceholder(
        "เช่น RoV Voucher 100 บาท",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMinLength(2)
      .setMaxLength(100)
      .setRequired(true);

  const description =
    new TextInputBuilder()
      .setCustomId(
        "product_description",
      )
      .setLabel("รายละเอียดสินค้า")
      .setPlaceholder(
        "รายละเอียดสินค้า / วิธีส่งมอบ",
      )
      .setStyle(
        TextInputStyle.Paragraph,
      )
      .setMinLength(5)
      .setMaxLength(1000)
      .setRequired(true);

  const price =
    new TextInputBuilder()
      .setCustomId("product_price")
      .setLabel("ราคา (บาท)")
      .setPlaceholder("เช่น 100")
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(12)
      .setRequired(true);

  const stock =
    new TextInputBuilder()
      .setCustomId("product_stock")
      .setLabel("จำนวนสินค้า")
      .setPlaceholder(
        "เช่น 10",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(12)
      .setRequired(true);

  const image =
    new TextInputBuilder()
      .setCustomId("product_image")
      .setLabel(
        "URL รูปสินค้า (ไม่ใส่ก็ได้)",
      )
      .setPlaceholder(
        "https://example.com/image.png",
      )
      .setStyle(
        TextInputStyle.Short,
      )
      .setMaxLength(500)
      .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(name),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(description),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(price),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(stock),

    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(image),
  );

  await interaction.showModal(
    modal,
  );
}
