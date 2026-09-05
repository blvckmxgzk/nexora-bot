import "dotenv/config";

import {
  connectDatabase,
  disconnectDatabase,
} from "./database/connection.js";

import { Item } from "./models/Item.js";

const items = [
  {
    itemId: "mystery_box",
    name: "Mystery Box",
    description:
      "กล่องปริศนาที่สามารถใช้สำหรับระบบ Reward ในอนาคต",
    type: "consumable" as const,
    rarity: "rare" as const,
    emoji: "🎁",
    stackable: true,
    tradeable: true,
    usable: false,
  },

  {
    itemId: "nexora_token",
    name: "NEXORA Token",
    description:
      "Token พิเศษสำหรับกิจกรรมและระบบ Reward",
    type: "collectible" as const,
    rarity: "uncommon" as const,
    emoji: "🪙",
    stackable: true,
    tradeable: true,
    usable: false,
  },

  {
    itemId: "vip_ticket",
    name: "VIP Ticket",
    description:
      "ตั๋วสำหรับระบบ VIP ในอนาคต",
    type: "utility" as const,
    rarity: "epic" as const,
    emoji: "🎟️",
    stackable: true,
    tradeable: true,
    usable: true,
  },
];

async function main() {
  await connectDatabase();

  for (const item of items) {
    const existing =
      await Item.findOne({
        itemId: item.itemId,
      });

    if (existing) {
      console.log(
        `  ✓ Already exists: ${item.itemId}`,
      );
      continue;
    }

    await Item.create(item);

    console.log(
      `  ✓ Created: ${item.itemId}`,
    );
  }

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(
    "❌ Failed to seed items:",
    error,
  );

  await disconnectDatabase();

  process.exit(1);
});
