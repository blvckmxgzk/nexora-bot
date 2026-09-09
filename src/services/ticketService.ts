import crypto from "node:crypto";

import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type TextChannel,
} from "discord.js";

import {
  Ticket,
} from "../models/Ticket.js";

import {
  TicketConfig,
} from "../models/TicketConfig.js";

import {
  ticketTranscriptService,
} from "./ticketTranscriptService.js";

import {
  ticketUiService,
} from "./ticketUiService.js";

import {
  TICKET_TYPE_MAP,
  type TicketType,
} from "../community/tickets/ticketTypes.js";

function generateTicketId() {
  return (
    "TKT-" +
    crypto
      .randomBytes(5)
      .toString("hex")
      .toUpperCase()
  );
}

export function sanitizeTicketChannelName(
  value: string,
) {
  const normalized =
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .replace(
        /[^a-z0-9-_]+/g,
        "-",
      )
      .replace(
        /-+/g,
        "-",
      )
      .replace(
        /^-|-$/g,
        "",
      )
      .slice(0, 35);

  return normalized || "member";
}

async function getTextChannel(
  guild: Guild,
  channelId: string,
) {
  const channel =
    await guild.channels.fetch(
      channelId,
    );

  if (
    !channel ||
    channel.type !==
      ChannelType.GuildText
  ) {
    return null;
  }

  return channel as TextChannel;
}

export const ticketService = {
  async getConfig(
    guildId: string,
  ) {
    return TicketConfig.findOne({
      guildId,
    });
  },

  async requireConfig(
    guildId: string,
  ) {
    const config =
      await this.getConfig(
        guildId,
      );

    if (!config) {
      throw new Error(
        "Ticket System ยังไม่ได้ตั้งค่า — ใช้ `/ticket setup` ก่อน",
      );
    }

    return config;
  },

  async isStaff(
    guild: Guild,
    userId: string,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const member =
      await guild.members.fetch(
        userId,
      );

    return (
      member.permissions.has(
        PermissionFlagsBits.Administrator,
      ) ||
      member.roles.cache.has(
        config.staffRoleId,
      )
    );
  },

  async setup(
    guild: Guild,
    staffRole: {
      id: string;
    },
    categoryId?: string | null,
    logChannelId?: string | null,
  ) {
    let category =
      categoryId
        ? await guild.channels.fetch(
            categoryId,
          )
        : null;

    if (
      category &&
      category.type !==
        ChannelType.GuildCategory
    ) {
      throw new Error(
        "Category ที่เลือกไม่ใช่ Category",
      );
    }

    if (!category) {
      category =
        await guild.channels.create({
          name:
            "🎫・NEXORA TICKETS",
          type:
            ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id:
                guild.roles.everyone.id,
              deny: [
                PermissionFlagsBits.ViewChannel,
              ],
            },
            {
              id: staffRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ],
          reason:
            "NEXORA Ticket System setup",
        });
    }

    let logChannel =
      logChannelId
        ? await getTextChannel(
            guild,
            logChannelId,
          )
        : null;

    if (
      logChannelId &&
      !logChannel
    ) {
      throw new Error(
        "Log Channel ที่เลือกไม่ใช่ Text Channel",
      );
    }

    if (!logChannel) {
      logChannel =
        await guild.channels.create({
          name: "ticket-logs",
          type:
            ChannelType.GuildText,
          parent: category.id,
          topic:
            "NEXORA Ticket audit logs and transcripts",
          permissionOverwrites: [
            {
              id:
                guild.roles.everyone.id,
              deny: [
                PermissionFlagsBits.ViewChannel,
              ],
            },
            {
              id: staffRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
              ],
            },
          ],
          reason:
            "NEXORA Ticket System setup",
        });
    }

    return TicketConfig.findOneAndUpdate(
      {
        guildId: guild.id,
      },
      {
        $set: {
          staffRoleId: staffRole.id,
          categoryId: category.id,
          logChannelId:
            logChannel.id,
        },
        $setOnInsert: {
          maxOpenPerUser: 3,
        },
      },
      {
        new: true,
        upsert: true,
      },
    );
  },

  async canOpen(
    guildId: string,
    ownerId: string,
    type: TicketType,
    options?: {
      allowSameType?:
        boolean;
    },
  ) {
    const config =
      await this.requireConfig(
        guildId,
      );

    if (
      !options
        ?.allowSameType
    ) {
      const duplicate =
        await Ticket.findOne({
          guildId,
          ownerId,
          type,
          status: {
            $in: [
              "open",
              "claimed",
            ],
          },
        });

      if (duplicate) {
        throw new Error(
          `คุณมี Ticket ประเภทนี้เปิดอยู่แล้ว: <#${duplicate.channelId}>`,
        );
      }
    }

    const count =
      await Ticket.countDocuments({
        guildId,
        ownerId,
        status: {
          $in: [
            "open",
            "claimed",
          ],
        },
      });

    if (
      count >=
      (config.maxOpenPerUser ?? 3)
    ) {
      throw new Error(
        `คุณมี Ticket ที่เปิดอยู่ถึงขีดจำกัดแล้ว (${config.maxOpenPerUser ?? 3})`,
      );
    }

    return true;
  },

  async open(
    guild: Guild,
    ownerId: string,
    ownerName: string,
    type: TicketType,
    subject: string,
    description: string,
    context?: {
      source?:
        | "manual"
        | "marketplace_report";

      reportId?:
        string | null;

      orderId?:
        string | null;

      shopId?:
        string | null;

      sellerId?:
        string | null;

      allowSameType?:
        boolean;
    },
  ) {
    await this.canOpen(
      guild.id,
      ownerId,
      type,
      {
        allowSameType:
          context
            ?.allowSameType,
      },
    );

    const config =
      await this.requireConfig(
        guild.id,
      );

    const typeInfo =
      TICKET_TYPE_MAP.get(type);

    if (!typeInfo) {
      throw new Error(
        "ประเภท Ticket ไม่ถูกต้อง",
      );
    }

    const ticketId =
      generateTicketId();

    const channelName =
      `${type}-${sanitizeTicketChannelName(
        ownerName,
      )}-${ticketId.slice(-4).toLowerCase()}`;

    const channel =
      await guild.channels.create({
        name: channelName,
        type:
          ChannelType.GuildText,
        parent: config.categoryId,
        topic:
          `NEXORA Ticket ${ticketId} | Owner ${ownerId} | ${subject}`,
        permissionOverwrites: [
          {
            id:
              guild.roles.everyone.id,
            deny: [
              PermissionFlagsBits.ViewChannel,
            ],
          },
          {
            id: ownerId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: config.staffRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
        reason:
          `Ticket ${ticketId} opened by ${ownerId}`,
      });

    let ticket: any;

    try {
      ticket =
        await Ticket.create({
          ticketId,
          guildId: guild.id,
          channelId: channel.id,
          ownerId,
          type,
          subject,
          description,
          status: "open",
          participants: [],
          events: [
            {
              type: "opened",
              actorId: ownerId,
            },
          ],
        });
    } catch (error) {
      await channel
        .delete(
          "Rolling back failed ticket creation",
        )
        .catch(() => undefined);

      throw error;
    }

    const control =
      await channel.send({
        content:
          `<@${ownerId}> <@&${config.staffRoleId}>`,
        allowedMentions: {
          users: [ownerId],
          roles: [
            config.staffRoleId,
          ],
        },
        embeds: [
          ticketUiService.ticketEmbed(
            ticket,
          ),
        ],
        components:
          ticketUiService.controls(
            ticket,
          ),
      });

    ticket =
      await Ticket.findOneAndUpdate(
        { ticketId },
        {
          $set: {
            controlMessageId:
              control.id,
          },
        },
        { new: true },
      );

    await this.log(
      guild,
      "🎫 Ticket Opened",
      [
        `**Ticket:** \`${ticketId}\``,
        `**Owner:** <@${ownerId}>`,
        `**Type:** ${typeInfo.emoji} ${typeInfo.label}`,
        `**Channel:** <#${channel.id}>`,
        `**Subject:** ${subject}`,
      ].join("\n"),
      0x57f287,
    );

    return {
      ticket,
      channel,
    };
  },

  async get(
    ticketId: string,
  ) {
    const ticket =
      await Ticket.findOne({
        ticketId,
      });

    if (!ticket) {
      throw new Error(
        "ไม่พบ Ticket นี้",
      );
    }

    return ticket;
  },

  async getByChannel(
    guildId: string,
    channelId: string,
  ) {
    return Ticket.findOne({
      guildId,
      channelId,
    });
  },

  async assertCanView(
    guild: Guild,
    ticket: any,
    userId: string,
  ) {
    if (
      ticket.ownerId === userId ||
      (ticket.participants ?? []).includes(
        userId,
      ) ||
      await this.isStaff(
        guild,
        userId,
      )
    ) {
      return;
    }

    throw new Error(
      "คุณไม่มีสิทธิ์เข้าถึง Ticket นี้",
    );
  },

  async assertStaff(
    guild: Guild,
    userId: string,
  ) {
    if (
      !await this.isStaff(
        guild,
        userId,
      )
    ) {
      throw new Error(
        "คำสั่งนี้ใช้ได้เฉพาะทีมงาน Ticket",
      );
    }
  },

  async claim(
    guild: Guild,
    ticketId: string,
    actorId: string,
  ) {
    await this.assertStaff(
      guild,
      actorId,
    );

    const ticket =
      await this.get(ticketId);

    if (ticket.status === "closed") {
      throw new Error(
        "Ticket นี้ถูกปิดแล้ว",
      );
    }

    if (ticket.claimedBy) {
      throw new Error(
        `Ticket นี้ถูก Claim โดย <@${ticket.claimedBy}> แล้ว`,
      );
    }

    const updated =
      await Ticket.findOneAndUpdate(
        {
          ticketId,
          claimedBy: null,
          status: {
            $ne: "closed",
          },
        },
        {
          $set: {
            claimedBy: actorId,
            claimedAt: new Date(),
            status: "claimed",
          },
          $push: {
            events: {
              type: "claimed",
              actorId,
              createdAt: new Date(),
            },
          },
        },
        { new: true },
      );

    if (!updated) {
      throw new Error(
        "Ticket ถูก Claim ไปแล้ว",
      );
    }

    await ticketUiService.refresh(
      guild,
      updated,
    );

    await this.log(
      guild,
      "🙋 Ticket Claimed",
      `**${ticketId}** ถูก Claim โดย <@${actorId}>`,
      0x5865f2,
    );

    return updated;
  },

  async addParticipant(
    guild: Guild,
    ticketId: string,
    actorId: string,
    userId: string,
  ) {
    await this.assertStaff(
      guild,
      actorId,
    );

    const ticket =
      await this.get(ticketId);

    if (ticket.ownerId === userId) {
      throw new Error(
        "ผู้ใช้นี้เป็นเจ้าของ Ticket อยู่แล้ว",
      );
    }

    const channel =
      await getTextChannel(
        guild,
        ticket.channelId,
      );

    if (!channel) {
      throw new Error(
        "ไม่พบห้อง Ticket",
      );
    }

    await channel.permissionOverwrites.edit(
      userId,
      {
        ViewChannel: true,
        SendMessages:
          ticket.status !== "closed",
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
      },
      {
        reason:
          `Added to ${ticketId} by ${actorId}`,
      },
    );

    const updated =
      await Ticket.findOneAndUpdate(
        { ticketId },
        {
          $addToSet: {
            participants: userId,
          },
          $push: {
            events: {
              type:
                "participant_added",
              actorId,
              reason: userId,
              createdAt: new Date(),
            },
          },
        },
        { new: true },
      );

    await ticketUiService.refresh(
      guild,
      updated,
    );

    return updated;
  },

  async removeParticipant(
    guild: Guild,
    ticketId: string,
    actorId: string,
    userId: string,
  ) {
    await this.assertStaff(
      guild,
      actorId,
    );

    const ticket =
      await this.get(ticketId);

    if (ticket.ownerId === userId) {
      throw new Error(
        "ไม่สามารถลบเจ้าของ Ticket ได้",
      );
    }

    const channel =
      await getTextChannel(
        guild,
        ticket.channelId,
      );

    if (!channel) {
      throw new Error(
        "ไม่พบห้อง Ticket",
      );
    }

    await channel.permissionOverwrites
      .delete(
        userId,
        `Removed from ${ticketId} by ${actorId}`,
      )
      .catch(() => undefined);

    const updated =
      await Ticket.findOneAndUpdate(
        { ticketId },
        {
          $pull: {
            participants: userId,
          },
          $push: {
            events: {
              type:
                "participant_removed",
              actorId,
              reason: userId,
              createdAt: new Date(),
            },
          },
        },
        { new: true },
      );

    await ticketUiService.refresh(
      guild,
      updated,
    );

    return updated;
  },

  async close(
    guild: Guild,
    ticketId: string,
    actorId: string,
    reason: string,
  ) {
    const ticket =
      await this.get(ticketId);

    const staff =
      await this.isStaff(
        guild,
        actorId,
      );

    if (
      ticket.ownerId !== actorId &&
      !staff
    ) {
      throw new Error(
        "เฉพาะเจ้าของ Ticket หรือทีมงานเท่านั้นที่ปิด Ticket ได้",
      );
    }

    if (ticket.status === "closed") {
      throw new Error(
        "Ticket นี้ถูกปิดอยู่แล้ว",
      );
    }

    const updated =
      await Ticket.findOneAndUpdate(
        {
          ticketId,
          status: {
            $ne: "closed",
          },
        },
        {
          $set: {
            status: "closed",
            closeReason: reason,
            closedBy: actorId,
            closedAt: new Date(),
          },
          $push: {
            events: {
              type: "closed",
              actorId,
              reason,
              createdAt: new Date(),
            },
          },
        },
        { new: true },
      );

    if (!updated) {
      throw new Error(
        "ไม่สามารถปิด Ticket ได้",
      );
    }

    const channel =
      await getTextChannel(
        guild,
        updated.channelId,
      );

    if (channel) {
      const users = [
        updated.ownerId,
        ...(updated.participants ?? []),
      ];

      for (const userId of users) {
        await channel.permissionOverwrites
          .edit(
            userId,
            {
              ViewChannel: true,
              SendMessages: false,
              ReadMessageHistory: true,
            },
            {
              reason:
                `Ticket ${ticketId} closed`,
            },
          )
          .catch(() => undefined);
      }

      await channel
        .setName(
          `closed-${ticketId.toLowerCase()}`,
          `Ticket ${ticketId} closed`,
        )
        .catch(() => undefined);
    }

    await ticketUiService.refresh(
      guild,
      updated,
    );

    await this.archiveTranscript(
      guild,
      updated,
    );

    await this.log(
      guild,
      "🔒 Ticket Closed",
      [
        `**Ticket:** \`${ticketId}\``,
        `**Closed by:** <@${actorId}>`,
        `**Reason:** ${reason}`,
      ].join("\n"),
      0xed4245,
    );

    return updated;
  },

  async reopen(
    guild: Guild,
    ticketId: string,
    actorId: string,
  ) {
    await this.assertStaff(
      guild,
      actorId,
    );

    const ticket =
      await this.get(ticketId);

    if (ticket.status !== "closed") {
      throw new Error(
        "Ticket นี้ไม่ได้อยู่ในสถานะ Closed",
      );
    }

    const status =
      ticket.claimedBy
        ? "claimed"
        : "open";

    const updated =
      await Ticket.findOneAndUpdate(
        {
          ticketId,
          status: "closed",
        },
        {
          $set: {
            status,
            reopenedAt: new Date(),
            reopenedBy: actorId,
            closeReason: null,
            closedBy: null,
            closedAt: null,
          },
          $push: {
            events: {
              type: "reopened",
              actorId,
              createdAt: new Date(),
            },
          },
        },
        { new: true },
      );

    if (!updated) {
      throw new Error(
        "ไม่สามารถ Reopen Ticket ได้",
      );
    }

    const channel =
      await getTextChannel(
        guild,
        updated.channelId,
      );

    if (channel) {
      const users = [
        updated.ownerId,
        ...(updated.participants ?? []),
      ];

      for (const userId of users) {
        await channel.permissionOverwrites
          .edit(
            userId,
            {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true,
              AttachFiles: true,
              EmbedLinks: true,
            },
            {
              reason:
                `Ticket ${ticketId} reopened`,
            },
          )
          .catch(() => undefined);
      }

      const owner =
        await guild.members
          .fetch(updated.ownerId)
          .catch(() => null);

      await channel
        .setName(
          `${updated.type}-${sanitizeTicketChannelName(
            owner?.user.username ??
            "member",
          )}-${ticketId.slice(-4).toLowerCase()}`,
          `Ticket ${ticketId} reopened`,
        )
        .catch(() => undefined);
    }

    await ticketUiService.refresh(
      guild,
      updated,
    );

    await this.log(
      guild,
      "🔓 Ticket Reopened",
      `**${ticketId}** ถูก Reopen โดย <@${actorId}>`,
      0x57f287,
    );

    return updated;
  },

  async archiveTranscript(
    guild: Guild,
    ticket: any,
  ) {
    const config =
      await this.requireConfig(
        guild.id,
      );

    const channel =
      await getTextChannel(
        guild,
        ticket.channelId,
      );

    const logChannel =
      await getTextChannel(
        guild,
        config.logChannelId,
      );

    if (!channel || !logChannel) {
      return null;
    }

    const transcript =
      await ticketTranscriptService.create(
        channel,
        ticket.ticketId,
      );

    const message =
      await logChannel.send({
        content:
          `📄 Transcript • **${ticket.ticketId}** • <#${ticket.channelId}>`,
        files: [
          transcript.attachment,
        ],
      });

    await Ticket.updateOne(
      {
        ticketId:
          ticket.ticketId,
      },
      {
        $set: {
          transcriptChannelId:
            logChannel.id,
          transcriptMessageId:
            message.id,
        },
      },
    );

    return {
      ...transcript,
      logMessageId: message.id,
    };
  },

  async delete(
    guild: Guild,
    ticketId: string,
    actorId: string,
  ) {
    await this.assertStaff(
      guild,
      actorId,
    );

    const ticket =
      await this.get(ticketId);

    if (ticket.status !== "closed") {
      throw new Error(
        "ต้อง Close Ticket ก่อนจึงจะลบได้",
      );
    }

    if (!ticket.transcriptMessageId) {
      await this.archiveTranscript(
        guild,
        ticket,
      );
    }

    await this.log(
      guild,
      "🗑️ Ticket Deleted",
      [
        `**Ticket:** \`${ticketId}\``,
        `**Owner:** <@${ticket.ownerId}>`,
        `**Deleted by:** <@${actorId}>`,
      ].join("\n"),
      0x2b2d31,
    );

    await Ticket.updateOne(
      { ticketId },
      {
        $push: {
          events: {
            type: "deleted",
            actorId,
            createdAt: new Date(),
          },
        },
      },
    );

    const channel =
      await getTextChannel(
        guild,
        ticket.channelId,
      );

    if (channel) {
      await channel.delete(
        `Ticket ${ticketId} deleted by ${actorId}`,
      );
    }

    return ticket;
  },

  async log(
    guild: Guild,
    title: string,
    description: string,
    color: number = 0x8b5cf6,
  ) {
    const config =
      await this.getConfig(
        guild.id,
      );

    if (!config?.logChannelId) {
      return null;
    }

    const channel =
      await getTextChannel(
        guild,
        config.logChannelId,
      );

    if (!channel) {
      return null;
    }

    return channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(color)
          .setTitle(title)
          .setDescription(
            description,
          )
          .setFooter({
            text:
              "NEXORA • Ticket Audit",
          })
          .setTimestamp(),
      ],
    });
  },
};
