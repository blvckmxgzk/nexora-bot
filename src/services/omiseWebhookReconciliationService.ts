import {
  WebhookEvent,
} from "../models/WebhookEvent.js";

import {
  Payout,
} from "../models/Payout.js";

import {
  SellerPayoutAccount,
} from "../models/SellerPayoutAccount.js";

import {
  payoutService,
} from "./payoutService.js";

import {
  sellerPayoutAccountService,
} from "./sellerPayoutAccountService.js";

import {
  disputeService,
} from "./disputeService.js";

const WEBHOOK_PROCESSING_STALE_MS =
  5 * 60 * 1000;

const TRANSFER_EVENTS =
  new Set([
    "transfer.create",
    "transfer.update",
    "transfer.send",
    "transfer.pay",
    "transfer.fail",
    "transfer.destroy",
  ]);

const RECIPIENT_EVENTS =
  new Set([
    "recipient.create",
    "recipient.update",
    "recipient.activate",
    "recipient.deactivate",
    "recipient.verify",
    "recipient.destroy",
  ]);

const DISPUTE_EVENTS =
  new Set([
    "dispute.create",
    "dispute.update",
    "dispute.accept",
    "dispute.close",
  ]);

export interface OmiseReconciliationEvent {
  id?:
    string;

  key?:
    string;

  data?: {
    id?:
      string;

    metadata?: Record<
      string,
      unknown
    >;
  };
}

function metadataString(
  metadata:
    Record<
      string,
      unknown
    > |
    undefined,

  key:
    string,
): string |
  null {
  const value =
    metadata?.[key];

  return typeof value ===
    "string" &&
    value.trim()
      ? value.trim()
      : null;
}

export function isSupportedOmiseReconciliationEvent(
  key:
    string |
    undefined,
): boolean {
  if (!key) {
    return false;
  }

  return (
    TRANSFER_EVENTS.has(
      key,
    ) ||
    RECIPIENT_EVENTS.has(
      key,
    ) ||
    DISPUTE_EVENTS.has(
      key,
    )
  );
}

async function claimEvent(
  data: {
    eventId:
      string;

    eventKey:
      string;

    resourceType:
      "payout" |
      "recipient" |
      "dispute";

    resourceId:
      string;

    internalResourceId:
      string;
  },
): Promise<{
  state:
    | "claimed"
    | "duplicate"
    | "busy";

  event?:
    any;
}> {
  const now =
    new Date();

  const staleBefore =
    new Date(
      Date.now() -
        WEBHOOK_PROCESSING_STALE_MS,
    );

  let existing:
    any =
      await WebhookEvent.findOne({
        eventId:
          data.eventId,
      });

  if (
    existing?.status ===
      "processed"
  ) {
    return {
      state:
        "duplicate",

      event:
        existing,
    };
  }

  if (
    existing?.status ===
      "failed"
  ) {
    const reclaimed =
      await WebhookEvent
        .findOneAndUpdate(
          {
            eventId:
              data.eventId,

            status:
              "failed",
          },
          {
            $set: {
              status:
                "processing",

              provider:
                "omise",

              eventKey:
                data.eventKey,

              resourceType:
                data.resourceType,

              resourceId:
                data.resourceId,

              receivedAt:
                now,

              error:
                null,

              "metadata.internalResourceId":
                data.internalResourceId,
            },

            $unset: {
              processedAt:
                1,
            },
          },
          {
            new:
              true,
          },
        );

    return reclaimed
      ? {
          state:
            "claimed",

          event:
            reclaimed,
        }
      : {
          state:
            "busy",
        };
  }

  if (
    existing?.status ===
      "processing"
  ) {
    const updatedAt =
      existing.updatedAt
        ? new Date(
            existing.updatedAt,
          )
        : new Date(
            existing.receivedAt,
          );

    if (
      Number.isFinite(
        updatedAt.getTime(),
      ) &&
      updatedAt >
        staleBefore
    ) {
      return {
        state:
          "busy",
      };
    }

    const reclaimed =
      await WebhookEvent
        .findOneAndUpdate(
          {
            eventId:
              data.eventId,

            status:
              "processing",

            updatedAt: {
              $lte:
                staleBefore,
            },
          },
          {
            $set: {
              provider:
                "omise",

              eventKey:
                data.eventKey,

              resourceType:
                data.resourceType,

              resourceId:
                data.resourceId,

              receivedAt:
                now,

              error:
                null,

              "metadata.internalResourceId":
                data.internalResourceId,
            },
          },
          {
            new:
              true,
          },
        );

    return reclaimed
      ? {
          state:
            "claimed",

          event:
            reclaimed,
        }
      : {
          state:
            "busy",
        };
  }

  if (!existing) {
    try {
      const created =
        await WebhookEvent.create({
          eventId:
            data.eventId,

          provider:
            "omise",

          eventKey:
            data.eventKey,

          resourceType:
            data.resourceType,

          resourceId:
            data.resourceId,

          status:
            "processing",

          receivedAt:
            now,

          metadata: {
            internalResourceId:
              data.internalResourceId,
          },
        });

      return {
        state:
          "claimed",

        event:
          created,
      };
    } catch (
      error: any
    ) {
      if (
        error?.code ===
        11000
      ) {
        return {
          state:
            "busy",
        };
      }

      throw error;
    }
  }

  return {
    state:
      "busy",
  };
}

async function markProcessed(
  eventId:
    string,
): Promise<void> {
  const processed =
    await WebhookEvent
      .findOneAndUpdate(
        {
          eventId,

          status:
            "processing",
        },
        {
          $set: {
            status:
              "processed",

            processedAt:
              new Date(),

            error:
              null,
          },
        },
        {
          new:
            true,
        },
      );

  if (!processed) {
    throw new Error(
      "Webhook processing claim was lost",
    );
  }
}

async function markFailed(
  eventId:
    string,

  error:
    unknown,
): Promise<void> {
  const message =
    error instanceof Error
      ? error.message
      : "Webhook reconciliation failed";

  await WebhookEvent
    .findOneAndUpdate(
      {
        eventId,

        status:
          "processing",
      },
      {
        $set: {
          status:
            "failed",

          error:
            message.slice(
              0,
              2000,
            ),
        },
      },
    );
}

export const omiseWebhookReconciliationService = {
  async process(
    event:
      OmiseReconciliationEvent,
  ) {
    const eventId =
      event.id;

    const eventKey =
      event.key;

    const providerResourceId =
      event.data?.id;

    if (
      !eventId ||
      !eventKey ||
      !providerResourceId
    ) {
      throw new Error(
        "Omise reconciliation event is incomplete",
      );
    }

    if (
      DISPUTE_EVENTS.has(
        eventKey,
      )
    ) {
      const claim =
        await claimEvent({
          eventId,

          eventKey,

          resourceType:
            "dispute",

          resourceId:
            providerResourceId,

          internalResourceId:
            providerResourceId,
        });

      if (
        claim.state ===
          "duplicate"
      ) {
        return {
          success:
            true,

          duplicate:
            true,

          eventId,

          status:
            "processed",
        };
      }

      if (
        claim.state ===
          "busy"
      ) {
        return {
          success:
            false,

          retry:
            true,

          eventId,

          error:
            "Webhook is already being processed",
        };
      }

      try {
        const reconciled =
          await disputeService
            .reconcileProviderDispute(
              providerResourceId,
            );

        await markProcessed(
          eventId,
        );

        if (
          reconciled.ignored ===
          true
        ) {
          return {
            success:
              true,

            ignored:
              true,

            eventId,

            resourceType:
              "dispute",
          };
        }

        return {
          success:
            true,

          processed:
            true,

          eventId,

          resourceType:
            "dispute",

          disputeId:
            reconciled
              .dispute
              .disputeId,

          status:
            reconciled
              .dispute
              .status,
        };
      } catch (error) {
        await markFailed(
          eventId,
          error,
        );

        throw error;
      }
    }

    if (
      TRANSFER_EVENTS.has(
        eventKey,
      )
    ) {
      const payoutIdFromMetadata =
        metadataString(
          event.data
            ?.metadata,

          "nexora_payout_id",
        );

      const lookup:
        Record<
          string,
          unknown
        >[] =
        [
          {
            providerTransferId:
              providerResourceId,
          },
        ];

      /*
       * transfer.create อาจถึง NEXORA
       * ก่อน providerTransferId ถูก finalize
       * ใน Mongo
       */
      if (
        payoutIdFromMetadata
      ) {
        lookup.push({
          payoutId:
            payoutIdFromMetadata,

          provider:
            "omise",
        });
      }

      const payout =
        await Payout.findOne({
          $or:
            lookup,
        });

      if (!payout) {
        return {
          success:
            true,

          ignored:
            true,

          eventId,

          event:
            eventKey,
        };
      }

      const claim =
        await claimEvent({
          eventId,

          eventKey,

          resourceType:
            "payout",

          resourceId:
            providerResourceId,

          internalResourceId:
            payout.payoutId,
        });

      if (
        claim.state ===
          "duplicate"
      ) {
        return {
          success:
            true,

          duplicate:
            true,

          eventId,

          status:
            "processed",
        };
      }

      if (
        claim.state ===
          "busy"
      ) {
        return {
          success:
            false,

          retry:
            true,

          eventId,

          error:
            "Webhook is already being processed",
        };
      }

      try {
        const reconciled =
          await payoutService
            .reconcileProviderTransfer(
              payout.payoutId,
              providerResourceId,
            );

        await markProcessed(
          eventId,
        );

        return {
          success:
            true,

          processed:
            true,

          eventId,

          resourceType:
            "payout",

          payoutId:
            payout.payoutId,

          status:
            reconciled.status,
        };
      } catch (error) {
        await markFailed(
          eventId,
          error,
        );

        throw error;
      }
    }

    if (
      RECIPIENT_EVENTS.has(
        eventKey,
      )
    ) {
      const payoutAccountIdFromMetadata =
        metadataString(
          event.data
            ?.metadata,

          "nexora_payout_account_id",
        );

      const lookup:
        Record<
          string,
          unknown
        >[] =
        [
          {
            recipientId:
              providerResourceId,
          },
        ];

      /*
       * recipient.create อาจถึง NEXORA
       * ก่อน recipientId ถูก finalize
       */
      if (
        payoutAccountIdFromMetadata
      ) {
        lookup.push({
          payoutAccountId:
            payoutAccountIdFromMetadata,

          provider:
            "omise",
        });
      }

      const account =
        await SellerPayoutAccount
          .findOne({
            $or:
              lookup,
          });

      if (!account) {
        return {
          success:
            true,

          ignored:
            true,

          eventId,

          event:
            eventKey,
        };
      }

      const claim =
        await claimEvent({
          eventId,

          eventKey,

          resourceType:
            "recipient",

          resourceId:
            providerResourceId,

          internalResourceId:
            account.payoutAccountId,
        });

      if (
        claim.state ===
          "duplicate"
      ) {
        return {
          success:
            true,

          duplicate:
            true,

          eventId,

          status:
            "processed",
        };
      }

      if (
        claim.state ===
          "busy"
      ) {
        return {
          success:
            false,

          retry:
            true,

          eventId,

          error:
            "Webhook is already being processed",
        };
      }

      try {
        const reconciled =
          await sellerPayoutAccountService
            .reconcileProviderRecipient(
              account.payoutAccountId,
              providerResourceId,
            );

        await markProcessed(
          eventId,
        );

        return {
          success:
            true,

          processed:
            true,

          eventId,

          resourceType:
            "recipient",

          payoutAccountId:
            account.payoutAccountId,

          status:
            reconciled.status,
        };
      } catch (error) {
        await markFailed(
          eventId,
          error,
        );

        throw error;
      }
    }

    return {
      success:
        true,

      ignored:
        true,

      eventId,

      event:
        eventKey,
    };
  },
};
