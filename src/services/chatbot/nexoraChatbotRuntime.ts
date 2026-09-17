import {
  Events,
  type Client,
  type Message,
} from "discord.js";

import {
  env,
} from "../../config/env.js";

import {
  Ticket,
} from "../../models/Ticket.js";

import {
  nexoraChatbotService,
} from "./nexoraChatbotService.js";

class NexoraChatbotRuntime {
  private started =
    false;

  private client:
    Client | null =
    null;

  private readonly inFlight =
    new Set<string>();

  private readonly messageContentNotices =
    new Set<string>();

  private async isReplyToBot(
    message: Message,
    botId: string,
  ): Promise<boolean> {
    if (
      !message.reference
        ?.messageId
    ) {
      return false;
    }

    const referenced =
      await message
        .fetchReference()
        .catch(
          () => null,
        );

    return (
      referenced?.author.id ===
      botId
    );
  }

  private cleanInput(
    value: string,
    botId: string,
  ): string {
    return value
      .replace(
        new RegExp(
          `<@!?${botId}>`,
          "g",
        ),
        "",
      )
      .trim();
  }

  private async sendReply(
    message: Message,
    text: string,
  ): Promise<void> {
    const chunks =
      nexoraChatbotService
        .splitDiscordMessage(
          text,
        );

    if (
      chunks.length === 0
    ) {
      return;
    }

    await message.reply({
      content:
        chunks[0],

      allowedMentions: {
        parse:
          [],

        repliedUser:
          false,
      },
    });

    for (
      const chunk of
        chunks.slice(1)
    ) {
      if (
        message.channel
          .isSendable()
      ) {
        await message.channel.send({
          content:
            chunk,

          allowedMentions: {
            parse:
              [],
          },
        });
      }
    }
  }

  private async startTyping(
    message: Message,
  ): Promise<
    () => void
  > {
    let active =
      true;

    const send =
      async () => {
        if (!active) {
          return;
        }

        if (
          "sendTyping" in
          message.channel &&
          typeof message.channel
            .sendTyping ===
            "function"
        ) {
          await message.channel
            .sendTyping()
            .catch(
              () => undefined,
            );
        }
      };

    await send();

    const timer =
      setInterval(
        () => {
          void send();
        },
        8_000,
      );

    timer.unref();

    return () => {
      active =
        false;

      clearInterval(
        timer,
      );
    };
  }

  private readonly onReady =
    (
      client:
        Client<true>,
    ): void => {
      void (
        async () => {
          for (
            const guild of
              client.guilds.cache.values()
          ) {
            if (
              guild.id !==
              env.DISCORD_GUILD_ID
            ) {
              continue;
            }

            try {
              const config =
                await nexoraChatbotService
                  .ensureConfig(
                    guild,
                  );

              console.log(
                `🤖 NEXORA AI ready • channel=${config.channelId ?? "none"} • model=${nexoraChatbotService.getModel()} • api=${nexoraChatbotService.isConfigured() ? "configured" : "missing"}`,
              );
            } catch (
              error
            ) {
              console.error(
                "❌ NEXORA AI bootstrap failed:",
                error,
              );
            }
          }
        }
      )();
    };

  private readonly onMessageCreate =
    (
      message:
        Message,
    ): void => {
      void this.handleMessage(
        message,
      );
    };

  private async handleMessage(
    message: Message,
  ): Promise<void> {
    if (
      message.author.bot ||
      !message.guild
    ) {
      return;
    }

    if (
      message.guild.id !==
      env.DISCORD_GUILD_ID
    ) {
      return;
    }

    const botId =
      this.client?.user?.id;

    if (!botId) {
      return;
    }

    const config =
      await nexoraChatbotService
        .ensureConfig(
          message.guild,
        )
        .catch(
          (error) => {
            console.error(
              "❌ NEXORA AI config failed:",
              error,
            );

            return null;
          },
        );

    if (
      !config ||
      !config.enabled ||
      !env.NEXORA_AI_ENABLED
    ) {
      return;
    }

    if (
      (
        config.blockedChannelIds ??
        []
      ).includes(
        message.channelId,
      )
    ) {
      return;
    }

    /*
     * Chatbot ปิดใน Ticket โดย default
     */
    const ticket =
      await Ticket.findOne({
        guildId:
          message.guild.id,

        channelId:
          message.channelId,

        status: {
          $in: [
            "open",
            "claimed",
          ],
        },
      })
        .select({
          _id: 1,
        })
        .lean();

    if (ticket) {
      return;
    }

    const inAiChannel =
      Boolean(
        config.channelId &&
        message.channelId ===
          config.channelId,
      );

    const mentioned =
      Boolean(
        config.mentionEnabled &&
        message.mentions.users.has(
          botId,
        ),
      );

    const replied =
      Boolean(
        config.replyTriggerEnabled &&
        await this.isReplyToBot(
          message,
          botId,
        ),
      );

    if (
      !inAiChannel &&
      !mentioned &&
      !replied
    ) {
      return;
    }

    /*
     * ใน #nexora-ai ถ้าไม่ได้เปิด Message Content Intent
     * Discord จะไม่ส่ง content ของข้อความทั่วไปมา
     */
    if (
      inAiChannel &&
      !env.NEXORA_MESSAGE_CONTENT_INTENT &&
      !mentioned &&
      !replied &&
      !message.content
    ) {
      if (
        !this.messageContentNotices.has(
          message.channelId,
        )
      ) {
        this.messageContentNotices.add(
          message.channelId,
        );

        await this.sendReply(
          message,
          "⚠️ ห้อง NEXORA AI ยังไม่สามารถอ่านข้อความทั่วไปได้ในตอนนี้ กรุณา @NEXORA ก่อนชั่วคราว",
        ).catch(
          () => undefined,
        );
      }

      return;
    }

    const input =
      this.cleanInput(
        message.content,
        botId,
      );

    if (!input) {
      return;
    }

    if (
      input.length >
      config.maxInputChars
    ) {
      await this.sendReply(
        message,
        `ข้อความยาวเกินไปครับ ตอนนี้ NEXORA AI รับได้สูงสุด ${config.maxInputChars.toLocaleString()} ตัวอักษรต่อครั้ง`,
      );

      return;
    }

    if (
      nexoraChatbotService
        .isPrivilegedActionRequest(
          input,
        )
    ) {
      const response =
        await nexoraChatbotService
          .getTicketSuggestion(
            message.guild.id,
          );

      await this.sendReply(
        message,
        response,
      );

      return;
    }

    const limit =
      nexoraChatbotService
        .checkRateLimit(
          message.guild.id,
          message.author.id,
          config.cooldownSeconds,
          config.hourlyLimit,
        );

    if (
      !limit.allowed
    ) {
      if (
        limit.reason ===
        "cooldown"
      ) {
        await this.sendReply(
          message,
          `คุยเร็วไปนิดครับ ลองอีกครั้งในประมาณ ${limit.retryAfterSeconds} วินาที`,
        );

        return;
      }

      await this.sendReply(
        message,
        `คุณใช้ NEXORA AI ครบ ${config.hourlyLimit} ครั้งในช่วงนี้แล้ว ลองใหม่ภายหลังนะครับ`,
      );

      return;
    }

    const requestKey =
      `${message.guild.id}:${message.author.id}`;

    if (
      this.inFlight.has(
        requestKey,
      )
    ) {
      await this.sendReply(
        message,
        "ผมกำลังตอบข้อความก่อนหน้าของคุณอยู่ครับ",
      );

      return;
    }

    if (
      !nexoraChatbotService
        .isConfigured()
    ) {
      await this.sendReply(
        message,
        "⚠️ NEXORA AI ยังไม่พร้อมใช้งานในขณะนี้ กรุณาแจ้งแอดมินให้ตรวจสอบการตั้งค่า AI",
      );

      console.warn(
        "⚠️ NEXORA AI received a request but GROQ_API_KEY is missing",
      );

      return;
    }

    this.inFlight.add(
      requestKey,
    );

    const stopTyping =
      await this.startTyping(
        message,
      );

    try {
      const result =
        await nexoraChatbotService
          .generateResponse({
            guild:
              message.guild,

            channelId:
              message.channelId,

            userId:
              message.author.id,

            input,

            ttlMinutes:
              config.conversationTtlMinutes,

            maxContextMessages:
              config.maxContextMessages,

            maxOutputChars:
              config.maxOutputChars,
          });

      await this.sendReply(
        message,
        result.text,
      );

      if (
        result.usage
      ) {
        console.log(
          `🤖 NEXORA AI • user=${message.author.id} • input=${result.usage.input_tokens ?? "?"} • output=${result.usage.output_tokens ?? "?"} • total=${result.usage.total_tokens ?? "?"}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ NEXORA AI request failed for ${message.author.id}:`,
        error,
      );

      await this.sendReply(
        message,
        "⚠️ NEXORA AI ไม่สามารถตอบได้ในขณะนี้ กรุณาลองใหม่อีกครั้งภายหลัง",
      ).catch(
        () => undefined,
      );
    } finally {
      stopTyping();

      this.inFlight.delete(
        requestKey,
      );
    }
  }

  public start(
    client: Client,
  ): void {
    if (
      this.started
    ) {
      return;
    }

    this.started =
      true;

    this.client =
      client;

    client.once(
      Events.ClientReady,
      this.onReady,
    );

    client.on(
      Events.MessageCreate,
      this.onMessageCreate,
    );
  }

  public stop(): void {
    if (
      this.client
    ) {
      this.client.off(
        Events.ClientReady,
        this.onReady,
      );

      this.client.off(
        Events.MessageCreate,
        this.onMessageCreate,
      );
    }

    this.inFlight.clear();
    this.messageContentNotices.clear();

    this.client =
      null;

    this.started =
      false;
  }
}

export const nexoraChatbotRuntime =
  new NexoraChatbotRuntime();
