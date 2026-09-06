import {
  Shop,
} from "../models/Shop.js";

export type DayName =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export interface Schedule {
  enabled: boolean;
  open: string;
  close: string;
}

export interface ShopOpenStatus {
  open: boolean;
  reason: string;
  schedule: Schedule | null;
}

const DAY_NAMES: DayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function isValidTime(
  value: string,
): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(
    value,
  );
}

export function parseSchedule(
  value: string,
): Schedule {
  const input =
    value.trim().toLowerCase();

  if (
    input === "closed" ||
    input === "close" ||
    input === "ปิด"
  ) {
    return {
      enabled: false,
      open: "00:00",
      close: "00:00",
    };
  }

  const match =
    input.match(
      /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/,
    );

  if (!match) {
    throw new Error(
      "รูปแบบเวลาต้องเป็น HH:MM-HH:MM เช่น 09:00-22:00 หรือ closed",
    );
  }

  const open =
    match[1];

  const close =
    match[2];

  if (
    !isValidTime(open) ||
    !isValidTime(close)
  ) {
    throw new Error(
      "เวลาไม่ถูกต้อง ต้องอยู่ในรูปแบบ 00:00 ถึง 23:59",
    );
  }

  return {
    enabled: true,
    open,
    close,
  };
}

function getTimezoneParts(
  date: Date,
  timezone: string,
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          timezone,
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      },
    );

  const parts =
    formatter.formatToParts(
      date,
    );

  const get =
    (type: string) =>
      parts.find(
        (part) =>
          part.type === type,
      )?.value;

  return {
    weekday:
      get("weekday")!
        .toLowerCase(),
    hour:
      Number(
        get("hour"),
      ),
    minute:
      Number(
        get("minute"),
      ),
  };
}

function timeToMinutes(
  value: string,
): number {
  const [hours, minutes] =
    value
      .split(":")
      .map(Number);

  return (
    hours * 60 +
    minutes
  );
}

export function isShopOpenAt(
  shop: any,
  date = new Date(),
): ShopOpenStatus {
  if (
    shop.status !==
      "verified" &&
    shop.status !==
      "pending"
  ) {
    return {
      open: false,
      reason:
        "ร้านค้าไม่พร้อมรับคำสั่งซื้อ",
      schedule: null,
    };
  }

  if (
    !shop.autoOpenClose
  ) {
    return {
      open: true,
      reason:
        "ระบบเปิด/ปิดตามเวลาทำการถูกปิด",
      schedule: null,
    };
  }

  const timezone =
    shop.timezone ??
    "Asia/Bangkok";

  let parts;

  try {
    parts =
      getTimezoneParts(
        date,
        timezone,
      );
  } catch {
    return {
      open: false,
      reason:
        "Timezone ของร้านไม่ถูกต้อง",
      schedule: null,
    };
  }

  const day =
    parts.weekday as DayName;

  const schedule =
    shop.businessHours?.[
      day
    ] as Schedule | undefined;

  if (!schedule) {
    return {
      open: false,
      reason:
        "วันนี้ร้านปิด",
      schedule: null,
    };
  }

  if (
    !schedule.enabled
  ) {
    return {
      open: false,
      reason:
        "วันนี้ร้านปิด",
      schedule,
    };
  }

  const current =
    parts.hour * 60 +
    parts.minute;

  const open =
    timeToMinutes(
      schedule.open,
    );

  const close =
    timeToMinutes(
      schedule.close,
    );

  let isOpen = false;

  /*
   * 09:00 -> 22:00
   */
  if (open < close) {
    isOpen =
      current >= open &&
      current < close;
  }

  /*
   * 22:00 -> 02:00
   *
   * รองรับร้านที่เปิดข้ามวัน
   */
  else if (open > close) {
    isOpen =
      current >= open ||
      current < close;
  }

  /*
   * 00:00 -> 00:00
   * ถือว่าเปิด 24 ชั่วโมง
   */
  else {
    isOpen = true;
  }

  return {
    open: isOpen,
    reason: isOpen
      ? "ร้านเปิดอยู่"
      : "ร้านปิดอยู่ในขณะนี้",
    schedule,
  };
}

export async function getShopOpenStatus(
  shopId: string,
): Promise<ShopOpenStatus> {
  const shop =
    await Shop.findOne({
      shopId,
    });

  if (!shop) {
    throw new Error(
      "ไม่พบร้านค้า",
    );
  }

  return isShopOpenAt(
    shop,
  );
}

export async function updateShopHours(
  shopId: string,
  businessHours: Record<
    DayName,
    Schedule
  >,
  timezone =
    "Asia/Bangkok",
): Promise<void> {
  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          timezone,
      },
    );
  } catch {
    throw new Error(
      "Timezone ไม่ถูกต้อง เช่น Asia/Bangkok",
    );
  }

  await Shop.findOneAndUpdate(
    {
      shopId,
    },
    {
      $set: {
        businessHours,
        timezone,
        autoOpenClose: true,
      },
    },
  );
}

export function getDefaultSchedule(
): Schedule {
  return {
    enabled: true,
    open: "09:00",
    close: "22:00",
  };
}

export function ensureBusinessHours(
  shop: any,
): Record<
  DayName,
  Schedule
> {
  const result =
    {} as Record<
      DayName,
      Schedule
    >;

  for (const day of DAY_NAMES) {
    result[day] =
      shop.businessHours?.[
        day
      ] ?? getDefaultSchedule();
  }

  return result;
}
