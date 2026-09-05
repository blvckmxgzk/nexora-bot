import {
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";

import { Shop } from "../../models/Shop.js";

const categoryNames: Record<string, string> = {
  game_topup: "🎮 Game Top-up",
  game_keys: "🔑 Game Keys",
  gift_cards: "🎁 Gift Cards",
  digital_services: "🛠️ Digital Services",
  other: "📦 อื่น ๆ",
};

export const customId = "nexora_shop_close";

export async function execute(
  interaction: ButtonInteraction,
): Promise<void> {
  const shop = await Shop.findOne({
    ownerId: interaction.user.id,
  });

  if (!shop) {
    await interaction.reply({
      content: "❌ ไม่พบร้านค้าของคุณ",
      ephemeral: true,
    });
    return;
  }

  if (shop.status === "closed") {
    await interaction.reply({
      content: "❌ ร้านค้าของคุณปิดอยู่แล้ว",
      ephemeral: true,
    });
    return;
  }

  if (
    shop.status !== "pending" &&
    shop.status !== "verified"
  ) {
    await interaction.reply({
      content:
        "❌ ร้านค้าสถานะนี้ไม่สามารถปิดชั่วคราวได้",
      ephemeral: true,
    });
    return;
  }

  // จำสถานะเดิมเอาไว้สำหรับตอนเปิดร้านอีกครั้ง
  shop.closedFromStatus = shop.status;
  shop.status = "closed";

  await shop.save();

  if (shop.forumThreadId) {
    try {
      const thread =
        await interaction.client.channels.fetch(
          shop.forumThreadId,
        );

      if (thread && thread.isThread()) {
        const starterMessage =
          await thread.fetchStarterMessage();

        if (starterMessage) {
          const embed =
            new EmbedBuilder()
              .setColor(0x6b7280)
              .setTitle(`🔒 ${shop.name}`)
              .setDescription(shop.description)
              .addFields(
                {
                  name: "📂 หมวดหมู่",
                  value:
                    categoryNames[shop.category] ??
                    shop.category,
                  inline: true,
                },
                {
                  name: "🛡️ สถานะ",
                  value:
                    "⚫ **ร้านค้าปิดชั่วคราว**",
                  inline: true,
                },
                {
                  name: "👤 เจ้าของร้าน",
                  value: `<@${shop.ownerId}>`,
                  inline: true,
                },
                {
                  name: "⭐ คะแนน",
                  value:
                    shop.reviewCount > 0
                      ? `${shop.rating.toFixed(1)} / 5 (${shop.reviewCount} รีวิว)`
                      : "ยังไม่มีรีวิว",
                  inline: true,
                },
                {
                  name: "📦 ออเดอร์สำเร็จ",
                  value: String(shop.completedOrders),
                  inline: true,
                },
                {
                  name: "🆔 Shop ID",
                  value: `\`${shop.shopId}\``,
                  inline: true,
                },
              )
              .setFooter({
                text:
                  "NEXORA Marketplace • Temporarily Closed",
              })
              .setTimestamp();

          await starterMessage.edit({
            embeds: [embed],
          });
        }

        await thread.setName(`🔒 ${shop.name}`);
        await thread.setArchived(true);
      }
    } catch (error) {
      console.error(
        "⚠️ Failed to update closed shop forum:",
        error,
      );
    }
  }

  await interaction.update({
    content:
      "🔒 **ปิดร้านค้าชั่วคราวสำเร็จ**\n\n" +
      `ร้าน **${shop.name}** ถูกปิดชั่วคราวแล้ว\n\n` +
      "📦 สินค้าและ Stock ยังคงอยู่\n" +
      "⭐ รีวิวและประวัติการขายยังคงอยู่\n" +
      "💬 Forum ของร้านยังคงอยู่\n\n" +
      "คุณสามารถเปิดร้านกลับมาได้ทุกเมื่อ",
    embeds: [],
    components: [],
  });
}
