import {
  Schema,
  model,
} from "mongoose";

const systemStateSchema =
  new Schema(
    {
      _id: {
        type: String,
        default: "global",
      },

      marketplaceMaintenance: {
        type: Boolean,
        default: true,
      },

      marketplaceMaintenanceReason: {
        type: String,
        default:
          "NEXORA Marketplace กำลังอยู่ระหว่างการเตรียมเปิดให้บริการอย่างเป็นทางการ",
        maxlength: 1000,
      },

      marketplaceMaintenanceUpdatedBy: {
        type: String,
        default: null,
      },

      marketplaceMaintenanceUpdatedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

export const SystemState =
  model(
    "SystemState",
    systemStateSchema,
  );
