import {
  type Message,
  type TextChannel,
} from "discord.js";

import {
  levelingService,
} from "../services/levelingService.js";

export const name = "messageCreate";

export async function execute(
  message: Message,
): Promise<void> {
  if (message.author.bot) {
    return;
  }

  if (!message.guild) {
    return;
  }

  try {
    const result =
      await levelingService.processMessage(
        message.author.id,
      );

    if (!result.leveledUp) {
      return;
    }

    if (
      !message.channel.isTextBased() ||
      !("send" in message.channel)
    ) {
      return;
    }

    await message.channel.send(
      `🎉 **Level Up!** <@${message.author.id}> ขึ้นเป็น **Level ${result.newLevel}** แล้ว! ✨`,
    );
  } catch (error) {
    console.error(
      `❌ Leveling failed for ${message.author.id}:`,
      error,
    );
  }
}
