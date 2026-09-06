import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";
import { Product } from "../../models/Product.js";
import { isShopOpenAt } from "../../services/shopHoursService.js";

export const customId =
  "nexora_marketplace_shop_products:";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shopId =
    interaction.customId.split(":")[1];

  if (!shopId) {
    await interaction.reply({
      content:
        "❌ Shop ID ไม่ถูกต้อง",
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  const shop =
    await Shop.findOne({
      shopId,
      status: "verified",
    });

  if (!shop) {
    if (
      interaction.message.flags.has(
        MessageFlags.Ephemeral,
      )
    ) {
      await interaction.update({
        content:
          "❌ ร้านค้านี้ไม่พร้อมให้บริการ",
        embeds: [],
        components: [],
      });
    } else {
      await interaction.reply({
        content:
          "❌ ร้านค้านี้ไม่พร้อมให้บริการ",
        flags: MessageFlags.Ephemeral,
      });
    }

    return;
  }

  const status =
    isShopOpenAt(shop);

  const products =
    await Product.find({
      shopId: shop.shopId,
      active: true,
      stock: {
        $gt: 0,
      },
    })
      .sort({
        sold: -1,
        createdAt: -1,
      })
      .limit(25);

  const embed =
    new EmbedBuilder()
      .setColor(
        status.open
          ? 0x8b5cf6
          : 0xed4245,
      )
      .setTitle(
        `📦 สินค้าจาก ${shop.name}`,
      )
      .setDescription(
        [
          status.open
            ? "🟢 **ร้านเปิดอยู่ — สามารถสั่งซื้อได้**"
            : "🔴 **ร้านปิดอยู่ — ไม่สามารถสั่งซื้อได้ในขณะนี้**",
          "",
          products.length
            ? "เลือกสินค้าจากเมนูด้านล่าง"
            : "ร้านนี้ยังไม่มีสินค้าที่พร้อมขาย",
        ].join("\n"),
      )
      .setFooter({
        text:
          "NEXORA Marketplace • Shop Products",
      })
      .setTimestamp();

  const components: any[] = [];

  if (products.length > 0) {
    const menu =
      new StringSelectMenuBuilder()
        .setCustomId(
          "nexora_marketplace_product",
        )
        .setPlaceholder(
          "📦 เลือกสินค้าที่ต้องการดู",
        )
        .addOptions(
          products.map(
            (product) => ({
              label:
                product.name.slice(
                  0,
                  100,
                ),
              description:
                `฿${product.price.toLocaleString("th-TH")} • Stock ${product.stock}`
                  .slice(
                    0,
                    100,
                  ),
              value:
                product.productId,
              emoji: "📦",
            }),
          ),
        );

    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(menu),
    );
  }

  const buttons =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `nexora_marketplace_shop:${shop.shopId}`,
          )
          .setLabel("กลับหน้าร้าน")
          .setEmoji("↩️")
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `nexora_marketplace_shop_reviews:${shop.shopId}`,
          )
          .setLabel("รีวิวร้าน")
          .setEmoji("⭐")
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  components.push(buttons);

  const payload = {
    content: "",
    embeds: [embed],
    components,
  };

  if (
    interaction.message.flags.has(
      MessageFlags.Ephemeral,
    )
  ) {
    await interaction.update(
      payload,
    );

    return;
  }

  await interaction.reply({
    ...payload,
    flags: MessageFlags.Ephemeral,
  });
}
