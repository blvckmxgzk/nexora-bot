import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type TextChannel,
  type User,
} from "discord.js";

import { EntrySecurityConfig } from "../../models/EntrySecurityConfig.js";
import { EntryVerificationRequest } from "../../models/EntryVerificationRequest.js";
import { securityService } from "./securityService.js";
import { adaptiveRaidService } from "./adaptiveRaidService.js";

function ageHours(user: User) {
  return Math.max(0, (Date.now() - user.createdTimestamp) / 3_600_000);
}

async function getTextChannel(guild: Guild, id: string) {
  const channel = await guild.channels.fetch(id).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return null;
  return channel as TextChannel;
}

function riskFor(age: number, raid: boolean, minimum: number, autoAge: number) {
  if (raid) return "raid" as const;
  if (age < minimum) return "high" as const;
  if (age < autoAge) return "medium" as const;
  return "low" as const;
}

async function sendLog(
  guild: Guild,
  config: any,
  title: string,
  description: string,
  color = 0x5865f2,
) {
  const channel = await getTextChannel(guild, config.logChannelId);
  if (!channel) return;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setFooter({ text: "NEXORA • Entry Security" })
        .setTimestamp(),
    ],
  });
}

export const entrySecurityService = {
  async getConfig(guildId: string) {
    return EntrySecurityConfig.findOne({ guildId });
  },

  async requireConfig(guildId: string) {
    const config = await this.getConfig(guildId);
    if (!config) throw new Error("Entry Security ยังไม่ได้ตั้งค่า — ใช้ `/entry setup` ก่อน");
    return config;
  },

  async setup(guild: Guild, logChannelId: string, verificationChannelId?: string | null) {
    const logChannel = await getTextChannel(guild, logChannelId);
    if (!logChannel) throw new Error("Log Channel ต้องเป็น Text Channel");

    let verifiedRole = guild.roles.cache.find(
      (role) => role.name === "✅ Verified" && !role.managed,
    );
    if (!verifiedRole) {
      verifiedRole = await guild.roles.create({
        name: "✅ Verified",
        reason: "NEXORA Entry Security setup",
      });
    }

    let quarantineRole = guild.roles.cache.find(
      (role) => role.name === "🔒 Quarantine" && !role.managed,
    );
    if (!quarantineRole) {
      quarantineRole = await guild.roles.create({
        name: "🔒 Quarantine",
        reason: "NEXORA Entry Security setup",
      });
    }

    let verifyChannel = verificationChannelId
      ? await getTextChannel(guild, verificationChannelId)
      : null;

    if (!verifyChannel) {
      verifyChannel = await guild.channels.create({
        name: "✅・verify",
        type: ChannelType.GuildText,
        topic: "NEXORA secure entry verification",
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
            ],
            deny: [PermissionFlagsBits.SendMessages],
          },
          {
            id: quarantineRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
        reason: "NEXORA Entry Security setup",
      });
    }

    // A quarantined member can read the server but cannot actively participate.
    for (const channel of guild.channels.cache.values()) {
      if (!("permissionOverwrites" in channel)) continue;
      if (channel.id === verifyChannel.id) continue;

      try {
        await channel.permissionOverwrites.edit(
          quarantineRole.id,
          {
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false,
            Connect: false,
            Speak: false,
          },
          { reason: "NEXORA quarantine policy" },
        );
      } catch {
        // Some channel types do not accept every overwrite field.
      }
    }

    const config = await EntrySecurityConfig.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          enabled: true,
          logChannelId,
          verificationChannelId: verifyChannel.id,
          verifiedRoleId: verifiedRole.id,
          quarantineRoleId: quarantineRole.id,
          policyVersion: "2026.09-entry-security-v1",
        },
        $setOnInsert: {
          minimumAccountAgeHours: 24,
          autoVerifyAccountAgeHours: 72,
          raidMode: false,
          raidJoinThreshold: 64,
          raidWindowSeconds: 60,
          adaptiveRaidEnabled: true,
          adaptiveRaidMultiplier: 6,
          adaptiveRaidMinimumJoins: 20,
          adaptiveBaselineJoinsPerMinute: 0,
          adaptiveBaselineSamples: 0,
        },
      },
      { new: true, upsert: true },
    );

    return { config, verifyChannel, verifiedRole, quarantineRole };
  },

  panel() {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("🔐 NEXORA Secure Entry")
          .setDescription(
            [
              "กดปุ่มด้านล่างเพื่อยืนยันบัญชีและเข้าสู่คอมมิวนิตี",
              "",
              "ระบบจะตรวจอายุบัญชีและสถานะ Raid โดยอัตโนมัติ",
              "บัญชีใหม่หรือช่วง Raid อาจต้องรอทีมงานตรวจสอบ",
              "",
              "NEXORA จะไม่ขอ Password, OTP, Token หรือ Cookie",
            ].join("\n"),
          )
          .setFooter({ text: "NEXORA • Verification & Anti-Raid" }),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("nexora_entry_verify")
            .setLabel("Verify")
            .setEmoji("✅")
            .setStyle(ButtonStyle.Success),
        ),
      ],
    };
  },

  async sendPanel(guild: Guild) {
    const config = await this.requireConfig(guild.id);
    const channel = await getTextChannel(guild, config.verificationChannelId);
    if (!channel) throw new Error("ไม่พบ Verification Channel");
    return channel.send(this.panel());
  },

  async quarantineMember(member: GuildMember, reason: string) {
    const config = await this.requireConfig(member.guild.id);

    if (!member.roles.cache.has(config.quarantineRoleId)) {
      await member.roles.add(
        config.quarantineRoleId,
        `NEXORA Entry Security • ${reason}`.slice(0, 500),
      );
    }

    if (member.roles.cache.has(config.verifiedRoleId)) {
      await member.roles.remove(
        config.verifiedRoleId,
        `NEXORA Entry Security • ${reason}`.slice(0, 500),
      ).catch(() => undefined);
    }
  },

  async approveMember(guild: Guild, userId: string, reviewerId: string, reason = "Approved by staff") {
    const config = await this.requireConfig(guild.id);
    const member = await guild.members.fetch(userId);

    await member.roles.add(config.verifiedRoleId, `NEXORA verification approved by ${reviewerId}`);
    await member.roles.remove(config.quarantineRoleId, `NEXORA verification approved by ${reviewerId}`).catch(() => undefined);

    await EntryVerificationRequest.findOneAndUpdate(
      { guildId: guild.id, userId },
      {
        $set: {
          status: "approved",
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          reason,
        },
        $setOnInsert: {
          accountAgeHours: ageHours(member.user),
          risk: "low",
          requestedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    await sendLog(
      guild,
      config,
      "✅ Verification Approved",
      `<@${userId}> ได้รับการอนุมัติโดย <@${reviewerId}>`,
      0x57f287,
    );

    return member;
  },

  async denyMember(guild: Guild, userId: string, reviewerId: string, reason: string) {
    const config = await this.requireConfig(guild.id);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) await this.quarantineMember(member, `Denied: ${reason}`);

    await EntryVerificationRequest.findOneAndUpdate(
      { guildId: guild.id, userId },
      {
        $set: {
          status: "denied",
          reviewedAt: new Date(),
          reviewedBy: reviewerId,
          reason,
        },
        $setOnInsert: {
          accountAgeHours: member ? ageHours(member.user) : 0,
          risk: "high",
          requestedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    await sendLog(
      guild,
      config,
      "⛔ Verification Denied",
      `<@${userId}> ถูกปฏิเสธโดย <@${reviewerId}>\n**Reason:** ${reason}`,
      0xed4245,
    );
  },

  async requestVerification(guild: Guild, user: User) {
    const config = await this.requireConfig(guild.id);
    const member = await guild.members.fetch(user.id);
    const age = ageHours(user);
    const risk = riskFor(
      age,
      config.raidMode,
      config.minimumAccountAgeHours,
      config.autoVerifyAccountAgeHours,
    );

    if (member.roles.cache.has(config.verifiedRoleId)) {
      return { status: "already_verified" as const, risk, age };
    }

    if (risk === "low") {
      await this.approveMember(
        guild,
        user.id,
        guild.client.user.id,
        "Automatic verification: established account",
      );
      return { status: "approved" as const, risk, age };
    }

    await this.quarantineMember(
      member,
      risk === "raid"
        ? "Raid mode verification hold"
        : "Account requires manual verification review",
    );

    await EntryVerificationRequest.findOneAndUpdate(
      { guildId: guild.id, userId: user.id },
      {
        $set: {
          status: "pending",
          risk,
          accountAgeHours: age,
          requestedAt: new Date(),
          reviewedAt: null,
          reviewedBy: null,
          reason: null,
        },
      },
      { upsert: true, new: true },
    );

    await sendLog(
      guild,
      config,
      risk === "raid" ? "🚨 Verification Held • Raid Mode" : "🕵️ Verification Needs Review",
      [
        `**User:** <@${user.id}>`,
        `**Account age:** ${age.toFixed(1)} ชั่วโมง`,
        `**Risk:** ${risk.toUpperCase()}`,
        "บัญชียังอยู่ใน Quarantine จนกว่าทีมงานจะอนุมัติ",
      ].join("\n"),
      risk === "raid" || risk === "high" ? 0xed4245 : 0xfee75c,
    );

    return { status: "pending" as const, risk, age };
  },

  async handleJoin(member: GuildMember) {
    const config = await this.getConfig(member.guild.id);
    if (!config || !config.enabled || member.user.bot) return;

    const detection =
      await adaptiveRaidService
        .observeJoin(
          config,
          member.guild.id,
        );

    if (
      !config.raidMode &&
      detection.triggered
    ) {
      config.raidMode = true;
      config.lastRaidTriggeredAt = new Date();
      await config.save();

      const reason =
        detection.reason === "hard_limit"
          ? `Hard limit: ${detection.hardCount}/${detection.hardWindowSeconds}s`
          : `Adaptive: ${detection.currentPerMinute}/60s • baseline ${detection.baselinePerMinute.toFixed(2)}/min • threshold ${detection.adaptiveThreshold}/min`;

      await sendLog(
        member.guild,
        config,
        "🚨 Entry Raid Mode AUTO-ENABLED",
        [
          `**Reason:** ${reason}`,
          `**Hard ceiling:** ${detection.hardThreshold}/${detection.hardWindowSeconds}s`,
          `**Adaptive baseline:** ${detection.baselinePerMinute.toFixed(2)} joins/min`,
          `**Adaptive threshold:** ${detection.adaptiveThreshold} joins/min`,
          "",
          "สมาชิกใหม่ทั้งหมดจะถูก Quarantine และต้อง Staff Review",
        ].join("\n"),
        0xed4245,
      );

      try {
        const incident =
          await securityService
            .createIncident({
              guildId: member.guild.id,
              type: "join_raid",
              severity: "critical",
              executorId: null,
              targetId: member.id,
              action: "entry_raid_mode",
              description: `Join raid detected • ${reason}`,
              metadata: {
                reason: detection.reason,
                hardCount: detection.hardCount,
                hardThreshold: detection.hardThreshold,
                hardWindowSeconds: detection.hardWindowSeconds,
                currentPerMinute: detection.currentPerMinute,
                adaptiveThreshold: detection.adaptiveThreshold,
                baselinePerMinute: detection.baselinePerMinute,
                baselineSamples: detection.baselineSamples,
              },
            });

        await securityService
          .sendIncidentLog(
            member.guild,
            incident,
          );
      } catch {
        // Security Core may not be configured yet.
      }
    }

    await this.quarantineMember(
      member,
      config.raidMode ? "Join during raid mode" : "New member verification required",
    );

    const age = ageHours(member.user);
    await EntryVerificationRequest.findOneAndUpdate(
      { guildId: member.guild.id, userId: member.id },
      {
        $set: {
          status: "pending",
          risk: riskFor(
            age,
            config.raidMode,
            config.minimumAccountAgeHours,
            config.autoVerifyAccountAgeHours,
          ),
          accountAgeHours: age,
          requestedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  },

  async setRaidMode(guild: Guild, enabled: boolean, actorId: string) {
    const config = await this.requireConfig(guild.id);
    config.raidMode = enabled;
    await config.save();

    await sendLog(
      guild,
      config,
      enabled ? "🚨 Entry Raid Mode Enabled" : "✅ Entry Raid Mode Disabled",
      `Changed by <@${actorId}>`,
      enabled ? 0xed4245 : 0x57f287,
    );

    return config;
  },

  async updateSettings(
    guildId: string,
    minimumAccountAgeHours: number,
    autoVerifyAccountAgeHours: number,
    raidJoinThreshold: number,
    raidWindowSeconds: number,
  ) {
    if (autoVerifyAccountAgeHours < minimumAccountAgeHours) {
      throw new Error("auto_verify_age ต้องมากกว่าหรือเท่ากับ min_account_age");
    }

    const config = await this.requireConfig(guildId);
    config.minimumAccountAgeHours = minimumAccountAgeHours;
    config.autoVerifyAccountAgeHours = autoVerifyAccountAgeHours;
    config.raidJoinThreshold = raidJoinThreshold;
    config.raidWindowSeconds = raidWindowSeconds;
    await config.save();
    return config;
  },
};
