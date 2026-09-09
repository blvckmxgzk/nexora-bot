import { Events, type GuildMember } from "discord.js";
import { entrySecurityService } from "../services/community/entrySecurityService.js";

export const name = Events.GuildMemberAdd;

export async function execute(member: GuildMember): Promise<void> {
  try {
    await entrySecurityService.handleJoin(member);
  } catch (error) {
    console.error("❌ Entry Security join handling failed:", error);
  }
}
