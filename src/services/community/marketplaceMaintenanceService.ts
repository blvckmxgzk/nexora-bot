import {
  env,
} from "../../config/env.js";

import {
  SystemState,
} from "../../models/SystemState.js";

const CUSTOMER_COMMANDS =
  new Set([
    "shop",
    "shop-panel",
    "shop-verification-panel",
    "transaction-status",
  ]);

const CUSTOMER_INTERACTION_PREFIXES = [
  "marketplace",
  "shop-",
  "product-",
  "order-",
  "payment-",
  "refund-",
];

const DEFAULT_REASON =
  "NEXORA Marketplace กำลังอยู่ระหว่างการเตรียมเปิดให้บริการอย่างเป็นทางการ";

export const marketplaceMaintenanceService = {
  isHardLocked():
    boolean {
    return (
      env.MARKETPLACE_MAINTENANCE ===
      true
    );
  },

  async getState() {
    const state =
      await SystemState
        .findById(
          "global",
        );

    const runtimeEnabled =
      state
        ?.marketplaceMaintenance ??
      true;

    return {
      enabled:
        this.isHardLocked() ||
        runtimeEnabled,

      hardLocked:
        this.isHardLocked(),

      reason:
        state
          ?.marketplaceMaintenanceReason ||
        DEFAULT_REASON,

      updatedBy:
        state
          ?.marketplaceMaintenanceUpdatedBy ??
        null,

      updatedAt:
        state
          ?.marketplaceMaintenanceUpdatedAt ??
        null,
    };
  },

  async setEnabled(
    enabled:
      boolean,

    actorId:
      string,

    reason?:
      string,
  ) {
    if (
      !enabled &&
      this.isHardLocked()
    ) {
      throw new Error(
        "Marketplace ถูก Hard Lock ด้วย MARKETPLACE_MAINTENANCE=true กรุณาเปลี่ยน Environment ก่อน",
      );
    }

    const cleanReason =
      reason
        ?.trim()
        .slice(
          0,
          1000,
        ) ||
      DEFAULT_REASON;

    return SystemState
      .findByIdAndUpdate(
        "global",
        {
          $set: {
            marketplaceMaintenance:
              enabled,

            marketplaceMaintenanceReason:
              cleanReason,

            marketplaceMaintenanceUpdatedBy:
              actorId,

            marketplaceMaintenanceUpdatedAt:
              new Date(),
          },
        },
        {
          new:
            true,

          upsert:
            true,

          setDefaultsOnInsert:
            true,
        },
      );
  },

  async shouldBlockCommand(
    commandName:
      string,
  ) {
    if (
      !CUSTOMER_COMMANDS.has(
        commandName,
      )
    ) {
      return false;
    }

    return (
      await this.getState()
    ).enabled;
  },

  async shouldBlockCustomId(
    customId:
      string,
  ) {
    const marketplaceInteraction =
      CUSTOMER_INTERACTION_PREFIXES
        .some(
          (
            prefix,
          ) =>
            customId.startsWith(
              prefix,
            ),
        );

    if (
      !marketplaceInteraction
    ) {
      return false;
    }

    return (
      await this.getState()
    ).enabled;
  },

  getMaintenanceMessage(
    reason?:
      string,
  ) {
    return [
      "🔧 **NEXORA Marketplace — Maintenance**",
      "",
      reason ||
        DEFAULT_REASON,
      "",
      "ขณะนี้ยังไม่เปิด:",
      "• การสร้างร้านค้า",
      "• การสั่งซื้อสินค้า",
      "• การชำระเงินจริง",
      "• การจัดการสินค้า/ร้านค้าสำหรับสมาชิก",
      "",
      "ระบบ Community, NEXO, Ticket และระบบสมาชิกยังใช้งานได้ตามปกติ",
    ].join(
      "\n",
    );
  },
};
