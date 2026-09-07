
import type {

  Client,

} from "discord.js";

import {

  MinerRareDropEvent,

} from "../../models/MinerRareDropEvent.js";

import {

  MINER_RARITY_MAP,

} from "../../game/nexoMiner/rarityCatalog.js";

import {

  MINER_ITEM_MAP,

} from "../../game/nexoMiner/itemCatalog.js";

import {

  PICKAXE_MAP,

} from "../../game/nexoMiner/pickaxeCatalog.js";

import {

  env,

} from "../../config/env.js";

import {

  toSuffix,

} from "./NexoNumber.js";

let discordClient:

  Client |

  null =

    null;

export function setMinerDiscordClient(

  client:

    Client,

) {

  discordClient =

    client;

}

function nameFor(

  event:

    any,

) {

  if (

    event.dropType ===

    "item"

  ) {

    return (

      MINER_ITEM_MAP.get(

        event.definitionId,

      )?.name ??

      event.definitionId

    );

  }

  if (

    event.dropType ===

    "pickaxe"

  ) {

    return (

      PICKAXE_MAP.get(

        event.definitionId,

      )?.name ??

      event.definitionId

    );

  }

  return event

    .definitionId;

}

export const minerRareDropNotificationService = {

  async notifyPending(

    limit =

      25,

  ) {

    if (!discordClient) {

      return {

        checked: 0,

        sent: 0,

        failed: 0,

      };

    }

    const events =

      await MinerRareDropEvent

        .find({

          status:

            "pending",

        })

        .sort({

          createdAt:

            1,

        })

        .limit(

          limit,

        );

    let sent =

      0;

    let failed =

      0;

    for (

      const event

      of events

    ) {

      try {

        const rarity =

          MINER_RARITY_MAP.get(

            event.rarity as

              any,

          );

        const title =

          `${rarity?.emoji ?? "🌟"} ${rarity?.name ?? event.rarity}`;

        const content = [

          `${title} **RARE DROP!**`,

          "",

          `<@${event.discordId}> พบ **${nameFor(event)}**`,

          `💎 Networth: **${toSuffix(event.netWorth)}**`,

        ].join(

          "\n",

        );

        let delivered =

          false;

        try {

          const user =

            await discordClient

              .users

              .fetch(

                event.discordId,

              );

          await user.send({

            content,

          });

          delivered =

            true;

        } catch {

          // public channel อาจยังส่งได้

        }

        if (

          env

            .NEXO_MINER_ANNOUNCEMENT_CHANNEL_ID &&

          (

            rarity?.tier ??

            0

          ) >=

            10

        ) {

          try {

            const channel =

              await discordClient

                .channels

                .fetch(

                  env

                    .NEXO_MINER_ANNOUNCEMENT_CHANNEL_ID,

                );

            if (

              channel &&

              "send" in

                channel &&

              typeof channel.send ===

                "function"

            ) {

              await channel.send({

                content,

              });

              delivered =

                true;

            }

          } catch {

            // DM อาจส่งสำเร็จแล้ว

          }

        }

        if (!delivered) {

          throw new Error(

            "ไม่สามารถส่ง Rare Drop notification ได้",

          );

        }

        event.status =

          "sent";

        event.sentAt =

          new Date();

        event.lastAttemptAt =

          new Date();

        event.attempts++;

        event.lastError =

          null;

        await event.save();

        sent++;

      } catch (error) {

        event.attempts++;

        event.lastAttemptAt =

          new Date();

        event.lastError =

          (

            error instanceof Error

              ? error.message

              : String(

                  error,

                )

          ).slice(

            0,

            1000,

          );

        await event.save();

        failed++;

      }

    }

    return {

      checked:

        events.length,

      sent,

      failed,

    };

  },

};

