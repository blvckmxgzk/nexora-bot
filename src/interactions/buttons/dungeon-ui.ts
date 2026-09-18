import {
  MessageFlags,
  type ButtonInteraction,
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
    ButtonInteraction,
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

  try {
    let payload:
      any;

    switch (
      action
    ) {
      case "home":
        payload =
          await dungeonUiService
            .home(
              interaction.user.id,
              interaction.user.displayName,
            );

        break;

      case "profile":
        payload =
          await dungeonUiService
            .profile(
              interaction.user.id,
              interaction.user.displayName,
            );

        break;

      case "dungeons": {
        const dungeonId =
          parts[0] ||
          undefined;

        const rawDifficulty =
          parts[1] ??
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
              dungeonId,
              difficulty,
            );

        break;
      }

      case "inventory":
        payload =
          await dungeonUiService
            .inventory(
              interaction.user.id,
            );

        break;

      case "forge":
        payload =
          await dungeonUiService
            .forge(
              interaction.user.id,
            );

        break;

      case "equip": {
        const itemId =
          parts[0];

        if (!itemId) {
          throw new Error(
            "Item ID ไม่ถูกต้อง",
          );
        }

        payload =
          await dungeonUiService
            .equip(
              interaction.user.id,
              itemId,
            );

        break;
      }

      case "upgrade": {
        const itemId =
          parts[0];

        if (!itemId) {
          throw new Error(
            "Item ID ไม่ถูกต้อง",
          );
        }

        payload =
          await dungeonUiService
            .upgrade(
              interaction.user.id,
              itemId,
            );

        break;
      }

      case "run": {
        const dungeonId =
          parts[0];

        const rawDifficulty =
          parts[1];

        if (
          !dungeonId ||
          !rawDifficulty ||
          !isDifficulty(
            rawDifficulty,
          )
        ) {
          throw new Error(
            "Dungeon configuration ไม่ถูกต้อง",
          );
        }

        payload =
          await dungeonUiService
            .run(
              interaction.user.id,
              dungeonId,
              rawDifficulty,
              interaction.guild,
            );

        break;
      }

      case "forge_submit": {
        const slotRaw =
          parts[0];

        const materialId =
          parts[1];

        const weaponRaw =
          parts[2];

        if (
          !slotRaw ||
          !materialId ||
          !isSlot(
            slotRaw,
          )
        ) {
          throw new Error(
            "Forge configuration ไม่ถูกต้อง",
          );
        }

        let weaponType:
          DungeonWeaponType |
          null =
            null;

        if (
          weaponRaw &&
          weaponRaw !==
            "none"
        ) {
          if (
            !isWeapon(
              weaponRaw,
            )
          ) {
            throw new Error(
              "Weapon ไม่ถูกต้อง",
            );
          }

          weaponType =
            weaponRaw;
        }

        payload =
          await dungeonUiService
            .forgeSubmit(
              interaction.user.id,
              slotRaw,
              materialId,
              weaponType,
            );

        break;
      }

      case "ascend":
        payload =
          await dungeonUiService
            .ascend(
              interaction.user.id,
              interaction.user.displayName,
              interaction.guild,
            );

        break;

      default:
        throw new Error(
          "ไม่รู้จัก Dungeon action นี้",
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
