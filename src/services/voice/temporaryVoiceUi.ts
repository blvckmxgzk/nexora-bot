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
  channelId: string;
  ownerId: string;
  locked: boolean;
  hidden: boolean;
  userLimit: number;
  bitrate: number;
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

export const TEMP_VOICE_PANEL_TITLE =
  "🎛️ NEXORA Temporary Voice Control";

export function buildTemporaryVoiceStaticPanelEmbed() {
  return new EmbedBuilder()
    .setColor(
      0x5338e8,
    )
    .setTitle(
      TEMP_VOICE_PANEL_TITLE,
    )
    .setDescription(
      [
        "จัดการ **Temporary Voice Room** ของคุณจากพาแนลนี้ได้ตลอดเวลา",
        "",
        "ระบบจะค้นหาห้องที่คุณเป็น **Owner อยู่ในขณะกดปุ่ม** โดยอัตโนมัติ",
        "ไม่ต้องใช้ `/voice panel` และไม่ต้องสร้างพาแนลใหม่ทุกครั้ง",
        "",
        "หากยังไม่มีห้อง ให้เข้า **➕・สร้างห้องส่วนตัว** ก่อน",
      ].join(
        "\n",
      ),
    )
    .addFields(
      {
        name: "⚙️ Room",
        value: [
          "✏️ Rename",
          "👥 User Limit",
          "🎙️ Bitrate",
        ].join(
          "\n",
        ),
        inline: true,
      },

      {
        name: "🔐 Privacy",
        value: [
          "🔒 Lock / Unlock",
          "🙈 Hide / Show",
          "✅ Allow Access",
        ].join(
          "\n",
        ),
        inline: true,
      },

      {
        name: "👑 Ownership",
        value: [
          "➖ Remove Access",
          "🚫 Room Ban",
          "👑 Transfer",
          "🗑️ Delete",
        ].join(
          "\n",
        ),
        inline: true,
      },
    )
    .setFooter({
      text:
        "NEXORA • 1 Member = 1 Temporary Voice Room • Empty Room = Auto Delete",
    });
}

export function buildTemporaryVoiceStaticPanel() {
  const first =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "tempvoice:rename",
          )
          .setLabel(
            "Rename",
          )
          .setEmoji(
            "✏️",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:limit",
          )
          .setLabel(
            "User Limit",
          )
          .setEmoji(
            "👥",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:bitrate",
          )
          .setLabel(
            "Bitrate",
          )
          .setEmoji(
            "🎙️",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:lock",
          )
          .setLabel(
            "Lock / Unlock",
          )
          .setEmoji(
            "🔒",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:hide",
          )
          .setLabel(
            "Hide / Show",
          )
          .setEmoji(
            "🙈",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),
      );

  const second =
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            "tempvoice:allow",
          )
          .setLabel(
            "Allow",
          )
          .setEmoji(
            "✅",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:remove",
          )
          .setLabel(
            "Remove",
          )
          .setEmoji(
            "➖",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:ban",
          )
          .setLabel(
            "Ban",
          )
          .setEmoji(
            "🚫",
          )
          .setStyle(
            ButtonStyle.Secondary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:transfer",
          )
          .setLabel(
            "Transfer",
          )
          .setEmoji(
            "👑",
          )
          .setStyle(
            ButtonStyle.Primary,
          ),

        new ButtonBuilder()
          .setCustomId(
            "tempvoice:delete",
          )
          .setLabel(
            "Delete",
          )
          .setEmoji(
            "🗑️",
          )
          .setStyle(
            ButtonStyle.Danger,
          ),
      );

  return [
    first,
    second,
  ];
}

export function buildTemporaryVoiceStatusEmbed(
  room: RoomLike,
  channel: VoiceChannel,
) {
  return new EmbedBuilder()
    .setColor(
      0x5338e8,
    )
    .setTitle(
      "🔊 Temporary Voice Status",
    )
    .setDescription(
      [
        `**Room:** <#${channel.id}>`,
        `**Owner:** <@${room.ownerId}>`,
      ].join(
        "\n",
      ),
    )
    .addFields(
      {
        name: "🔒 Access",
        value:
          room.locked
            ? "Locked"
            : "Unlocked",
        inline: true,
      },

      {
        name: "👁️ Visibility",
        value:
          room.hidden
            ? "Hidden"
            : "Visible",
        inline: true,
      },

      {
        name: "👥 Limit",
        value:
          room.userLimit === 0
            ? "Unlimited"
            : String(
                room.userLimit,
              ),
        inline: true,
      },

      {
        name: "🎙️ Bitrate",
        value:
          `${Math.round(channel.bitrate / 1000)} kbps`,
        inline: true,
      },
    );
}

export function buildTemporaryVoiceUserPicker(
  action: TemporaryVoiceUserAction,
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
          `tempvoice-user:${action}`,
        )
        .setPlaceholder(
          labels[action],
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
  action: TemporaryVoiceModalAction,
) {
  const modal =
    new ModalBuilder()
      .setCustomId(
        `tempvoice-modal:${action}`,
      );

  const input =
    new TextInputBuilder()
      .setCustomId(
        "value",
      )
      .setStyle(
        TextInputStyle.Short,
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
