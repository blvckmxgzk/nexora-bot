import { UserProfile } from "../models/UserProfile.js";

const XP_COOLDOWN_MS = 60_000;

const MIN_XP = 15;
const MAX_XP = 25;

function randomXp(): number {
  return (
    Math.floor(
      Math.random() * (MAX_XP - MIN_XP + 1),
    ) + MIN_XP
  );
}

export function getRequiredXp(level: number): number {
  return 100 + (level - 1) * 50;
}

export function getProgressBar(
  currentXp: number,
  requiredXp: number,
  size = 12,
): string {
  if (requiredXp <= 0) {
    return "████████████";
  }

  const progress = Math.min(
    1,
    Math.max(0, currentXp / requiredXp),
  );

  const filled = Math.floor(
    progress * size,
  );

  return (
    "█".repeat(filled) +
    "░".repeat(size - filled)
  );
}

export const levelingService = {
  async getOrCreate(discordId: string) {
    let profile = await UserProfile.findOne({
      discordId,
    });

    if (!profile) {
      profile = new UserProfile({
        discordId,
      });

      await profile.save();
    }

    return profile;
  },

  async processMessage(discordId: string) {
    let profile = await UserProfile.findOne({
      discordId,
    });

    if (!profile) {
      profile = new UserProfile({
        discordId,
      });
    }

    profile.totalMessages += 1;

    const now = Date.now();

    if (
      profile.lastXpAt &&
      now - profile.lastXpAt.getTime() <
        XP_COOLDOWN_MS
    ) {
      await profile.save();

      return {
        awardedXp: 0,
        leveledUp: false,
        oldLevel: profile.level,
        newLevel: profile.level,
        profile,
      };
    }

    const oldLevel = profile.level;
    const xp = randomXp();

    profile.xp += xp;
    profile.lastXpAt = new Date();

    let leveledUp = false;

    while (
      profile.xp >=
      getRequiredXp(profile.level)
    ) {
      profile.xp -=
        getRequiredXp(profile.level);

      profile.level += 1;
      leveledUp = true;
    }

    await profile.save();

    return {
      awardedXp: xp,
      leveledUp,
      oldLevel,
      newLevel: profile.level,
      profile,
    };
  },

  async getLeaderboard(limit = 10) {
    return UserProfile.find({})
      .sort({
        level: -1,
        xp: -1,
        totalMessages: -1,
      })
      .limit(limit);
  },

  async getRank(discordId: string) {
    const profile =
      await this.getOrCreate(discordId);

    const higherUsers =
      await UserProfile.countDocuments({
        $or: [
          {
            level: {
              $gt: profile.level,
            },
          },
          {
            level: profile.level,
            xp: {
              $gt: profile.xp,
            },
          },
        ],
      });

    return {
      profile,
      rank: higherUsers + 1,
    };
  },
};
