import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";

export const customId =
  "nexora_product_list";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop = await Shop.findOne({
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

  const products =
    await Product.find({
      shopId: shop.shopId,
    }).sort({
      createdAt: -1,
    });

  if (products.length === 0) {
    await interaction.reply({
      content:
        "📦 ร้านของคุณยังไม่มีสินค้า\n\nกด **➕ เพิ่มสินค้า** เพื่อเริ่มเพิ่มสินค้า",
      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                "nexora_product_create",
              )
              .setLabel("เพิ่มสินค้า")
              .setEmoji("➕")
              .setStyle(
                ButtonStyle.Success,
              ),

            new ButtonBuilder()
              .setCustomId(
                "nexora_product_manage",
              )
              .setLabel("กลับ")
              .setEmoji("↩️")
              .setStyle(
                ButtonStyle.Secondary,
              ),
          ),
      ],
      ephemeral: true,
    });
    return;
  }

  const embed =
    new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(
        `📋 สินค้าของร้าน ${shop.name}`,
      )
      .setDescription(
        products
          .slice(0, 10)
          .map(
            (product, index) =>
              [
                `### ${index + 1}. ${product.active ? "🟢" : "🔴"} ${product.name}`,
                `🆔 \`${product.productId}\``,
                `💰 ฿${product.price.toLocaleString("th-TH")} • 📦 ${product.stock} ชิ้น • 🛒 ขายแล้ว ${product.sold}`,
                `สถานะ: ${product.active ? "เปิดขาย" : "ปิดขาย"}`,
              ].join("\n"),
          )
          .join("\n\n"),
      )
      .setFooter({
        text:
          products.length > 10
            ? `แสดง 10 จาก ${products.length} สินค้า`
            : `${products.length} สินค้า`,
      })
      .setTimestamp();

  const rows: ActionRowBuilder<ButtonBuilder>[] =
    [];

  for (
    let index = 0;
    index < Math.min(products.length, 5);
    index++
  ) {
    const product =
      products[index];

    rows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_product_edit:${product.productId}`,
            )
            .setLabel(
              "แก้ไข",
            )
            .setEmoji("✏️")
            .setStyle(
              ButtonStyle.Primary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_product_toggle:${product.productId}`,
            )
            .setLabel(
              product.active
                ? "ปิดขาย"
                : "เปิดขาย",
            )
            .setEmoji(
              product.active
                ? "🔴"
                : "🟢",
            )
            .setStyle(
              product.active
                ? ButtonStyle.Secondary
                : ButtonStyle.Success,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_product_delete:${product.productId}`,
            )
            .setLabel("ลบ")
            .setEmoji("🗑️")
            .setStyle(
              ButtonStyle.Danger,
            ),
        ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "nexora_product_create",
          )
          .setLabel("เพิ่มสินค้า")
          .setEmoji("➕")
          .setStyle(
            ButtonStyle.Success,
          ),

        new ButtonBuilder()
          .setCustomId(
            "nexora_product_manage",
          )
          .setLabel("กลับ")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      ),
  );

  await interaction.reply({
    embeds: [embed],
    components: rows,
    ephemeral: true,
  });
}
