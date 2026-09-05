import { User } from "../models/User.js";

export const userService = {
  async getByDiscordId(discordId: string) {
    return User.findOne({ discordId });
  },

  async createOrUpdate(data: {
    discordId: string;
    username: string;
    avatar?: string;
  }) {
    let user = await User.findOne({
      discordId: data.discordId,
    });

    if (!user) {
      user = new User({
        discordId: data.discordId,
        username: data.username,
        avatar: data.avatar,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      });
    } else {
      user.username = data.username;

      if (data.avatar !== undefined) {
        user.avatar = data.avatar;
      }

      user.lastSeenAt = new Date();
    }

    await user.save();

    return user;
  },

  async updateLastSeen(discordId: string) {
    const user = await User.findOne({
      discordId,
    });

    if (!user) {
      return null;
    }

    user.lastSeenAt = new Date();

    await user.save();

    return user;
  },

  async softDelete(discordId: string) {
    const user = await User.findOne({
      discordId,
    });

    if (!user) {
      return null;
    }

    user.isDeleted = true;

    await user.save();

    return user;
  },
};
