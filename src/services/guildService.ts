import { Guild } from "../models/Guild.js";

export interface GuildSettingsUpdate {
  prefix?: string;
  language?: string;
  timezone?: string;

  moderation?: {
    enabled?: boolean;
    autoModEnabled?: boolean;
    logChannelId?: string | null;
  };

  economy?: {
    enabled?: boolean;
    currencyName?: string;
    currencySymbol?: string;
  };

  ticket?: {
    enabled?: boolean;
    categoryId?: string | null;
    supportRoleId?: string | null;
  };
}

export const guildService = {
  async getByDiscordId(discordId: string) {
    return Guild.findOne({ discordId });
  },

  async createOrUpdate(data: {
    discordId: string;
    name: string;
  }) {
    let guild = await Guild.findOne({
      discordId: data.discordId,
    });

    if (!guild) {
      guild = new Guild({
        discordId: data.discordId,
        name: data.name,
      });
    } else {
      guild.name = data.name;
    }

    await guild.save();

    return guild;
  },

  async updateSettings(
    discordId: string,
    settings: GuildSettingsUpdate,
  ) {
    let guild = await Guild.findOne({
      discordId,
    });

    if (!guild) {
      guild = new Guild({
        discordId,
        name: "Unknown Guild",
      });
    }

    const currentSettings =
      guild.settings ?? {
        prefix: "!",
        language: "th",
        timezone: "Asia/Bangkok",
      };

    guild.settings = {
      prefix:
        settings.prefix ??
        currentSettings.prefix,

      language:
        settings.language ??
        currentSettings.language,

      timezone:
        settings.timezone ??
        currentSettings.timezone,
    };

    const currentModeration =
      guild.moderation ?? {
        enabled: true,
        autoModEnabled: false,
        logChannelId: null,
      };

    if (settings.moderation) {
      guild.moderation = {
        enabled:
          settings.moderation.enabled ??
          currentModeration.enabled,

        autoModEnabled:
          settings.moderation.autoModEnabled ??
          currentModeration.autoModEnabled,

        logChannelId:
          settings.moderation.logChannelId !==
          undefined
            ? settings.moderation.logChannelId
            : currentModeration.logChannelId,
      };
    }

    const currentEconomy =
      guild.economy ?? {
        enabled: true,
        currencyName: "NEXO",
        currencySymbol: "N",
      };

    if (settings.economy) {
      guild.economy = {
        enabled:
          settings.economy.enabled ??
          currentEconomy.enabled,

        currencyName:
          settings.economy.currencyName ??
          currentEconomy.currencyName,

        currencySymbol:
          settings.economy.currencySymbol ??
          currentEconomy.currencySymbol,
      };
    }

    const currentTicket =
      guild.ticket ?? {
        enabled: true,
        categoryId: null,
        supportRoleId: null,
      };

    if (settings.ticket) {
      guild.ticket = {
        enabled:
          settings.ticket.enabled ??
          currentTicket.enabled,

        categoryId:
          settings.ticket.categoryId !==
          undefined
            ? settings.ticket.categoryId
            : currentTicket.categoryId,

        supportRoleId:
          settings.ticket.supportRoleId !==
          undefined
            ? settings.ticket.supportRoleId
            : currentTicket.supportRoleId,
      };
    }

    await guild.save();

    return guild;
  },
};
