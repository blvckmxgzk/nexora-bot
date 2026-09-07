import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import mongoose from "mongoose";

import {
  ChannelType,
} from "discord.js";

import {
  MongoMemoryReplSet,
} from "mongodb-memory-server";

import {
  Shop,
} from "../src/models/Shop.ts";

import {
  Product,
} from "../src/models/Product.ts";

import {
  shopService,
} from "../src/services/shopService.ts";

import {
  shopDraftService,
} from "../src/services/shopDraftService.ts";

let replSet:
  | MongoMemoryReplSet
  | undefined;

let executeShopConfirm:
  | ((interaction: any) =>
      Promise<void>)
  | undefined;

interface DiscordOptions {
  suffix: string;

  preexistingRole?:
    boolean;

  failForumRefresh?:
    boolean;

  failRoleAdd?:
    boolean;

  failSuccessReply?:
    boolean;
}

function makeInteraction(
  options: DiscordOptions,
) {
  const sellerRole = {
    id:
      "role-general",
  };

  const starterMessage = {
    edit:
      vi.fn()
        .mockResolvedValue(
          undefined,
        ),
  };

  const thread = {
    id:
      `thread-${options.suffix}`,

    name:
      "🏪 Phase 4 Shop",

    archived:
      false,

    isThread:
      vi.fn(
        () => true,
      ),

    fetchStarterMessage:
      vi.fn()
        .mockResolvedValue(
          starterMessage,
        ),

    setArchived:
      vi.fn()
        .mockResolvedValue(
          undefined,
        ),

    setName:
      vi.fn()
        .mockResolvedValue(
          undefined,
        ),

    delete:
      vi.fn()
        .mockResolvedValue(
          undefined,
        ),
  };

  const forumChannel = {
    type:
      ChannelType.GuildForum,

    threads: {
      create:
        vi.fn()
          .mockResolvedValue(
            thread,
          ),
    },
  };

  const channelsFetch =
    vi.fn(
      async (
        id: string,
      ) => {
        if (
          id ===
          "forum-test"
        ) {
          return forumChannel;
        }

        if (
          id ===
          thread.id
        ) {
          if (
            options
              .failForumRefresh
          ) {
            throw new Error(
              "simulated forum refresh failure",
            );
          }

          return thread;
        }

        return null;
      },
    );

  const rolesAdd =
    options.failRoleAdd
      ? vi.fn()
          .mockRejectedValue(
            new Error(
              "simulated role add failure",
            ),
          )
      : vi.fn()
          .mockResolvedValue(
            undefined,
          );

  const rolesRemove =
    vi.fn()
      .mockResolvedValue(
        undefined,
      );

  const member = {
    roles: {
      cache: {
        has:
          vi.fn(
            () =>
              options
                .preexistingRole ??
              false,
          ),
      },

      add:
        rolesAdd,

      remove:
        rolesRemove,
    },
  };

  const editReply =
    options.failSuccessReply
      ? vi.fn()
          .mockRejectedValueOnce(
            new Error(
              "simulated success reply failure",
            ),
          )
      : vi.fn()
          .mockResolvedValue(
            undefined,
          );

  const interaction = {
    user: {
      id:
        `owner-${options.suffix}`,
    },

    client: {
      channels: {
        fetch:
          channelsFetch,
      },
    },

    guild: {
      members: {
        fetch:
          vi.fn()
            .mockResolvedValue(
              member,
            ),
      },

      roles: {
        fetch:
          vi.fn()
            .mockResolvedValue(
              sellerRole,
            ),
      },
    },

    deferUpdate:
      vi.fn()
        .mockResolvedValue(
          undefined,
        ),

    editReply,
  };

  return {
    interaction,
    forumChannel,
    thread,
    starterMessage,
    member,
    sellerRole,
    channelsFetch,
    rolesAdd,
    rolesRemove,
    editReply,
  };
}

beforeAll(
  async () => {
    process.env.DISCORD_TOKEN =
      "phase4-test";

    process.env.DISCORD_CLIENT_ID =
      "phase4-test";

    process.env.DISCORD_GUILD_ID =
      "phase4-test";

    process.env.MONGODB_URI =
      "mongodb://127.0.0.1/phase4";

    process.env
      .MARKETPLACE_FORUM_CHANNEL_ID =
      "forum-test";

    process.env
      .MARKETPLACE_VERIFICATION_PANEL_CHANNEL_ID =
      "panel-test";

    process.env
      .MARKETPLACE_VERIFICATION_REVIEW_CHANNEL_ID =
      "review-test";

    process.env
      .GENERAL_SELLER_ROLE_ID =
      "role-general";

    process.env
      .VERIFIED_SELLER_ROLE_ID =
      "role-verified";

    process.env.NODE_ENV =
      "test";

    replSet =
      await MongoMemoryReplSet
        .create({
          instanceOpts: [
            {
              launchTimeout:
                120_000,
            },
          ],

          replSet: {
            count: 1,

            storageEngine:
              "wiredTiger",
          },
        });

    await mongoose.connect(
      replSet.getUri(),
      {
        dbName:
          "nexora-marketplace-phase4",
      },
    );

    await Promise.all([
      Shop.syncIndexes(),
      Product.syncIndexes(),
    ]);

    const module =
      await import(
        "../src/interactions/buttons/shop-confirm.ts"
      );

    executeShopConfirm =
      module.execute;
  },
  120_000,
);

beforeEach(() => {
  vi.spyOn(
    console,
    "log",
  ).mockImplementation(
    () => {},
  );

  vi.spyOn(
    console,
    "warn",
  ).mockImplementation(
    () => {},
  );

  vi.spyOn(
    console,
    "error",
  ).mockImplementation(
    () => {},
  );
});

afterEach(async () => {
  vi.restoreAllMocks();

  await Promise.all([
    Shop.deleteMany({}),
    Product.deleteMany({}),
  ]);
});

afterAll(async () => {
  if (
    mongoose.connection
      .readyState !== 0
  ) {
    await mongoose.disconnect();
  }

  if (replSet) {
    await replSet.stop();
  }
});

function installDraft(
  ownerId: string,
) {
  const getSpy =
    vi.spyOn(
      shopDraftService,
      "get",
    ).mockImplementation(
      (id: string) => {
        if (
          id !== ownerId
        ) {
          return undefined;
        }

        return {
          name:
            "Phase 4 Shop",

          description:
            "Rollback test",

          category:
            "other",
        } as any;
      },
    );

  const deleteSpy =
    vi.spyOn(
      shopDraftService,
      "delete",
    ).mockImplementation(
      () => {},
    );

  return {
    getSpy,
    deleteSpy,
  };
}

describe(
  "NEXORA Marketplace Phase 4 shop provisioning rollback",
  () => {
    it(
      "creates Shop Forum and Seller role successfully",
      async () => {
        if (
          !executeShopConfirm
        ) {
          throw new Error(
            "shop-confirm unavailable",
          );
        }

        const discord =
          makeInteraction({
            suffix:
              "SUCCESS",
          });

        const draft =
          installDraft(
            discord
              .interaction
              .user.id,
          );

        await executeShopConfirm(
          discord.interaction,
        );

        const shop =
          await Shop.findOne({
            ownerId:
              discord
                .interaction
                .user.id,
          });

        expect(
          shop,
        ).not.toBeNull();

        expect(
          shop?.forumThreadId,
        ).toBe(
          discord.thread.id,
        );

        expect(
          discord.rolesAdd,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          discord.rolesRemove,
        ).not.toHaveBeenCalled();

        expect(
          discord.thread.delete,
        ).not.toHaveBeenCalled();

        expect(
          draft.deleteSpy,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      "deletes Forum thread and Shop when Forum synchronization fails",
      async () => {
        if (
          !executeShopConfirm
        ) {
          throw new Error(
            "shop-confirm unavailable",
          );
        }

        const discord =
          makeInteraction({
            suffix:
              "FORUM-FAIL",

            failForumRefresh:
              true,
          });

        const draft =
          installDraft(
            discord
              .interaction
              .user.id,
          );

        await executeShopConfirm(
          discord.interaction,
        );

        expect(
          await Shop.countDocuments({
            ownerId:
              discord
                .interaction
                .user.id,
          }),
        ).toBe(0);

        expect(
          discord.thread.delete,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          discord.rolesAdd,
        ).not.toHaveBeenCalled();

        expect(
          draft.deleteSpy,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "compensates Seller role Forum thread and Shop when role assignment fails",
      async () => {
        if (
          !executeShopConfirm
        ) {
          throw new Error(
            "shop-confirm unavailable",
          );
        }

        const discord =
          makeInteraction({
            suffix:
              "ROLE-FAIL",

            failRoleAdd:
              true,
          });

        const draft =
          installDraft(
            discord
              .interaction
              .user.id,
          );

        await executeShopConfirm(
          discord.interaction,
        );

        expect(
          discord.rolesAdd,
        ).toHaveBeenCalledTimes(
          1,
        );

        /*
         * add() error อาจ ambiguous
         * จึงต้อง attempt remove
         */
        expect(
          discord.rolesRemove,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          discord.thread.delete,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          await Shop.countDocuments({
            ownerId:
              discord
                .interaction
                .user.id,
          }),
        ).toBe(0);

        expect(
          draft.deleteSpy,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "never removes a Seller role that existed before shop creation",
      async () => {
        if (
          !executeShopConfirm
        ) {
          throw new Error(
            "shop-confirm unavailable",
          );
        }

        const discord =
          makeInteraction({
            suffix:
              "ROLE-EXISTING",

            preexistingRole:
              true,
          });

        installDraft(
          discord
            .interaction
            .user.id,
        );

        await executeShopConfirm(
          discord.interaction,
        );

        expect(
          discord.rolesAdd,
        ).not.toHaveBeenCalled();

        expect(
          discord.rolesRemove,
        ).not.toHaveBeenCalled();

        expect(
          await Shop.countDocuments({
            ownerId:
              discord
                .interaction
                .user.id,
          }),
        ).toBe(1);
      },
    );

    it(
      "does not rollback a committed Shop when only the success reply fails",
      async () => {
        if (
          !executeShopConfirm
        ) {
          throw new Error(
            "shop-confirm unavailable",
          );
        }

        const discord =
          makeInteraction({
            suffix:
              "REPLY-FAIL",

            failSuccessReply:
              true,
          });

        const draft =
          installDraft(
            discord
              .interaction
              .user.id,
          );

        await executeShopConfirm(
          discord.interaction,
        );

        expect(
          await Shop.countDocuments({
            ownerId:
              discord
                .interaction
                .user.id,
          }),
        ).toBe(1);

        expect(
          discord.thread.delete,
        ).not.toHaveBeenCalled();

        expect(
          discord.rolesRemove,
        ).not.toHaveBeenCalled();

        expect(
          draft.deleteSpy,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    it(
      "allows only one Shop when duplicate owner requests race",
      async () => {
        const ownerId =
          "owner-race";

        const results =
          await Promise.allSettled([
            shopService
              .createShop({
                ownerId,

                name:
                  "Race Shop A",

                description:
                  "test",

                category:
                  "other",
              }),

            shopService
              .createShop({
                ownerId,

                name:
                  "Race Shop B",

                description:
                  "test",

                category:
                  "other",
              }),
          ]);

        expect(
          results.filter(
            (result) =>
              result.status ===
              "fulfilled",
          ),
        ).toHaveLength(1);

        expect(
          results.filter(
            (result) =>
              result.status ===
              "rejected",
          ),
        ).toHaveLength(1);

        expect(
          await Shop.countDocuments({
            ownerId,
          }),
        ).toBe(1);

        const rejected =
          results.find(
            (result) =>
              result.status ===
              "rejected",
          );

        if (
          rejected?.status !==
          "rejected"
        ) {
          throw new Error(
            "Expected rejected duplicate Shop",
          );
        }

        expect(
          rejected.reason,
        ).toBeInstanceOf(
          Error,
        );

        expect(
          rejected.reason.message,
        ).toBe(
          "คุณมีร้านค้าอยู่แล้ว",
        );
      },
    );
  },
);
