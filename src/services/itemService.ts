import { Item } from "../models/Item.js";
import { Economy } from "../models/Economy.js";

export const itemService = {
  async getItem(itemId: string) {
    return Item.findOne({
      itemId,
      enabled: true,
    });
  },

  async createItem(data: {
    itemId: string;
    name: string;
    description?: string;
    type?:
      | "consumable"
      | "collectible"
      | "utility"
      | "special";
    rarity?:
      | "common"
      | "uncommon"
      | "rare"
      | "epic"
      | "legendary";
    emoji?: string;
    stackable?: boolean;
    tradeable?: boolean;
    usable?: boolean;
  }) {
    const existing = await Item.findOne({
      itemId: data.itemId,
    });

    if (existing) {
      throw new Error(
        `Item already exists: ${data.itemId}`,
      );
    }

    return Item.create({
      ...data,
      enabled: true,
    });
  },

  async addItem(
    discordId: string,
    itemId: string,
    quantity = 1,
  ) {
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Quantity must be a positive integer.",
      );
    }

    const item = await Item.findOne({
      itemId,
      enabled: true,
    });

    if (!item) {
      throw new Error("Item not found.");
    }

    let economy = await Economy.findOne({
      discordId,
    });

    if (!economy) {
      economy = new Economy({
        discordId,
        balance: 0,
        bank: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        inventory: [],
      });
    }

    const inventoryItem =
      economy.inventory.find(
        (entry) =>
          entry.itemId === itemId,
      );

    if (inventoryItem) {
      if (!item.stackable) {
        throw new Error(
          "This item is not stackable.",
        );
      }

      inventoryItem.quantity += quantity;
    } else {
      economy.inventory.push({
        itemId,
        quantity,
      });
    }

    await economy.save();

    return {
      item,
      economy,
    };
  },

  async removeItem(
    discordId: string,
    itemId: string,
    quantity = 1,
  ) {
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error(
        "Quantity must be a positive integer.",
      );
    }

    const economy =
      await Economy.findOne({
        discordId,
      });

    if (!economy) {
      throw new Error(
        "Inventory not found.",
      );
    }

    const inventoryItem =
      economy.inventory.find(
        (entry) =>
          entry.itemId === itemId,
      );

    if (
      !inventoryItem ||
      inventoryItem.quantity < quantity
    ) {
      throw new Error(
        "Insufficient item quantity.",
      );
    }

    inventoryItem.quantity -= quantity;

    if (inventoryItem.quantity <= 0) {
      const index =
        economy.inventory.findIndex(
          (entry) =>
            entry.itemId === itemId,
        );

      if (index !== -1) {
        economy.inventory.splice(index, 1);
      }
    }

    await economy.save();

    return economy;
  },

  async getInventory(
    discordId: string,
  ) {
    const economy =
      await Economy.findOne({
        discordId,
      });

    if (!economy) {
      return [];
    }

    const items = [];

    for (
      const inventoryItem of economy.inventory
    ) {
      const item =
        await Item.findOne({
          itemId:
            inventoryItem.itemId,
          enabled: true,
        });

      if (!item) {
        continue;
      }

      items.push({
        item,
        quantity:
          inventoryItem.quantity,
      });
    }

    return items;
  },
};
