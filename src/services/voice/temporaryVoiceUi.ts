import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type VoiceChannel,
} from "discord.js";

type RoomLike = {
  channelId:
    string;

  ownerId:
    string;

  locked:
    boolean;

  hidden:
    boolean;

  userLimit:
    number;

  bitrate:
    number;
};

export type TemporaryVoiceUserAction =
  | "allow"
  | "remove"
  | "ban"
  | "transfer";

export type TemporaryVoiceModalAction =
  | "rename"
  | "limit"
  | "bitrate";

export function buildTemporaryVoicePanelEmbed(
  room:
    RoomLike,

  channel:
    VoiceChannel,
) {
  return new EmbedBuilder()
    .setColor(
      0x5338e8,
    )
    .setTitle(
      "🔊 NEXORA Temporary Voice",
    )
    .setDescription(
      [
        `**Room:** <#${channel.id}>`,
        `**Owner:** <@${room.ownerId}>`,
        "",
        "ใช้ปุ่มด้านล่างเพื่อจัดการห้องของคุณ",
      ].join(
        "\n",
      ),
    )
    .addFields(
      {
        name:
          "🔒 Lock",
        value:
          room.locked
            ? "Locked"
            : "Unlocked",
        inline:
          true,
      },

      {
        name:
          "👁️ Visibility",
        value:
          room.hidden
            ? "Hidden"
            : "Visible",
        inline:
          true,
      },

      {
        name:
          "👥 User Limit",
        value:
          room.userLimit ===
            0
            ? "Unlimited"
            : String(
                room.userLimit,
              ),
        inline:
          true,
      },

      {
        name:
          "🎙️ Bitrate",
        value:
          `${Math.round(channel.bitrate / 1000)} kbps`,
        inline:
          true,
      },
    )
    .setFooter({
      text:
        "ห้องจะถูกลบทันทีเมื่อไม่มีสมาชิกอยู่ในห้อง",
    });
}

export function buildTemporaryVoicePanel(
  room:
    RoomLike,
) {
  const channelId =
    room.channelId;

  const first =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tempvoice:rename:${channelId}`,
          )
          .setLabel(
            "Rename",
          )
          .setEmoji(
            "✏️",
          )
          .setStyle(
            ButtonStyle
              .Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:limit:${channelId}`,
          )
          .setLabel(
            "User Limit",
          )
          .setEmoji(
            "👥",
          )
          .setStyle(
            ButtonStyle
              .Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:bitrate:${channelId}`,
          )
          .setLabel(
            "Bitrate",
          )
          .setEmoji(
            "🎙️",
          )
          .setStyle(
            ButtonStyle
              .Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:lock:${channelId}`,
          )
          .setLabel(
            room.locked
              ? "Unlock"
              : "Lock",
          )
          .setEmoji(
            room.locked
              ? "🔓"
              : "🔒",
          )
          .setStyle(
            room.locked
              ? ButtonStyle
                  .Success
              : ButtonStyle
                  .Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:hide:${channelId}`,
          )
          .setLabel(
            room.hidden
              ? "Show"
              : "Hide",
          )
          .setEmoji(
            room.hidden
              ? "👁️"
              : "🙈",
          )
          .setStyle(
            ButtonStyle
              .Secondary,
          ),
      );

  const second =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `tempvoice:allow:${channelId}`,
          )
          .setLabel(
            "Allow",
          )
          .setEmoji(
            "✅",
          )
          .setStyle(
            ButtonStyle
              .Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:remove:${channelId}`,
          )
          .setLabel(
            "Remove",
          )
          .setEmoji(
            "➖",
          )
          .setStyle(
            ButtonStyle
              .Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:ban:${channelId}`,
          )
          .setLabel(
            "Ban",
          )
          .setEmoji(
            "🚫",
          )
          .setStyle(
            ButtonStyle
              .Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:transfer:${channelId}`,
          )
          .setLabel(
            "Transfer",
          )
          .setEmoji(
            "👑",
          )
          .setStyle(
            ButtonStyle
              .Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            `tempvoice:delete:${channelId}`,
          )
          .setLabel(
            "Delete",
          )
          .setEmoji(
            "🗑️",
          )
          .setStyle(
            ButtonStyle
              .Danger,
          ),
      );

  return [
    first,
    second,
  ];
}

export function buildTemporaryVoiceUserPicker(
  action:
    TemporaryVoiceUserAction,

  channelId:
    string,
) {
  const labels:
    Record<
      TemporaryVoiceUserAction,
      string
    > = {
      allow:
        "เลือกสมาชิกที่จะอนุญาต",

      remove:
        "เลือกสมาชิกที่จะลบสิทธิ์",

      ban:
        "เลือกสมาชิกที่จะ Ban",

      transfer:
        "เลือกเจ้าของห้องคนใหม่",
    };

  return new ActionRowBuilder<UserSelectMenuBuilder>()
    .addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(
          `tempvoice-user:${action}:${channelId}`,
        )
        .setPlaceholder(
          labels[
            action
          ],
        )
        .setMinValues(
          1,
        )
        .setMaxValues(
          1,
        ),
    );
}

export function buildTemporaryVoiceModal(
  action:
    TemporaryVoiceModalAction,

  channelId:
    string,
) {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `tempvoice-modal:${action}:${channelId}`,
      );

  const input =
    new TextInputBuilder()
      .setCustomId(
        "value",
      )
      .setStyle(
        TextInputStyle
          .Short,
      )
      .setRequired(
        true,
      );

  if (
    action ===
    "rename"
  ) {
    modal.setTitle(
      "Rename Temporary Voice",
    );

    input
      .setLabel(
        "ชื่อห้องใหม่",
      )
      .setPlaceholder(
        "Gaming Room",
      )
      .setMinLength(
        2,
      )
      .setMaxLength(
        36,
      );
  } else if (
    action ===
    "limit"
  ) {
    modal.setTitle(
      "Temporary Voice User Limit",
    );

    input
      .setLabel(
        "จำนวนสมาชิก 0–99",
      )
      .setPlaceholder(
        "0 = ไม่จำกัด",
      )
      .setMaxLength(
        2,
      );
  } else {
    modal.setTitle(
      "Temporary Voice Bitrate",
    );

    input
      .setLabel(
        "Bitrate (kbps)",
      )
      .setPlaceholder(
        "64",
      )
      .setMaxLength(
        3,
      );
  }

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>()
      .addComponents(
        input,
      ),
  );

  return modal;
}
