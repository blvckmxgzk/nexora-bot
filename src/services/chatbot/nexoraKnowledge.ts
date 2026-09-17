type KnowledgeEntry = {
  keywords: string[];
  content: string;
};

const BASE_KNOWLEDGE = `
NEXORA เป็นคอมมิวนิตี Discord แบบ All-in-One
มีระบบสมาชิก, Level/Activity, Ticket, Security,
Moderation, Marketplace, Temporary Voice และระบบเกม Economy/RPG

NEXORA AI เป็นผู้ช่วยแบบ read-only
มีหน้าที่ตอบคำถาม อธิบายระบบ และช่วยสมาชิก
แต่ไม่มีสิทธิ์ Ban, Kick, Timeout, Warn, แจก Role,
Verify Seller, ลบร้าน หรือแก้ไขฐานข้อมูลแทน Staff
`.trim();

const entries: KnowledgeEntry[] = [
  {
    keywords: [
      "สมาชิกใหม่",
      "สมาชิกประจำ",
      "สมาชิก",
      "auto role",
      "autorole",
      "member lifecycle",
      "5000",
      "5,000",
    ],

    content: `
Member Lifecycle:
- สมาชิก: ได้หลังผ่านระบบ Security และเป็น Role ถาวร
- สมาชิกใหม่: ได้เมื่อเข้าเซิร์ฟเวอร์และถูกถอดหลังครบ 1 เดือนปฏิทิน
- สมาชิกประจำ: ต้องมีข้อความอย่างน้อย 5,000 ข้อความใน Rolling 30 Days
- สมาชิกประจำเป็น Dynamic Role ถ้ายอด Rolling 30 Days ต่ำกว่า 5,000 จะถูกถอด
`.trim(),
  },

  {
    keywords: [
      "ticket",
      "ทิคเก็ต",
      "แจ้งแอดมิน",
      "แจ้ง staff",
      "ช่วยเหลือ",
      "report",
      "รายงาน",
    ],

    content: `
Ticket เป็นช่องทางหลักสำหรับเรื่องที่ต้องให้ Staff/Admin ตรวจสอบหรือดำเนินการ
เช่น การรายงานสมาชิก ปัญหาร้านค้า การร้องเรียน หรือ action ที่ NEXORA AI ไม่มีสิทธิ์ทำเอง
`.trim(),
  },

  {
    keywords: [
      "marketplace",
      "ร้าน",
      "สินค้า",
      "ผู้ขาย",
      "seller",
      "ซื้อขาย",
      "trade request",
    ],

    content: `
Marketplace กำลังปรับสถาปัตยกรรมเป็น:
Shop → Product → Trade Request → DM Handoff → Completion → Review

NEXORA จะทำหน้าที่เป็นตัวกลางในการค้นหาร้านและติดต่อผู้ขาย
ไม่ได้มีเป้าหมายถือหรือรับเงินการซื้อขายระหว่างผู้ซื้อกับผู้ขาย

เมื่อผู้ซื้อสนใจสินค้า ระบบจะสร้าง Trade Request,
แจ้งผู้ขายและผู้ซื้อผ่าน DM,
จากนั้นทั้งสองฝ่ายติดต่อและซื้อขายกันโดยตรง
เมื่อ Buyer และ Seller ยืนยันสำเร็จจึงปลดล็อก Review
`.trim(),
  },

  {
    keywords: [
      "temp voice",
      "temporary voice",
      "ห้องส่วนตัว",
      "ห้องเสียง",
      "voice",
      "สร้างห้อง",
    ],

    content: `
Temporary Voice ใช้ระบบ Join-to-Create
สมาชิกหนึ่งคนเป็นเจ้าของห้องชั่วคราวได้สูงสุด 1 ห้อง

Owner สามารถ Rename, ตั้ง User Limit, Lock/Unlock,
Hide/Show, Allow/Remove Access, Ban เฉพาะห้อง,
ปรับ Bitrate, Transfer Ownership และลบห้องได้

เมื่อห้องเหลือสมาชิก 0 คน ห้องจะถูกลบทันที
`.trim(),
  },

  {
    keywords: [
      "welcome",
      "ต้อนรับ",
      "เข้าเซิร์ฟ",
      "onboarding",
    ],

    content: `
Welcome Flow:
Member Join → Security Check → Auto Role → Public Welcome → จบ

Discord Onboarding เป็นผู้จัดการเรื่อง Role/Interest/Channel
ดังนั้น Welcome ของ NEXORA จะไม่สร้าง Role selection ซ้ำ
และข้อความ Welcome จะไม่มีปุ่มหรือ Select Menu ที่ไม่จำเป็น
`.trim(),
  },

  {
    keywords: [
      "economy",
      "rpg",
      "dungeon",
      "nexo",
      "เกม",
      "ascension",
      "อาวุธ",
    ],

    content: `
Economy Game ของ NEXORA กำลังเปลี่ยนจาก Miner ไปเป็น Dungeon/RPG

แนวทางหลัก:
- NEXO = เงิน
- Equipment = ความแข็งแกร่ง
- Materials = การพัฒนา
- Dungeon = แหล่งทรัพยากร
- Trading = Economy ระหว่างผู้เล่น
- Ascension = Long-term progression

ไม่มี Class แบบล็อกตัวละคร
Weapon เป็นตัวกำหนด Build เช่น Sword, Greatsword,
Bow, Staff, Dagger และ Shield

มี Dungeon, Monster, Elite, Event, Treasure, Boss,
Crafting, Rare Drops, Party Dungeon, Raid และ World Boss
`.trim(),
  },

  {
    keywords: [
      "chatbot",
      "nexora ai",
      "ai",
      "บอทตอบ",
    ],

    content: `
NEXORA AI:
- คุยโดยตรงในห้อง nexora-ai
- นอกห้อง AI ใช้ @NEXORA หรือ Reply ข้อความของ NEXORA
- มี Short-Term Conversation Context
- ไม่ใช่ Moderator
- ไม่ดำเนิน privileged/admin action
- หากเป็นเรื่องที่ต้องให้ Staff จัดการ จะแนะนำให้เปิด Ticket
`.trim(),
  },

  {
    keywords: [
      "level",
      "เลเวล",
      "xp",
      "ข้อความ",
      "activity",
    ],

    content: `
NEXORA มีระบบ Level / Activity
ผู้ใช้ได้รับ XP จาก Activity ตามระบบ Leveling
และมีการเก็บจำนวนข้อความเพื่อใช้กับระบบสมาชิกและสถิติต่าง ๆ
`.trim(),
  },
];

export function getNexoraKnowledge(
  question: string,
): string {
  const normalized =
    question.toLowerCase();

  const ranked =
    entries
      .map(
        (entry) => ({
          entry,

          score:
            entry.keywords.reduce(
              (
                total,
                keyword,
              ) =>
                total +
                (
                  normalized.includes(
                    keyword.toLowerCase(),
                  )
                    ? 1
                    : 0
                ),
              0,
            ),
        }),
      )
      .filter(
        (item) =>
          item.score > 0,
      )
      .sort(
        (a, b) =>
          b.score -
          a.score,
      )
      .slice(
        0,
        4,
      )
      .map(
        (item) =>
          item.entry.content,
      );

  return [
    BASE_KNOWLEDGE,
    ...ranked,
  ].join(
    "\n\n---\n\n",
  );
}
