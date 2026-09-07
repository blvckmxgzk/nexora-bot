import {
  Schema,
  model,
} from "mongoose";

const dayScheduleSchema =
  new Schema(
    {
      enabled: {
        type: Boolean,
        default: true,
      },

      open: {
        type: String,
        default: "09:00",
      },

      close: {
        type: String,
        default: "22:00",
      },
    },
    {
      _id: false,
    },
  );

const shopSchema =
  new Schema(
    {
      shopId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      ownerId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },

      forumThreadId: {
        type: String,
        default: null,
        index: true,
      },

      /*
       * Permanent archive:
       *
       * ห้าม hard-delete Shop ที่เคยมี
       * financial history
       */
      archivedForumThreadId: {
        type: String,
        default: null,
        index: true,
      },

      deletedAt: {
        type: Date,
        default: null,
        index: true,
      },

      deletedBy: {
        type: String,
        default: null,
      },

      deleteReason: {
        type: String,
        default: null,
        maxlength: 500,
      },

      name: {
        type: String,
        required: true,
        maxlength: 100,
        trim: true,
      },

      description: {
        type: String,
        default: "",
        maxlength: 1000,
        trim: true,
      },

      category: {
        type: String,
        enum: [
          "game_topup",
          "game_keys",
          "gift_cards",
          "digital_services",
          "other",
        ],
        default: "other",
      },

      status: {
        type: String,
        enum: [
          "pending",
          "verified",
          "rejected",
          "suspended",
          "closed",
        ],
        default: "pending",
        index: true,
      },

      closedFromStatus: {
        type: String,
        enum: [
          "pending",
          "verified",
          "rejected",
        ],
        default: null,
      },

      verifiedAt: {
        type: Date,
        default: null,
      },

      verifiedBy: {
        type: String,
        default: null,
      },

      rejectionReason: {
        type: String,
        default: null,
      },

      paymentMethods: {
        type: [String],
        enum: [
          "promptpay",
          "truemoney",
        ],
        default: [],
      },

      paymentDetails: {
        promptpay: {
          type: String,
          default: null,
        },

        truemoney: {
          type: String,
          default: null,
        },
      },

      rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },

      reviewCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      completedOrders: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalOrders: {
        type: Number,
        default: 0,
        min: 0,
      },

      businessHours: {
        monday: {
          type: dayScheduleSchema,
          default: () => ({}),
        },

        tuesday: {
          type: dayScheduleSchema,
          default: () => ({}),
        },

        wednesday: {
          type: dayScheduleSchema,
          default: () => ({}),
        },

        thursday: {
          type: dayScheduleSchema,
          default: () => ({}),
        },

        friday: {
          type: dayScheduleSchema,
          default: () => ({}),
        },

        saturday: {
          type: dayScheduleSchema,
          default: () => ({}),
        },

        sunday: {
          type: dayScheduleSchema,
          default: () => ({}),
        },
      },

      timezone: {
        type: String,
        default: "Asia/Bangkok",
      },

      autoOpenClose: {
        type: Boolean,
        default: true,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

/*
 * Archived Shop เป็น financial identity
 * แบบ immutable
 *
 * ป้องกัน stale Discord button หรือ service
 * เก่าทำให้ร้านที่ archive แล้วกลับมา active
 */
shopSchema.pre(
  [
    "findOneAndUpdate",
    "updateOne",
    "updateMany",
  ],
  function () {
    const update =
      this.getUpdate() as
        | Record<string, any>
        | null;

    if (!update) {
      return;
    }

    const status =
      update.$set?.status ??
      update.status;

    if (
      typeof status ===
        "string" &&
      status !==
        "closed"
    ) {
      this.where({
        deletedAt: null,
      });
    }
  },
);

shopSchema.pre(
  "save",
  function () {
    if (
      !this.isNew &&
      this.deletedAt &&
      this.isModified(
        "status",
      ) &&
      this.status !==
        "closed"
    ) {
      throw new Error(
        "ร้านค้าที่ถูก archive แล้วไม่สามารถเปิดใช้งานใหม่ได้",
      );
    }
  },
);

export const Shop =
  model(
    "Shop",
    shopSchema,
  );
