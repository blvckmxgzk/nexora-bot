import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";

import { Ticket } from "../../models/Ticket.js";
import { TicketConfig } from "../../models/TicketConfig.js";
import { ticketService } from "../../services/ticketService.js";
import { ticketUiService } from "../../services/ticketUiService.js";

export const data =
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("NEXORA Ticket System")
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("ตั้งค่า Ticket System")
        .addRoleOption((option) =>
          option
            .setName("staff_role")
            .setDescription("Role ของทีมงาน Ticket")
            .setRequired(true),
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("Category สำหรับ Ticket (เว้นว่างเพื่อให้บอทสร้าง)")
            .addChannelTypes(ChannelType.GuildCategory),
        )
        .addChannelOption((option) =>
          option
            .setName("log_channel")
            .setDescription("ห้อง Ticket Logs (เว้นว่างเพื่อให้บอทสร้าง)")
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((command) =>
      command
        .setName("panel")
        .setDescription("ส่งหน้าเปิด Ticket")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("ห้องสำหรับ Ticket Panel")
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((command) =>
      command
        .setName("info")
        .setDescription("ดูข้อมูล Ticket ของห้องนี้"),
    )
    .addSubcommand((command) =>
      command
        .setName("add")
        .setDescription("เพิ่มสมาชิกเข้า Ticket")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("สมาชิกที่ต้องการเพิ่ม")
            .setRequired(true),
        ),
    )
    .addSubcommand((command) =>
      command
        .setName("remove")
        .setDescription("ลบสมาชิกออกจาก Ticket")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("สมาชิกที่ต้องการลบ")
            .setRequired(true),
        ),
    )
    .addSubcommand((command) =>
      command
        .setName("list")
        .setDescription("ดู Ticket ที่กำลังเปิดอยู่"),
    );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "❌ ใช้คำสั่ง Ticket ได้เฉพาะในเซิร์ฟเวอร์",
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  const sub = interaction.options.getSubcommand();

  if (sub === "setup") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ ต้องมี Administrator เพื่อ Setup Ticket",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const role = interaction.options.getRole("staff_role", true);
    const category = interaction.options.getChannel("category");
    const logs = interaction.options.getChannel("log_channel");

    const config = await ticketService.setup(
      guild,
      role,
      category?.id ?? null,
      logs?.id ?? null,
    );

    await interaction.editReply({
      content: [
        "✅ **Ticket System พร้อมใช้งานแล้ว**",
        "",
        `Staff: <@&${config.staffRoleId}>`,
        `Category: <#${config.categoryId}>`,
        `Logs: <#${config.logChannelId}>`,
        "",
        "ต่อไปใช้ `/ticket panel` เพื่อส่งหน้าเปิด Ticket",
      ].join("\n"),
    });
    return;
  }

  if (sub === "panel") {
    const staff = await ticketService
      .isStaff(guild, interaction.user.id)
      .catch(() => false);

    if (!staff && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        content: "❌ เฉพาะทีมงานเท่านั้นที่ส่ง Ticket Panel ได้",
        ephemeral: true,
      });
      return;
    }

    const target = interaction.options.getChannel("channel") ?? interaction.channel;

    if (!target || target.type !== ChannelType.GuildText) {
      await interaction.reply({
        content: "❌ กรุณาเลือก Text Channel",
        ephemeral: true,
      });
      return;
    }

    const message = await (target as TextChannel).send(ticketUiService.panel());

    await TicketConfig.updateOne(
      { guildId: guild.id },
      {
        $set: {
          panelChannelId: target.id,
          panelMessageId: message.id,
        },
      },
    );

    await interaction.reply({
      content: `✅ ส่ง Ticket Panel แล้วที่ <#${target.id}>`,
      ephemeral: true,
    });
    return;
  }

  if (sub === "list") {
    await ticketService.assertStaff(guild, interaction.user.id);

    const tickets = await Ticket.find({
      guildId: guild.id,
      status: { $in: ["open", "claimed"] },
    })
      .sort({ createdAt: 1 })
      .limit(25);

    const lines = tickets.map(
      (ticket) =>
        `${ticket.status === "claimed" ? "🟣" : "🟢"} \`${ticket.ticketId}\` • <#${ticket.channelId}> • <@${ticket.ownerId}>`,
    );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x8b5cf6)
          .setTitle("🎫 Active Tickets")
          .setDescription(lines.length ? lines.join("\n") : "ไม่มี Ticket ที่เปิดอยู่")
          .setFooter({ text: `${tickets.length} active ticket(s)` }),
      ],
      ephemeral: true,
    });
    return;
  }

  const current = await ticketService.getByChannel(guild.id, interaction.channelId);

  if (!current) {
    await interaction.reply({
      content: "❌ คำสั่งนี้ต้องใช้ภายในห้อง Ticket",
      ephemeral: true,
    });
    return;
  }

  if (sub === "info") {
    await ticketService.assertCanView(guild, current, interaction.user.id);
    await interaction.reply({
      embeds: [ticketUiService.ticketEmbed(current)],
      ephemeral: true,
    });
    return;
  }

  const target = interaction.options.getUser("user", true);

  if (target.bot) {
    await interaction.reply({
      content: "❌ ไม่สามารถเพิ่ม Bot เข้า Ticket ได้",
      ephemeral: true,
    });
    return;
  }

  if (sub === "add") {
    await ticketService.addParticipant(
      guild,
      current.ticketId,
      interaction.user.id,
      target.id,
    );
    await interaction.reply({
      content: `✅ เพิ่ม <@${target.id}> เข้า Ticket แล้ว`,
    });
    return;
  }

  if (sub === "remove") {
    await ticketService.removeParticipant(
      guild,
      current.ticketId,
      interaction.user.id,
      target.id,
    );
    await interaction.reply({
      content: `✅ ลบ <@${target.id}> ออกจาก Ticket แล้ว`,
    });
  }
}
