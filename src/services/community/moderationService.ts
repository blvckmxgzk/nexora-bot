import crypto from "node:crypto";

import {
  ModerationLog,
} from "../../models/ModerationLog.js";

function createCaseId():
  string {
  return (
    "MOD-" +
    crypto
      .randomBytes(6)
      .toString("hex")
      .toUpperCase()
  );
}

export const moderationService = {
  async createCase(
    data: {
      guildId:
        string;

      targetUserId:
        string;

      moderatorId:
        string;

      action:
        string;

      reason?:
        string;

      duration?:
        number |
        null;

      metadata?:
        Record<
          string,
          unknown
        >;
    },
  ) {
    return ModerationLog
      .create({
        caseId:
          createCaseId(),

        guildId:
          data.guildId,

        targetUserId:
          data.targetUserId,

        moderatorId:
          data.moderatorId,

        action:
          data.action,

        reason:
          data.reason
            ?.trim()
            .slice(
              0,
              1000,
            ) ||
          "ไม่ระบุเหตุผล",

        duration:
          data.duration ??
          null,

        active:
          true,

        metadata:
          data.metadata ??
          {},
      });
  },

  async getActiveWarnings(
    guildId:
      string,

    targetUserId:
      string,
  ) {
    return ModerationLog
      .find({
        guildId,

        targetUserId,

        action:
          "warn",

        active:
          true,
      })
      .sort({
        createdAt:
          -1,
      });
  },

  async clearWarning(
    data: {
      guildId:
        string;

      caseId:
        string;

      moderatorId:
        string;

      reason:
        string;
    },
  ) {
    const warning =
      await ModerationLog
        .findOne({
          guildId:
            data.guildId,

          caseId:
            data.caseId,

          action:
            "warn",

          active:
            true,
        });

    if (!warning) {
      throw new Error(
        "ไม่พบ Warning Case ที่ active",
      );
    }

    warning.active =
      false;

    warning.resolvedAt =
      new Date();

    warning.resolvedBy =
      data.moderatorId;

    warning.resolutionReason =
      data.reason;

    await warning.save();

    const reversal =
      await this.createCase({
        guildId:
          data.guildId,

        targetUserId:
          warning.targetUserId,

        moderatorId:
          data.moderatorId,

        action:
          "unwarn",

        reason:
          data.reason,

        metadata: {
          originalCaseId:
            warning.caseId,
        },
      });

    return {
      warning,
      reversal,
    };
  },

  async getHistory(
    guildId:
      string,

    targetUserId?:
      string,

    limit =
      10,
  ) {
    return ModerationLog
      .find({
        guildId,

        ...(targetUserId
          ? {
              targetUserId,
            }
          : {}),
      })
      .sort({
        createdAt:
          -1,
      })
      .limit(
        Math.max(
          1,
          Math.min(
            25,
            limit,
          ),
        ),
      );
  },
};
