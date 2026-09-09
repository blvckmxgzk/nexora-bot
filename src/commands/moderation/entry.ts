import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import { entrySecurityService } from "../../services/community/entrySecurityService.js";
import { EntryVerificationRequest } from "../../models/EntryVerificationRequest.js";
import { adaptiveRaidService } from "../../services/community/adaptiveRaidService.js";

export const data = new SlashCommandBuilder()
  .setName("entry")
  .setDescription("NEXORA Verification / Anti-Raid Entry Security")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
  .addSubcommand((c) =>
    c
      .setName("setup")
      .setDescription("ตั้งค่า Entry Security")
      .addChannelOption((o) =>
        o
          .setName("log_channel")
          .setDescription("ห้อง Entry Security Logs")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      )
      .addChannelOption((o) =>
        o
          .setName("verification_channel")
          .setDescription("ห้อง Verify (เว้นว่างให้บอทสร้าง)")
          .addChannelTypes(ChannelType.GuildText),
      ),
  )
  .addSubcommand((c) =>
    c.setName("panel").setDescription("ส่ง Verification Panel"),
  )
  .addSubcommand((c) =>
    c.setName("status").setDescription("ดูสถานะ Entry Security"),
  )
  .addSubcommand((c) =>
    c
      .setName("approve")
      .setDescription("อนุมัติสมาชิกจาก Verification Review")
      .addUserOption((o) =>
        o.setName("user").setDescription("สมาชิก").setRequired(true),
      ),
  )
  .addSubcommand((c) =>
    c
      .setName("deny")
      .setDescription("ปฏิเสธ Verification")
      .addUserOption((o) =>
        o.setName("user").setDescription("สมาชิก").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("reason")
          .setDescription("เหตุผล")
          .setRequired(true)
          .setMaxLength(1000),
      ),
  )
  .addSubcommand((c) =>
    c
      .setName("raid-mode")
      .setDescription("เปิด/ปิด Entry Raid Mode")
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Enable / Disable")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      ),
  )
  .addSubcommand((c) =>
    c
      .setName("settings")
      .setDescription("ปรับ Account Age / Raid threshold")
      .addIntegerOption((o) =>
        o
          .setName("min_account_age")
          .setDescription("อายุบัญชีขั้นต่ำก่อนลดความเสี่ยง (ชั่วโมง)")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(8760),
      )
      .addIntegerOption((o) =>
        o
          .setName("auto_verify_age")
          .setDescription("อายุบัญชีที่ Auto Verify ได้ (ชั่วโมง)")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(8760),
      )
      .addIntegerOption((o) =>
        o
          .setName("raid_threshold")
          .setDescription("จำนวน Join ใน window ก่อนเปิด Raid Mode")
          .setRequired(true)
          .setMinValue(3)
          .setMaxValue(100),
      )
      .addIntegerOption((o) =>
        o
          .setName("raid_window")
          .setDescription("ระยะเวลาตรวจ Join burst เป็นวินาที")
          .setRequired(true)
          .setMinValue(10)
          .setMaxValue(300),
      ),
  )
  .addSubcommand((c) =>
    c
      .setName("adaptive")
      .setDescription("ปรับ Adaptive Raid Detection")
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Enable / Disable")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addNumberOption((o) =>
        o
          .setName("multiplier")
          .setDescription("Baseline multiplier เช่น 6 = 6× จากอัตราปกติ")
          .setMinValue(2)
          .setMaxValue(20),
      )
      .addIntegerOption((o) =>
        o
          .setName("min_joins")
          .setDescription("Adaptive trigger ต่ำสุดต่อ 60 วินาที")
          .setMinValue(5)
          .setMaxValue(100),
      )
      .addIntegerOption((o) =>
        o
          .setName("hard_threshold")
          .setDescription("Hard raid ceiling")
          .setMinValue(3)
          .setMaxValue(100),
      )
      .addIntegerOption((o) =>
        o
          .setName("hard_window")
          .setDescription("Hard ceiling window (วินาที)")
          .setMinValue(10)
          .setMaxValue(300),
      ),
  )
  .addSubcommand((c) =>
    c.setName("adaptive-reset").setDescription("Reset Adaptive baseline เพื่อเรียนรู้ใหม่"),
  )
  .addSubcommand((c) =>
    c.setName("pending").setDescription("ดู Verification ที่รอตรวจ"),
  );

function guildOf(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !interaction.guild) {
    throw new Error("ใช้ Entry Security ได้เฉพาะในเซิร์ฟเวอร์");
  }
  return interaction.guild;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guild = guildOf(interaction);
  const sub = interaction.options.getSubcommand();

  if (sub === "status") {
    const config = await entrySecurityService.getConfig(guild.id);
    if (!config) {
      await interaction.reply({
        content: "ℹ️ Entry Security ยังไม่ได้ Setup",
        ephemeral: true,
      });
      return;
    }

    const pending = await EntryVerificationRequest.countDocuments({
      guildId: guild.id,
      status: "pending",
    });

    const adaptive =
      adaptiveRaidService
        .getStatus(
          config,
          guild.id,
        );

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(config.raidMode ? 0xed4245 : 0x57f287)
          .setTitle("🔐 NEXORA Entry Security")
          .addFields(
            {
              name: "Status",
              value: config.enabled ? "🟢 Enabled" : "🔴 Disabled",
              inline: true,
            },
            {
              name: "Raid Mode",
              value: config.raidMode ? "🚨 ACTIVE" : "🟢 Normal",
              inline: true,
            },
            { name: "Pending", value: `**${pending}**`, inline: true },
            {
              name: "Minimum Account Age",
              value: `${config.minimumAccountAgeHours}h`,
              inline: true,
            },
            {
              name: "Auto Verify Age",
              value: `${config.autoVerifyAccountAgeHours}h`,
              inline: true,
            },
            {
              name: "Raid Trigger",
              value: `${config.raidJoinThreshold} joins / ${config.raidWindowSeconds}s`,
              inline: true,
            },
            {
              name: "Adaptive Raid",
              value: adaptive.enabled
                ? adaptive.ready
                  ? `🟢 ON • ${adaptive.multiplier}× baseline`
                  : `🟡 Learning ${adaptive.baselineSamples}/${adaptive.minSamples}`
                : "🔴 OFF",
              inline: true,
            },
            {
              name: "Learned Baseline",
              value: `${adaptive.baselinePerMinute.toFixed(2)} joins/min`,
              inline: true,
            },
            {
              name: "Adaptive Trigger",
              value: `${adaptive.threshold} joins/60s • current ${adaptive.currentPerMinute}/60s`,
              inline: true,
            },
            {
              name: "Verified Role",
              value: `<@&${config.verifiedRoleId}>`,
              inline: true,
            },
            {
              name: "Quarantine Role",
              value: `<@&${config.quarantineRoleId}>`,
              inline: true,
            },
            {
              name: "Verification Channel",
              value: `<#${config.verificationChannelId}>`,
              inline: true,
            },
          )
          .setFooter({
            text:
              process.env.NEXORA_GUILD_MEMBERS_INTENT === "true"
                ? "GuildMembers Intent: ON • automatic join quarantine active"
                : "GuildMembers Intent: OFF • button/manual verification works; automatic join quarantine unavailable",
          })
          .setTimestamp(),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    if (sub === "setup") {
      const logChannel = interaction.options.getChannel("log_channel", true);
      const verificationChannel = interaction.options.getChannel(
        "verification_channel",
      );

      const result = await entrySecurityService.setup(
        guild,
        logChannel.id,
        verificationChannel?.id ?? null,
      );

      await interaction.editReply({
        content: [
          "✅ **Entry Security พร้อมใช้งานแล้ว**",
          "",
          `Verification: <#${result.config.verificationChannelId}>`,
          `Verified: <@&${result.config.verifiedRoleId}>`,
          `Quarantine: <@&${result.config.quarantineRoleId}>`,
          "",
          process.env.NEXORA_GUILD_MEMBERS_INTENT === "true"
            ? "🟢 GuildMembers Intent ON — สมาชิกใหม่จะถูก Quarantine อัตโนมัติ"
            : "🟡 GuildMembers Intent OFF — Verify ใช้งานได้ แต่ Auto-Quarantine ตอน Join จะไม่ทำงาน",
          "",
          "ใช้ `/entry panel` เพื่อส่งปุ่ม Verify",
        ].join("\n"),
      });
      return;
    }

    if (sub === "panel") {
      const message = await entrySecurityService.sendPanel(guild);
      await interaction.editReply({
        content: `✅ ส่ง Verification Panel แล้ว: ${message.url}`,
      });
      return;
    }

    if (sub === "approve") {
      const user = interaction.options.getUser("user", true);
      await entrySecurityService.approveMember(
        guild,
        user.id,
        interaction.user.id,
      );
      await interaction.editReply({ content: `✅ อนุมัติ <@${user.id}> แล้ว` });
      return;
    }

    if (sub === "deny") {
      const user = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason", true);
      await entrySecurityService.denyMember(
        guild,
        user.id,
        interaction.user.id,
        reason,
      );
      await interaction.editReply({ content: `⛔ ปฏิเสธ <@${user.id}> แล้ว` });
      return;
    }

    if (sub === "raid-mode") {
      const enabled =
        interaction.options.getString("mode", true) === "enable";
      await entrySecurityService.setRaidMode(
        guild,
        enabled,
        interaction.user.id,
      );
      await interaction.editReply({
        content: enabled
          ? "🚨 Entry Raid Mode เปิดแล้ว — ทุก Verification จะเข้า Manual Review"
          : "✅ Entry Raid Mode ปิดแล้ว",
      });
      return;
    }

    if (sub === "settings") {
      const minimum = interaction.options.getInteger("min_account_age", true);
      const autoAge = interaction.options.getInteger("auto_verify_age", true);
      const threshold = interaction.options.getInteger("raid_threshold", true);
      const windowSeconds = interaction.options.getInteger("raid_window", true);

      const config = await entrySecurityService.updateSettings(
        guild.id,
        minimum,
        autoAge,
        threshold,
        windowSeconds,
      );

      await interaction.editReply({
        content: [
          "✅ Entry Security settings updated",
          `Minimum age: **${config.minimumAccountAgeHours}h**`,
          `Auto verify age: **${config.autoVerifyAccountAgeHours}h**`,
          `Raid threshold: **${config.raidJoinThreshold}/${config.raidWindowSeconds}s**`,
        ].join("\n"),
      });
      return;
    }

    if (
      sub ===
      "adaptive"
    ) {
      const enabled =
        interaction.options
          .getString(
            "mode",
            true,
          ) ===
        "enable";

      const multiplier =
        interaction.options
          .getNumber(
            "multiplier",
          );

      const minimumJoins =
        interaction.options
          .getInteger(
            "min_joins",
          );

      const hardThreshold =
        interaction.options
          .getInteger(
            "hard_threshold",
          );

      const hardWindowSeconds =
        interaction.options
          .getInteger(
            "hard_window",
          );

      const config =
        await adaptiveRaidService
          .updateSettings(
            guild.id,
            {
              enabled,
              multiplier,
              minimumJoins,
              hardThreshold,
              hardWindowSeconds,
            },
          );

      const adaptive =
        adaptiveRaidService
          .getStatus(
            config,
            guild.id,
          );

      await interaction.editReply({
        content: [
          "✅ Adaptive Raid settings updated",
          `Adaptive: **${adaptive.enabled ? "ON" : "OFF"}**`,
          `Baseline multiplier: **${adaptive.multiplier}×**`,
          `Minimum trigger: **${adaptive.minimumJoins}/60s**`,
          `Current learned baseline: **${adaptive.baselinePerMinute.toFixed(2)}/min**`,
          `Calculated trigger: **${adaptive.threshold}/60s**`,
          `Hard ceiling: **${config.raidJoinThreshold}/${config.raidWindowSeconds}s**`,
        ].join("\n"),
      });

      return;
    }

    if (
      sub ===
      "adaptive-reset"
    ) {
      await adaptiveRaidService
        .resetBaseline(
          guild.id,
        );

      await interaction.editReply({
        content:
          "✅ Reset Adaptive Raid baseline แล้ว • ระบบจะเรียนรู้ traffic ใหม่อย่างน้อย 5 นาที",
      });

      return;
    }

    if (sub === "pending") {
      const requests = await EntryVerificationRequest.find({
        guildId: guild.id,
        status: "pending",
      })
        .sort({ requestedAt: 1 })
        .limit(20);

      const lines = requests.length
        ? requests
            .map(
              (request) =>
                `${request.risk === "raid" || request.risk === "high" ? "🔴" : "🟡"} <@${request.userId}> • ${request.risk} • ${request.accountAgeHours.toFixed(1)}h`,
            )
            .join("\n")
        : "ไม่มี Verification ที่รอตรวจ";

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("🕵️ Pending Verification")
            .setDescription(lines)
            .setTimestamp(),
        ],
      });
    }
  } catch (error) {
    await interaction.editReply({
      content:
        error instanceof Error
          ? `❌ ${error.message}`
          : "❌ Entry Security operation failed",
    });
  }
}
