interface MinerUiPreference {
  upgradeQuantity: number;
  shopQuantity: number;
  itemUseQuantity: number;
  tradeItemQuantity: number;
}

const preferences =
  new Map<
    string,
    MinerUiPreference
  >();

function get(
  discordId: string,
): MinerUiPreference {
  let value =
    preferences.get(
      discordId,
    );

  if (!value) {
    value = {
      upgradeQuantity: 1,
      shopQuantity: 1,
      itemUseQuantity: 1,
      tradeItemQuantity: 1,
    };

    preferences.set(
      discordId,
      value,
    );
  }

  return value;
}

function normalize(
  quantity: number,
) {
  if (
    !Number.isInteger(
      quantity,
    ) ||
    quantity < 1 ||
    quantity > 100
  ) {
    throw new Error(
      "จำนวนต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ถึง 100",
    );
  }

  return quantity;
}

export const minerUiPreferenceService = {
  getUpgradeQuantity(
    discordId: string,
  ) {
    return get(
      discordId,
    ).upgradeQuantity;
  },

  setUpgradeQuantity(
    discordId: string,
    quantity: number,
  ) {
    get(
      discordId,
    ).upgradeQuantity =
      normalize(
        quantity,
      );
  },

  getShopQuantity(
    discordId: string,
  ) {
    return get(
      discordId,
    ).shopQuantity;
  },

  setShopQuantity(
    discordId: string,
    quantity: number,
  ) {
    get(
      discordId,
    ).shopQuantity =
      normalize(
        quantity,
      );
  },

  getItemUseQuantity(
    discordId: string,
  ) {
    return get(
      discordId,
    ).itemUseQuantity;
  },

  setItemUseQuantity(
    discordId: string,
    quantity: number,
  ) {
    get(
      discordId,
    ).itemUseQuantity =
      normalize(
        quantity,
      );
  },

  getTradeItemQuantity(
    discordId: string,
  ) {
    return get(
      discordId,
    ).tradeItemQuantity;
  },

  setTradeItemQuantity(
    discordId: string,
    quantity: number,
  ) {
    get(
      discordId,
    ).tradeItemQuantity =
      normalize(
        quantity,
      );
  },
};
