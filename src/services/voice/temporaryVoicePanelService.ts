import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type Message,
  type TextChannel,
} from "discord.js";

import {
  TemporaryVoiceConfig,
} from "../../models/TemporaryVoiceConfig.js";

import {
  temporaryVoiceService,
} from "./temporaryVoiceService.js";

import {
  TEMP_VOICE_PANEL_TITLE,
  buildTemporaryVoiceStaticPanel,
  buildTemporaryVoiceStaticPanelEmbed,
} from "./temporaryVoiceUi.js";

const PANEL_CHANNEL_NAME =
  "🎛️・ควบคุมห้องส่วนตัว";

async function fetchTextChannel(
  guild: Guild,
  channelId:
    string |
    null |
    undefined,
): Promise<TextChannel | null> {
  if (!channelId) {
    return null;
  }

  const channel =
    await guild.channels
      .fetch(
        channelId,
      )
      .catch(
        () =>
          null,
      );

  if (
    !channel ||
    channel.type !==
      ChannelType.GuildText
  ) {
    return null;
  }

  return channel;
}

function panelPayload() {
  return {
    embeds: [
      buildTemporaryVoiceStaticPanelEmbed(),
    ],

    components:
      buildTemporaryVoiceStaticPanel(),
  };
}

export const temporaryVoicePanelService = {
  async ensurePanel(
    guild: Guild,
  ) {
    const {
      config,
      category,
      hub,
    } =
      await temporaryVoiceService
        .ensureSetup(
          guild,
        );

    const me =
      guild.members.me;

    if (!me) {
      throw new Error(
        "ไม่พบ NEXORA member ใน Server",
      );
    }

    let panelChannel =
      await fetchTextChannel(
        guild,
        config.panelChannelId,
      );

    if (!panelChannel) {
      const existing =
        guild.channels.cache
          .find(
            (
              channel,
            ) =>
              channel.type ===
                ChannelType.GuildText &&
              channel.name ===
                PANEL_CHANNEL_NAME,
          );

      if (
        existing &&
        existing.type ===
          ChannelType.GuildText
      ) {
        panelChannel =
          existing;
      } else {
        panelChannel =
          await guild.channels.create({
            name:
              PANEL_CHANNEL_NAME,

            type:
              ChannelType.GuildText,

            parent:
              category.id,

            permissionOverwrites: [
              {
                id:
                  guild.roles.everyone.id,

                deny: [
                  PermissionFlagsBits
                    .SendMessages,
                ],
              },

              {
                id:
                  me.id,

                allow: [
                  PermissionFlagsBits
                    .ViewChannel,

                  PermissionFlagsBits
                    .SendMessages,

                  PermissionFlagsBits
                    .ReadMessageHistory,
                ],
              },
            ],

            reason:
              "NEXORA Permanent Temporary Voice Control Panel",
          });
      }
    }

    if (
      panelChannel.parentId !==
      category.id
    ) {
      await panelChannel.setParent(
        category.id,
        {
          lockPermissions:
            false,
        },
      );
    }

    await panelChannel
      .permissionOverwrites
      .edit(
        guild.roles.everyone,
        {
          SendMessages:
            false,
        },
        {
          reason:
            "NEXORA Permanent Voice Panel",
        },
      );

    await panelChannel
      .permissionOverwrites
      .edit(
        me,
        {
          ViewChannel:
            true,

          SendMessages:
            true,

          ReadMessageHistory:
            true,
        },
        {
          reason:
            "NEXORA Permanent Voice Panel",
        },
      );

    let panelMessage:
      Message |
      null =
        null;

    if (
      config.panelMessageId
    ) {
      panelMessage =
        await panelChannel.messages
          .fetch(
            config.panelMessageId,
          )
          .catch(
            () =>
              null,
          );
    }

    if (!panelMessage) {
      const recent =
        await panelChannel.messages
          .fetch({
            limit:
              50,
          })
          .catch(
            () =>
              null,
          );

      panelMessage =
        recent
          ?.find(
            (
              message,
            ) =>
              message.author.id ===
                guild.client.user?.id &&
              message.embeds[
                0
              ]?.title ===
                TEMP_VOICE_PANEL_TITLE,
          ) ??
        null;
    }

    if (panelMessage) {
      await panelMessage.edit(
        panelPayload(),
      );
    } else {
      panelMessage =
        await panelChannel.send(
          panelPayload(),
        );
    }

    config.panelChannelId =
      panelChannel.id;

    config.panelMessageId =
      panelMessage.id;

    await config.save();

    return {
      config,
      category,
      hub,
      panelChannel,
      panelMessage,
    };
  },

  async handleDeletedChannel(
    guildId: string,
    channelId: string,
  ): Promise<boolean> {
    const config =
      await TemporaryVoiceConfig
        .findOne({
          guildId,
        });

    if (!config) {
      return false;
    }

    const relevant =
      config.panelChannelId ===
        channelId ||
      config.categoryId ===
        channelId ||
      config.hubChannelId ===
        channelId;

    if (
      config.panelChannelId ===
      channelId
    ) {
      config.panelChannelId =
        null;

      config.panelMessageId =
        null;

      await config.save();
    }

    return relevant;
  },

  async handleDeletedMessage(
    guildId: string,
    messageId: string,
  ): Promise<boolean> {
    const config =
      await TemporaryVoiceConfig
        .findOne({
          guildId,
          panelMessageId:
            messageId,
        });

    if (!config) {
      return false;
    }

    config.panelMessageId =
      null;

    await config.save();

    return true;
  },
};
