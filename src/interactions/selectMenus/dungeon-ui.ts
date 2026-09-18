import {
  MessageFlags,
  type StringSelectMenuInteraction,
} from "discord.js";

import {
  DUNGEON_SLOTS,
  DUNGEON_WEAPON_TYPES,
  DIFFICULTY_DATA,
  type DungeonDifficulty,
  type DungeonSlot,
  type DungeonWeaponType,
} from "../../game/nexoDungeons/catalog.js";

import {
  dungeonUiService,
} from "../../services/dungeons/dungeonUiService.js";

export const customId =
  "nexora_dungeon:";

function isDifficulty(
  value:
    string,
): value is
  DungeonDifficulty {
  return (
    value in
    DIFFICULTY_DATA
  );
}

function isSlot(
  value:
    string,
): value is
  DungeonSlot {
  return (
    DUNGEON_SLOTS as
      readonly string[]
  ).includes(
    value,
  );
}

function isWeapon(
  value:
    string,
): value is
  DungeonWeaponType {
  return (
    DUNGEON_WEAPON_TYPES as
      readonly string[]
  ).includes(
    value,
  );
}

export async function execute(
  interaction:
    StringSelectMenuInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  const parts =
    interaction.customId
      .slice(
        customId.length,
      )
      .split(
        ":",
      );

  const action =
    parts.shift();

  const selected =
    interaction.values[0];

  try {
    if (!selected) {
      throw new Error(
        "ไม่ได้เลือกตัวเลือก",
      );
    }

    let payload:
      any;

    switch (
      action
    ) {
      case "create":
        if (
          !isWeapon(
            selected,
          )
        ) {
          throw new Error(
            "Starter Weapon ไม่ถูกต้อง",
          );
        }

        payload =
          await dungeonUiService
            .createCharacter(
              interaction.user.id,
              interaction.user.displayName,
              selected,
            );

        break;

      case "select_dungeon": {
        const rawDifficulty =
          parts[0] ??
          "normal";

        const difficulty =
          isDifficulty(
            rawDifficulty,
          )
            ? rawDifficulty
            : "normal";

        payload =
          await dungeonUiService
            .runSetup(
              interaction.user.id,
              selected,
              difficulty,
            );

        break;
      }

      case "select_difficulty": {
        const dungeonId =
          parts[0];

        if (
          !dungeonId ||
          !isDifficulty(
            selected,
          )
        ) {
          throw new Error(
            "Difficulty ไม่ถูกต้อง",
          );
        }

        payload =
          await dungeonUiService
            .runSetup(
              interaction.user.id,
              dungeonId,
              selected,
            );

        break;
      }

      case "select_item":
        payload =
          await dungeonUiService
            .item(
              interaction.user.id,
              selected,
            );

        break;

      case "forge_slot": {
        const materialId =
          parts[0];

        const rawWeapon =
          parts[1] ??
          "sword";

        if (
          !materialId ||
          !isSlot(
            selected,
          )
        ) {
          throw new Error(
            "Forge Slot ไม่ถูกต้อง",
          );
        }

        const weapon =
          isWeapon(
            rawWeapon,
          )
            ? rawWeapon
            : "sword";

        payload =
          await dungeonUiService
            .forge(
              interaction.user.id,
              selected,
              materialId,
              weapon,
            );

        break;
      }

      case "forge_material": {
        const slotRaw =
          parts[0];

        const rawWeapon =
          parts[1] ??
          "sword";

        if (
          !slotRaw ||
          !isSlot(
            slotRaw,
          )
        ) {
          throw new Error(
            "Forge Slot ไม่ถูกต้อง",
          );
        }

        const weapon =
          isWeapon(
            rawWeapon,
          )
            ? rawWeapon
            : "sword";

        payload =
          await dungeonUiService
            .forge(
              interaction.user.id,
              slotRaw,
              selected,
              weapon,
            );

        break;
      }

      case "forge_weapon": {
        const materialId =
          parts[0];

        if (
          !materialId ||
          !isWeapon(
            selected,
          )
        ) {
          throw new Error(
            "Weapon ไม่ถูกต้อง",
          );
        }

        payload =
          await dungeonUiService
            .forge(
              interaction.user.id,
              "weapon",
              materialId,
              selected,
            );

        break;
      }

      default:
        throw new Error(
          "ไม่รู้จัก Dungeon select action นี้",
        );
    }

    await interaction.editReply(
      payload,
    );
  } catch (error) {
    await interaction.followUp({
      content:
        `❌ ${
          error instanceof
            Error
            ? error.message
            : String(
                error,
              )
        }`,

      flags:
        MessageFlags.Ephemeral,
    });
  }
}
