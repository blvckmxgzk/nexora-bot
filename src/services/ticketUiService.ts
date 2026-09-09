import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  type Guild,
  type TextChannel,
} from "discord.js";

import {
  TICKET_TYPES,
  TICKET_TYPE_MAP,
} from "../community/tickets/ticketTypes.js";

function statusText(
  status: string,
) {
  if (status === "claimed") {
    return "🟣 Claimed";
  }

  if (status === "closed") {
    return "🔒 Closed";
  }

  return "🟢 Open";
}

export const ticketUiService = {
  panel() {
    const embed =
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle(
          "🎫 NEXORA Support Center",
        )
        .setDescription(
          [
            "ต้องการความช่วยเหลือ? เลือกประเภทด้านล่างเพื่อเปิด Ticket ส่วนตัวกับทีมงาน",
            "",
            "**ก่อนเปิด Ticket**",
            "• เลือกประเภทให้ตรงกับปัญหา",
            "• อธิบายรายละเอียดและแนบหลักฐานให้ครบ",
            "• ห้ามเปิด Ticket ซ้ำเพื่อเร่งหรือกดดันทีมงาน",
            "",
            "ทีมงานจะเข้ามาดูแลโดยเร็วที่สุด",
          ].join("\n"),
        )
        .setFooter({
          text:
            "NEXORA • Support that stays organized",
        })
        .setTimestamp();

    const select =
      new StringSelectMenuBuilder()
        .setCustomId(
          "nexora_ticket_create",
        )
        .setPlaceholder(
          "🎫 เลือกประเภท Ticket",
        )
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          TICKET_TYPES.map(
            (type) => ({
              label: type.label,
              value: type.id,
              description:
                type.description.slice(
                  0,
                  100,
                ),
              emoji: type.emoji,
            }),
          ),
        );

    return {
      embeds: [embed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(select),
      ],
    };
  },

  ticketEmbed(ticket: any) {
    const type =
      TICKET_TYPE_MAP.get(
        ticket.type,
      );

    return new EmbedBuilder()
      .setColor(
        ticket.status === "closed"
          ? 0x2b2d31
          : type?.color ?? 0x8b5cf6,
      )
      .setTitle(
        `${type?.emoji ?? "🎫"} ${type?.label ?? ticket.type}`,
      )
      .setDescription(
        ticket.description,
      )
      .addFields(
        {
          name: "🎫 Ticket",
          value:
            `\`${ticket.ticketId}\``,
          inline: true,
        },
        {
          name: "👤 Owner",
          value:
            `<@${ticket.ownerId}>`,
          inline: true,
        },
        {
          name: "📌 Status",
          value:
            statusText(ticket.status),
          inline: true,
        },
        {
          name: "📝 Subject",
          value: ticket.subject,
        },
        {
          name: "🛡️ Claimed by",
          value:
            ticket.claimedBy
              ? `<@${ticket.claimedBy}>`
              : "ยังไม่มีทีมงาน Claim",
          inline: true,
        },
        {
          name: "👥 Members",
          value:
            `${(ticket.participants ?? []).length + 1}`,
          inline: true,
        },
        ...(
          ticket.status === "closed"
            ? [
                {
                  name:
                    "🔒 Close reason",
                  value:
                    ticket.closeReason ??
                    "ไม่ระบุ",
                },
              ]
            : []
        ),
      )
      .setFooter({
        text:
          "NEXORA • Ticket System",
      })
      .setTimestamp();
  },

  controls(ticket: any) {
    if (ticket.status === "closed") {
      return [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `nexora_ticket_transcript:${ticket.ticketId}`,
              )
              .setLabel("Transcript")
              .setEmoji("📄")
              .setStyle(
                ButtonStyle.Secondary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `nexora_ticket_reopen:${ticket.ticketId}`,
              )
              .setLabel("Reopen")
              .setEmoji("🔓")
              .setStyle(
                ButtonStyle.Success,
              ),

            new ButtonBuilder()
              .setCustomId(
                `nexora_ticket_delete:${ticket.ticketId}`,
              )
              .setLabel("Delete")
              .setEmoji("🗑️")
              .setStyle(
                ButtonStyle.Danger,
              ),
          ),
      ];
    }

    return [
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `nexora_ticket_claim:${ticket.ticketId}`,
            )
            .setLabel(
              ticket.claimedBy
                ? "Claimed"
                : "Claim",
            )
            .setEmoji("🙋")
            .setStyle(
              ButtonStyle.Primary,
            )
            .setDisabled(
              Boolean(ticket.claimedBy),
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_ticket_transcript:${ticket.ticketId}`,
            )
            .setLabel("Transcript")
            .setEmoji("📄")
            .setStyle(
              ButtonStyle.Secondary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `nexora_ticket_close:${ticket.ticketId}`,
            )
            .setLabel("Close")
            .setEmoji("🔒")
            .setStyle(
              ButtonStyle.Danger,
            ),
        ),
    ];
  },

  async refresh(
    guild: Guild,
    ticket: any,
  ) {
    if (
      !ticket.channelId ||
      !ticket.controlMessageId
    ) {
      return;
    }

    const channel =
      await guild.channels.fetch(
        ticket.channelId,
      );

    if (
      !channel ||
      channel.type !==
        ChannelType.GuildText
    ) {
      return;
    }

    const textChannel =
      channel as TextChannel;

    try {
      const message =
        await textChannel.messages.fetch(
          ticket.controlMessageId,
        );

      await message.edit({
        embeds: [
          this.ticketEmbed(ticket),
        ],
        components:
          this.controls(ticket),
      });
    } catch {
      // control message ถูกลบ ไม่ให้ action หลักพัง
    }
  },
};
