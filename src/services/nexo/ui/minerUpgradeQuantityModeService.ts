const maxUsers =
  new Set<string>();

export const minerUpgradeQuantityModeService = {
  isMax(
    discordId: string,
  ) {
    return maxUsers.has(
      discordId,
    );
  },

  setMax(
    discordId: string,
  ) {
    maxUsers.add(
      discordId,
    );
  },

  clearMax(
    discordId: string,
  ) {
    maxUsers.delete(
      discordId,
    );
  },
};
