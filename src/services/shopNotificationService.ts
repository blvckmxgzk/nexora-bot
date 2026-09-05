import {
  EmbedBuilder,
  type Client,
} from "discord.js";

interface ShopNotificationData {
  ownerId: string;
  name: string;
  shopId: string;
}

export const shopNotificationService = {
  async notifyVerified(
    client: Client,
    shop: ShopNotificationData,
    reviewerId: string,
  ): Promise<void> {
    try {
      const user =
        await client.users.fetch(
          shop.ownerId,
        );

      const embed =
        new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle(
            "🟢 ร้านค้าของคุณได้รับการยืนยันแล้ว!",
          )
          .setDescription(
            [
              `ร้าน **${shop.name}** ของคุณได้รับสถานะ **Verified Seller** แล้ว 🎉`,
              "",
              "ตอนนี้ร้านของคุณได้รับตรา Verified Seller ใน NEXORA Marketplace",
              "",
              "⚠️ Verified Seller เป็นตราความน่าเชื่อถือจากทีมงาน",
              "ไม่ได้เป็นการรับประกันสินค้าหรือการรับประกันผู้ขาย",
            ].join("\n"),
          )
          .addFields(
            {
              name: "🏪 ร้านค้า",
              value: shop.name,
              inline: true,
            },
            {
              name: "🆔 Shop ID",
              value:
                `\`${shop.shopId}\``,
              inline: true,
            },
            {
              name: "👮 ผู้อนุมัติ",
              value:
                `<@${reviewerId}>`,
              inline: true,
            },
          )
          .setFooter({
            text:
              "NEXORA Marketplace • Seller Verification",
          })
          .setTimestamp();

      await user.send({
        embeds: [embed],
      });

      console.log(
        `✓ Verification approval DM sent to ${shop.ownerId}`,
      );
    } catch (error) {
      console.warn(
        `⚠️ Could not send verification approval DM to ${shop.ownerId}:`,
        error,
      );
    }
  },

  async notifyRejected(
    client: Client,
    shop: ShopNotificationData,
    reviewerId: string,
    reason: string,
  ): Promise<void> {
    try {
      const user =
        await client.users.fetch(
          shop.ownerId,
        );

      const embed =
        new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle(
            "🔴 ร้านค้าของคุณไม่ผ่านการตรวจสอบ",
          )
          .setDescription(
            [
              `คำขอ Verified Seller ของร้าน **${shop.name}** ไม่ผ่านการตรวจสอบ`,
              "",
              "คุณสามารถแก้ไขข้อมูลร้านให้เรียบร้อยแล้วส่งคำขอใหม่ได้",
            ].join("\n"),
          )
          .addFields(
            {
              name: "🏪 ร้านค้า",
              value: shop.name,
              inline: true,
            },
            {
              name: "🆔 Shop ID",
              value:
                `\`${shop.shopId}\``,
              inline: true,
            },
            {
              name: "👮 ผู้ตรวจสอบ",
              value:
                `<@${reviewerId}>`,
              inline: true,
            },
            {
              name: "📝 เหตุผลที่ปฏิเสธ",
              value: reason,
              inline: false,
            },
          )
          .setFooter({
            text:
              "NEXORA Marketplace • Seller Verification",
          })
          .setTimestamp();

      await user.send({
        embeds: [embed],
      });

      console.log(
        `✓ Verification rejection DM sent to ${shop.ownerId}`,
      );
    } catch (error) {
      console.warn(
        `⚠️ Could not send verification rejection DM to ${shop.ownerId}:`,
        error,
      );
    }
  },

  async notifySuspended(
    client: Client,
    shop: ShopNotificationData,
    moderatorId: string,
    reason: string,
  ): Promise<void> {
    try {
      const user =
        await client.users.fetch(
          shop.ownerId,
        );

      const embed =
        new EmbedBuilder()
          .setColor(0x7f1d1d)
          .setTitle(
            "🚫 ร้านค้าของคุณถูกระงับ",
          )
          .setDescription(
            [
              `ร้าน **${shop.name}** ของคุณถูกทีมงาน NEXORA ระงับ`,
              "",
              "ระหว่างที่ร้านถูกระงับ อาจไม่สามารถดำเนินการขายหรือใช้งาน Marketplace ได้ตามปกติ",
              "",
              "หากคิดว่าการดำเนินการดังกล่าวเกิดจากความผิดพลาด กรุณาติดต่อทีมงาน NEXORA",
            ].join("\n"),
          )
          .addFields(
            {
              name: "🏪 ร้านค้า",
              value: shop.name,
              inline: true,
            },
            {
              name: "🆔 Shop ID",
              value:
                `\`${shop.shopId}\``,
              inline: true,
            },
            {
              name: "👮 ผู้ดำเนินการ",
              value:
                `<@${moderatorId}>`,
              inline: true,
            },
            {
              name: "📝 เหตุผล",
              value: reason,
              inline: false,
            },
          )
          .setFooter({
            text:
              "NEXORA Marketplace • Shop Moderation",
          })
          .setTimestamp();

      await user.send({
        embeds: [embed],
      });

      console.log(
        `✓ Shop suspension DM sent to ${shop.ownerId}`,
      );
    } catch (error) {
      console.warn(
        `⚠️ Could not send shop suspension DM to ${shop.ownerId}:`,
        error,
      );
    }
  },
};
