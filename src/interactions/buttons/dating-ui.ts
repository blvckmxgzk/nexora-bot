import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";

import {
  datingService,
} from "../../services/datingService.js";

export const customId =
  "nexora_dating:";

export async function execute(
  interaction:
    ButtonInteraction,
): Promise<void> {
  if (
    !interaction.inGuild() ||
    !interaction.guild
  ) {
    await interaction.reply({
      content:
        "❌ ระบบหาคู่ใช้ได้เฉพาะในเซิร์ฟเวอร์",

      flags:
        MessageFlags.Ephemeral,
    });

    return;
  }

  const raw =
    interaction.customId
      .slice(
        customId.length,
      );

  const [
    action,
    targetUserId,
  ] =
    raw.split(
      ":",
    );

  if (
    action ===
    "edit"
  ) {
    const modal =
      await datingService
        .buildProfileModal(
          interaction.guildId,
          interaction.user.id,
        );

    await interaction.showModal(
      modal,
    );

    return;
  }

  await interaction.deferReply({
    flags:
      MessageFlags.Ephemeral,
  });

  try {
    let payload:
      any;

    switch (
      action
    ) {
      case "home":
        payload =
          await datingService
            .home(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "profile":
        payload =
          await datingService
            .profile(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "browse":
        payload =
          await datingService
            .browse(
              interaction.client,
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "like": {
        if (!targetUserId) {
          throw new Error(
            "ไม่พบโปรไฟล์ที่เลือก",
          );
        }

        const result =
          await datingService
            .like(
              interaction.client,
              interaction.guild,
              interaction.user.id,
              targetUserId,
            );

        if (
          result.matched &&
          result.match
        ) {
          payload =
            datingService
              .matchPayload(
                targetUserId,
                result.match
                  .matchId,
              );
        } else {
          payload =
            await datingService
              .browse(
                interaction.client,
                interaction.guildId,
                interaction.user.id,
              );
        }

        break;
      }

      case "skip":
        if (!targetUserId) {
          throw new Error(
            "ไม่พบโปรไฟล์ที่เลือก",
          );
        }

        await datingService
          .skip(
            interaction.guildId,
            interaction.user.id,
            targetUserId,
          );

        payload =
          await datingService
            .browse(
              interaction.client,
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "block":
        if (!targetUserId) {
          throw new Error(
            "ไม่พบโปรไฟล์ที่เลือก",
          );
        }

        await datingService
          .block(
            interaction.guildId,
            interaction.user.id,
            targetUserId,
          );

        payload =
          await datingService
            .browse(
              interaction.client,
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "matches":
        payload =
          await datingService
            .matches(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "toggle":
        await datingService
          .toggle(
            interaction.guildId,
            interaction.user.id,
          );

        payload =
          await datingService
            .home(
              interaction.guildId,
              interaction.user.id,
            );

        break;

      case "reset_skips":
        await datingService
          .resetSkips(
            interaction.guildId,
            interaction.user.id,
          );

        payload =
          await datingService
            .home(
              interaction.guildId,
              interaction.user.id,
              "🔄 รีเซ็ตโปรไฟล์ที่เคยข้ามแล้ว",
            );

        break;

      case "delete":
        payload = {
          content:
            "⚠️ ต้องการลบ Dating Profile จริงหรือไม่?\nMatches ปัจจุบันจะถูกปิดด้วย",

          embeds:
            [],

          components: [
            new ActionRowBuilder<ButtonBuilder>()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `${customId}delete_confirm`,
                  )
                  .setLabel(
                    "ยืนยันลบ",
                  )
                  .setEmoji(
                    "🗑️",
                  )
                  .setStyle(
                    ButtonStyle.Danger,
                  ),

                new ButtonBuilder()
                  .setCustomId(
                    `${customId}home`,
                  )
                  .setLabel(
                    "ยกเลิก",
                  )
                  .setEmoji(
                    "↩️",
                  )
                  .setStyle(
                    ButtonStyle.Secondary,
                  ),
              ),
          ],
        };

        break;

      case "delete_confirm":
        await datingService
          .deleteProfile(
            interaction.guildId,
            interaction.user.id,
          );

        payload =
          await datingService
            .home(
              interaction.guildId,
              interaction.user.id,
              "🗑️ ลบ Dating Profile แล้ว",
            );

        break;

      default:
        throw new Error(
          "ไม่รู้จัก Dating action นี้",
        );
    }

    await interaction.editReply(
      payload,
    );
  } catch (error) {
    await interaction.editReply({
      content:
        `❌ ${
          error instanceof
            Error
            ? error.message
            : String(
                error,
              )
        }`,

      embeds:
        [],

      components:
        [],
    });
  }
}
