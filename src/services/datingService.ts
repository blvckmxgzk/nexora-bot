import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type Guild,
} from "discord.js";

import {
  randomBytes,
} from "node:crypto";

import {
  DatingProfile,
} from "../models/DatingProfile.js";

import {
  DatingMatch,
} from "../models/DatingMatch.js";

import {
  communityLoggingService,
} from "./logging/communityLoggingService.js";

export const DATING_PREFIX =
  "nexora_dating:";

const GENDERS:
  Record<
    string,
    string
  > = {
    male:
      "ชาย",

    female:
      "หญิง",

    other:
      "อื่น ๆ",

    unspecified:
      "ไม่ระบุ",
  };

const PREFERENCES:
  Record<
    string,
    string
  > = {
    male:
      "ชาย",

    female:
      "หญิง",

    any:
      "ทุกเพศ",
  };

function createMatchId():
  string {
  return [
    "MATCH",
    Date.now()
      .toString(
        36,
      )
      .toUpperCase(),
    randomBytes(
      3,
    )
      .toString(
        "hex",
      )
      .toUpperCase(),
  ].join(
    "-",
  );
}

function createPairKey(
  guildId:
    string,

  first:
    string,

  second:
    string,
): string {
  return [
    guildId,
    ...[
      first,
      second,
    ].sort(),
  ].join(
    ":",
  );
}

function parseAgeGroup(
  raw:
    string,
):
  | "13-17"
  | "18+" {
  const value =
    raw
      .trim()
      .toLowerCase()
      .replace(
        /\s/g,
        "",
      );

  if (
    [
      "13-17",
      "13–17",
      "13ถึง17",
    ].includes(
      value,
    )
  ) {
    return "13-17";
  }

  if (
    [
      "18+",
      "18plus",
      "18up",
      "18ขึ้นไป",
    ].includes(
      value,
    )
  ) {
    return "18+";
  }

  throw new Error(
    "กลุ่มอายุต้องกรอก `13-17` หรือ `18+`",
  );
}

function parseGender(
  raw:
    string,
):
  | "male"
  | "female"
  | "other"
  | "unspecified" {
  const value =
    raw
      .trim()
      .toLowerCase();

  if (
    [
      "ชาย",
      "ผู้ชาย",
      "male",
      "m",
    ].includes(
      value,
    )
  ) {
    return "male";
  }

  if (
    [
      "หญิง",
      "ผู้หญิง",
      "female",
      "f",
    ].includes(
      value,
    )
  ) {
    return "female";
  }

  if (
    [
      "อื่น",
      "อื่นๆ",
      "อื่น ๆ",
      "other",
      "nonbinary",
      "non-binary",
    ].includes(
      value,
    )
  ) {
    return "other";
  }

  if (
    [
      "ไม่ระบุ",
      "ไม่บอก",
      "unspecified",
      "none",
    ].includes(
      value,
    )
  ) {
    return "unspecified";
  }

  throw new Error(
    "เพศต้องเป็น `ชาย`, `หญิง`, `อื่นๆ` หรือ `ไม่ระบุ`",
  );
}

function parsePreference(
  raw:
    string,
):
  | "male"
  | "female"
  | "any" {
  const value =
    raw
      .trim()
      .toLowerCase();

  if (
    [
      "ชาย",
      "ผู้ชาย",
      "male",
      "m",
    ].includes(
      value,
    )
  ) {
    return "male";
  }

  if (
    [
      "หญิง",
      "ผู้หญิง",
      "female",
      "f",
    ].includes(
      value,
    )
  ) {
    return "female";
  }

  if (
    [
      "ทุกเพศ",
      "ทั้งหมด",
      "any",
      "all",
    ].includes(
      value,
    )
  ) {
    return "any";
  }

  throw new Error(
    "กำลังมองหาต้องเป็น `ชาย`, `หญิง` หรือ `ทุกเพศ`",
  );
}

function compatible(
  first:
    any,

  second:
    any,
): boolean {
  if (
    first.ageGroup !==
    second.ageGroup
  ) {
    return false;
  }

  const firstAccepts =
    first.lookingFor ===
      "any" ||
    first.lookingFor ===
      second.gender;

  const secondAccepts =
    second.lookingFor ===
      "any" ||
    second.lookingFor ===
      first.gender;

  return (
    firstAccepts &&
    secondAccepts
  );
}

function homeRows(
  profile:
    any |
    null,
) {
  const rows:
    ActionRowBuilder<ButtonBuilder>[] =
      [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}edit`,
              )
              .setLabel(
                profile
                  ? "แก้ไขโปรไฟล์"
                  : "สร้างโปรไฟล์",
              )
              .setEmoji(
                "✏️",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}browse`,
              )
              .setLabel(
                "เริ่มหาคู่",
              )
              .setEmoji(
                "❤️",
              )
              .setStyle(
                ButtonStyle.Success,
              )
              .setDisabled(
                !profile ||
                !profile.active,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}profile`,
              )
              .setLabel(
                "โปรไฟล์ฉัน",
              )
              .setEmoji(
                "👤",
              )
              .setStyle(
                ButtonStyle.Secondary,
              )
              .setDisabled(
                !profile,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}matches`,
              )
              .setLabel(
                "Matches",
              )
              .setEmoji(
                "💞",
              )
              .setStyle(
                ButtonStyle.Secondary,
              )
              .setDisabled(
                !profile,
              ),
          ),
      ];

  if (profile) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(
              `${DATING_PREFIX}toggle`,
            )
            .setLabel(
              profile.active
                ? "พักการค้นหา"
                : "เปิดการค้นหา",
            )
            .setEmoji(
              profile.active
                ? "⏸️"
                : "▶️",
            )
            .setStyle(
              profile.active
                ? ButtonStyle.Secondary
                : ButtonStyle.Success,
            ),

          new ButtonBuilder()
            .setCustomId(
              `${DATING_PREFIX}reset_skips`,
            )
            .setLabel(
              "รีเซ็ตที่ข้าม",
            )
            .setEmoji(
              "🔄",
            )
            .setStyle(
              ButtonStyle.Secondary,
            ),

          new ButtonBuilder()
            .setCustomId(
              `${DATING_PREFIX}delete`,
            )
            .setLabel(
              "ลบโปรไฟล์",
            )
            .setEmoji(
              "🗑️",
            )
            .setStyle(
              ButtonStyle.Danger,
            ),
        ),
    );
  }

  return rows;
}

export const datingService = {
  parseAgeGroup,
  parseGender,
  parsePreference,

  buildPanel() {
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(
            0xff4f8b,
          )
          .setTitle(
            "❤️ NEXORA • หาคู่",
          )
          .setDescription(
            [
              "พื้นที่สำหรับสมาชิกที่ต้องการทำความรู้จักกันแบบสมัครใจ",
              "",
              "**วิธีใช้**",
              "สร้างโปรไฟล์ → Browse → ❤️ สนใจ",
              "เมื่อทั้งสองฝ่ายสนใจกัน ระบบจะแจ้ง Match",
              "",
              "🔒 **Safety**",
              "• 13–17 และ 18+ แยกออกจากกัน",
              "• ไม่มีการขอตำแหน่ง ที่อยู่ หรือข้อมูลติดต่อภายนอก",
              "• Like ฝ่ายเดียวจะไม่ถูกเปิดเผย",
              "• พักหรือลบโปรไฟล์ได้ทุกเมื่อ",
            ].join(
              "\n",
            ),
          )
          .setFooter({
            text:
              "NEXORA Dating • Opt-in only",
          })
          .setTimestamp(),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}home`,
              )
              .setLabel(
                "เปิดระบบหาคู่",
              )
              .setEmoji(
                "❤️",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),
          ),
      ],
    };
  },

  async home(
    guildId:
      string,

    userId:
      string,

    notice?:
      string,
  ) {
    const profile =
      await DatingProfile
        .findOne({
          guildId,
          userId,
        });

    const embed =
      new EmbedBuilder()
        .setColor(
          0xff4f8b,
        )
        .setTitle(
          "❤️ NEXORA Dating",
        )
        .setDescription(
          profile
            ? [
                `สถานะ: **${profile.active ? "🟢 กำลังค้นหา" : "⚫ พักการค้นหา"}**`,
                "",
                `ชื่อ: **${profile.displayName}**`,
                `กลุ่มอายุ: **${profile.ageGroup}**`,
                `เพศ: **${GENDERS[profile.gender] ?? profile.gender}**`,
                `กำลังมองหา: **${PREFERENCES[profile.lookingFor] ?? profile.lookingFor}**`,
              ].join(
                "\n",
              )
            : [
                "ยังไม่มี Dating Profile",
                "",
                "กด **สร้างโปรไฟล์** เพื่อเริ่มต้น",
              ].join(
                "\n",
              ),
        )
        .setFooter({
          text:
            "NEXORA Dating • Mutual Like",
        });

    return {
      content:
        notice ??
        null,

      embeds: [
        embed,
      ],

      components:
        homeRows(
          profile,
        ),
    };
  },

  async profile(
    guildId:
      string,

    userId:
      string,
  ) {
    const profile =
      await DatingProfile
        .findOne({
          guildId,
          userId,
        });

    if (!profile) {
      throw new Error(
        "ยังไม่มี Dating Profile",
      );
    }

    const embed =
      new EmbedBuilder()
        .setColor(
          0xff4f8b,
        )
        .setTitle(
          `👤 ${profile.displayName}`,
        )
        .setDescription(
          profile.bio ||
          "ยังไม่ได้เขียน Bio",
        )
        .addFields(
          {
            name:
              "🎂 กลุ่มอายุ",

            value:
              profile.ageGroup,

            inline:
              true,
          },

          {
            name:
              "👤 เพศ",

            value:
              GENDERS[
                profile.gender
              ] ??
              profile.gender,

            inline:
              true,
          },

          {
            name:
              "❤️ มองหา",

            value:
              PREFERENCES[
                profile.lookingFor
              ] ??
              profile.lookingFor,

            inline:
              true,
          },

          {
            name:
              "✨ ความสนใจ",

            value:
              profile.interests ||
              "ไม่ได้ระบุ",
          },

          {
            name:
              "📌 สถานะ",

            value:
              profile.active
                ? "🟢 กำลังค้นหา"
                : "⚫ พักการค้นหา",
          },
        );

    return {
      content:
        null,

      embeds: [
        embed,
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}edit`,
              )
              .setLabel(
                "แก้ไข",
              )
              .setEmoji(
                "✏️",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}home`,
              )
              .setLabel(
                "หน้าหลัก",
              )
              .setEmoji(
                "🏠",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),
          ),
      ],
    };
  },

  async buildProfileModal(
    guildId:
      string,

    userId:
      string,
  ) {
    const existing =
      await DatingProfile
        .findOne({
          guildId,
          userId,
        });

    const age =
      new TextInputBuilder()
        .setCustomId(
          "age_group",
        )
        .setLabel(
          "กลุ่มอายุ: 13-17 หรือ 18+",
        )
        .setStyle(
          TextInputStyle.Short,
        )
        .setRequired(
          true,
        )
        .setMaxLength(
          10,
        );

    const gender =
      new TextInputBuilder()
        .setCustomId(
          "gender",
        )
        .setLabel(
          "เพศ: ชาย / หญิง / อื่นๆ / ไม่ระบุ",
        )
        .setStyle(
          TextInputStyle.Short,
        )
        .setRequired(
          true,
        )
        .setMaxLength(
          30,
        );

    const preference =
      new TextInputBuilder()
        .setCustomId(
          "looking_for",
        )
        .setLabel(
          "มองหา: ชาย / หญิง / ทุกเพศ",
        )
        .setStyle(
          TextInputStyle.Short,
        )
        .setRequired(
          true,
        )
        .setMaxLength(
          30,
        );

    const interests =
      new TextInputBuilder()
        .setCustomId(
          "interests",
        )
        .setLabel(
          "ความสนใจ เช่น เกม เพลง อนิเมะ",
        )
        .setStyle(
          TextInputStyle.Paragraph,
        )
        .setRequired(
          false,
        )
        .setMaxLength(
          300,
        );

    const bio =
      new TextInputBuilder()
        .setCustomId(
          "bio",
        )
        .setLabel(
          "แนะนำตัวสั้น ๆ",
        )
        .setStyle(
          TextInputStyle.Paragraph,
        )
        .setRequired(
          false,
        )
        .setMaxLength(
          500,
        );

    if (existing) {
      age.setValue(
        existing.ageGroup,
      );

      gender.setValue(
        GENDERS[
          existing.gender
        ] ??
        "ไม่ระบุ",
      );

      preference.setValue(
        PREFERENCES[
          existing.lookingFor
        ] ??
        "ทุกเพศ",
      );

      if (
        existing.interests
      ) {
        interests.setValue(
          existing.interests,
        );
      }

      if (
        existing.bio
      ) {
        bio.setValue(
          existing.bio,
        );
      }
    }

    return new ModalBuilder()
      .setCustomId(
        `${DATING_PREFIX}profile_modal`,
      )
      .setTitle(
        existing
          ? "แก้ไข Dating Profile"
          : "สร้าง Dating Profile",
      )
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            age,
          ),

        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            gender,
          ),

        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            preference,
          ),

        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            interests,
          ),

        new ActionRowBuilder<TextInputBuilder>()
          .addComponents(
            bio,
          ),
      );
  },

  async saveProfile(
    guildId:
      string,

    userId:
      string,

    displayName:
      string,

    values: {
      ageGroup:
        string;

      gender:
        string;

      lookingFor:
        string;

      interests:
        string;

      bio:
        string;
    },
  ) {
    const ageGroup =
      parseAgeGroup(
        values.ageGroup,
      );

    const gender =
      parseGender(
        values.gender,
      );

    const lookingFor =
      parsePreference(
        values.lookingFor,
      );

    return DatingProfile
      .findOneAndUpdate(
        {
          guildId,
          userId,
        },
        {
          $set: {
            displayName:
              displayName
                .trim()
                .slice(
                  0,
                  100,
                ),

            ageGroup,
            gender,
            lookingFor,

            interests:
              values.interests
                .trim()
                .slice(
                  0,
                  300,
                ),

            bio:
              values.bio
                .trim()
                .slice(
                  0,
                  500,
                ),

            active:
              true,
          },

          $setOnInsert: {
            guildId,
            userId,

            likedUserIds:
              [],

            skippedUserIds:
              [],

            blockedUserIds:
              [],
          },
        },
        {
          upsert:
            true,

          new:
            true,

          setDefaultsOnInsert:
            true,
        },
      );
  },

  async browse(
    client:
      Client,

    guildId:
      string,

    userId:
      string,
  ) {
    const viewer =
      await DatingProfile
        .findOne({
          guildId,
          userId,
        });

    if (!viewer) {
      throw new Error(
        "กรุณาสร้าง Dating Profile ก่อน",
      );
    }

    if (!viewer.active) {
      throw new Error(
        "โปรไฟล์กำลังพักการค้นหา",
      );
    }

    const excluded =
      new Set<string>([
        userId,

        ...(
          viewer.likedUserIds ??
          []
        ),

        ...(
          viewer.skippedUserIds ??
          []
        ),

        ...(
          viewer.blockedUserIds ??
          []
        ),
      ]);

    const candidates =
      await DatingProfile
        .find({
          guildId,

          active:
            true,

          ageGroup:
            viewer.ageGroup,

          userId: {
            $nin:
              [
                ...excluded,
              ],
          },

          blockedUserIds: {
            $ne:
              userId,
          },
        })
        .limit(
          100,
        );

    const available =
      candidates.filter(
        (
          candidate:
            any,
        ) =>
          compatible(
            viewer,
            candidate,
          ),
      );

    if (
      available.length ===
      0
    ) {
      return {
        content:
          null,

        embeds: [
          new EmbedBuilder()
            .setColor(
              0x6b7280,
            )
            .setTitle(
              "💭 ยังไม่เจอคนใหม่",
            )
            .setDescription(
              [
                "ตอนนี้ยังไม่มีโปรไฟล์ใหม่ที่ตรงกับเงื่อนไข",
                "",
                "ลองกลับมาใหม่ภายหลัง หรือรีเซ็ตคนที่เคยข้าม",
              ].join(
                "\n",
              ),
            ),
        ],

        components: [
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `${DATING_PREFIX}reset_skips`,
                )
                .setLabel(
                  "รีเซ็ตที่ข้าม",
                )
                .setEmoji(
                  "🔄",
                )
                .setStyle(
                  ButtonStyle.Secondary,
                ),

              new ButtonBuilder()
                .setCustomId(
                  `${DATING_PREFIX}home`,
                )
                .setLabel(
                  "หน้าหลัก",
                )
                .setEmoji(
                  "🏠",
                )
                .setStyle(
                  ButtonStyle.Secondary,
                ),
            ),
        ],
      };
    }

    const candidate =
      available[
        Math.floor(
          Math.random() *
          available.length,
        )
      ]!;

    viewer.lastBrowseAt =
      new Date();

    await viewer.save();

    const discordUser =
      await client.users
        .fetch(
          candidate.userId,
        )
        .catch(
          () =>
            null,
        );

    const embed =
      new EmbedBuilder()
        .setColor(
          0xff4f8b,
        )
        .setTitle(
          `❤️ ${candidate.displayName}`,
        )
        .setDescription(
          candidate.bio ||
          "ยังไม่ได้เขียน Bio",
        )
        .addFields(
          {
            name:
              "🎂 กลุ่มอายุ",

            value:
              candidate.ageGroup,

            inline:
              true,
          },

          {
            name:
              "👤 เพศ",

            value:
              GENDERS[
                candidate.gender
              ] ??
              candidate.gender,

            inline:
              true,
          },

          {
            name:
              "❤️ มองหา",

            value:
              PREFERENCES[
                candidate.lookingFor
              ] ??
              candidate.lookingFor,

            inline:
              true,
          },

          {
            name:
              "✨ ความสนใจ",

            value:
              candidate.interests ||
              "ไม่ได้ระบุ",
          },
        )
        .setFooter({
          text:
            `NEXORA Dating • ${viewer.ageGroup}`,
        });

    if (discordUser) {
      embed.setThumbnail(
        discordUser
          .displayAvatarURL({
            size:
              256,
          }),
      );
    }

    return {
      content:
        null,

      embeds: [
        embed,
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}like:${candidate.userId}`,
              )
              .setLabel(
                "สนใจ",
              )
              .setEmoji(
                "❤️",
              )
              .setStyle(
                ButtonStyle.Success,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}skip:${candidate.userId}`,
              )
              .setLabel(
                "ข้าม",
              )
              .setEmoji(
                "⏭️",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}block:${candidate.userId}`,
              )
              .setLabel(
                "ไม่แสดงอีก",
              )
              .setEmoji(
                "🚫",
              )
              .setStyle(
                ButtonStyle.Danger,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}home`,
              )
              .setLabel(
                "หน้าหลัก",
              )
              .setEmoji(
                "🏠",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),
          ),
      ],
    };
  },

  async like(
    client:
      Client,

    guild:
      Guild,

    userId:
      string,

    targetUserId:
      string,
  ) {
    if (
      userId ===
      targetUserId
    ) {
      throw new Error(
        "ไม่สามารถกดสนใจตัวเองได้",
      );
    }

    const [
      viewer,
      target,
    ] =
      await Promise.all([
        DatingProfile.findOne({
          guildId:
            guild.id,

          userId,
        }),

        DatingProfile.findOne({
          guildId:
            guild.id,

          userId:
            targetUserId,

          active:
            true,
        }),
      ]);

    if (
      !viewer ||
      !target
    ) {
      throw new Error(
        "ไม่พบโปรไฟล์นี้แล้ว",
      );
    }

    if (
      !compatible(
        viewer,
        target,
      )
    ) {
      throw new Error(
        "โปรไฟล์นี้ไม่ตรงกับเงื่อนไขการจับคู่แล้ว",
      );
    }

    await DatingProfile
      .updateOne(
        {
          _id:
            viewer._id,
        },
        {
          $addToSet: {
            likedUserIds:
              targetUserId,
          },

          $pull: {
            skippedUserIds:
              targetUserId,
          },
        },
      );

    const mutual =
      (
        target.likedUserIds ??
        []
      ).includes(
        userId,
      );

    if (!mutual) {
      return {
        matched:
          false,

        match:
          null,
      };
    }

    const key =
      createPairKey(
        guild.id,
        userId,
        targetUserId,
      );

    const existing =
      await DatingMatch
        .findOne({
          pairKey:
            key,

          status:
            "matched",
        });

    if (existing) {
      return {
        matched:
          true,

        match:
          existing,
      };
    }

    const sorted =
      [
        userId,
        targetUserId,
      ].sort();

    const userAId =
      sorted[0]!;

    const userBId =
      sorted[1]!;

    const match =
      await DatingMatch
        .findOneAndUpdate(
          {
            pairKey:
              key,
          },
          {
            $set: {
              guildId:
                guild.id,

              userAId,
              userBId,

              status:
                "matched",

              matchedAt:
                new Date(),

              unmatchedAt:
                null,
            },

            $setOnInsert: {
              matchId:
                createMatchId(),

              pairKey:
                key,
            },
          },
          {
            upsert:
              true,

            new:
              true,

            setDefaultsOnInsert:
              true,
          },
        );

    const safety =
      viewer.ageGroup ===
      "13-17"
        ? "\n\n🛡️ อย่าแชร์ที่อยู่ โรงเรียน ตารางเวลา หรือข้อมูลส่วนตัวละเอียดกับคนที่เพิ่งรู้จัก"
        : "";

    const firstUser =
      await client.users
        .fetch(
          userId,
        )
        .catch(
          () =>
            null,
        );

    const secondUser =
      await client.users
        .fetch(
          targetUserId,
        )
        .catch(
          () =>
            null,
        );

    await firstUser
      ?.send({
        content:
          `💞 **คุณ Match แล้ว!**\nคุณกับ <@${targetUserId}> สนใจกันทั้งคู่${safety}`,

        allowedMentions: {
          users: [
            targetUserId,
          ],
        },
      })
      .catch(
        () =>
          undefined,
      );

    await secondUser
      ?.send({
        content:
          `💞 **คุณ Match แล้ว!**\nคุณกับ <@${userId}> สนใจกันทั้งคู่${safety}`,

        allowedMentions: {
          users: [
            userId,
          ],
        },
      })
      .catch(
        () =>
          undefined,
      );

    await communityLoggingService
      .system(
        guild,
        {
          event:
            "dating_match",

          title:
            "Dating Match Created",

          severity:
            "success",

          actorId:
            userId,

          metadata: {
            matchId:
              match.matchId,

            pairKey:
              key,
          },
        },
      )
      .catch(
        () =>
          undefined,
      );

    return {
      matched:
        true,

      match,
    };
  },

  matchPayload(
    targetUserId:
      string,

    matchId:
      string,
  ) {
    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0xff4f8b,
          )
          .setTitle(
            "💞 IT'S A MATCH!",
          )
          .setDescription(
            [
              `คุณกับ <@${targetUserId}> สนใจกันทั้งคู่`,
              "",
              "ระบบแจ้งทั้งสองฝ่ายทาง DM แล้ว",
              "",
              "คุยกันด้วยความเคารพ และแชร์ข้อมูลส่วนตัวเท่าที่สบายใจ",
            ].join(
              "\n",
            ),
          )
          .setFooter({
            text:
              `Match ${matchId}`,
          }),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}browse`,
              )
              .setLabel(
                "หาคนต่อ",
              )
              .setEmoji(
                "❤️",
              )
              .setStyle(
                ButtonStyle.Primary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}matches`,
              )
              .setLabel(
                "Matches",
              )
              .setEmoji(
                "💞",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}home`,
              )
              .setLabel(
                "หน้าหลัก",
              )
              .setEmoji(
                "🏠",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),
          ),
      ],

      allowedMentions: {
        parse:
          [],
      },
    };
  },

  async skip(
    guildId:
      string,

    userId:
      string,

    targetUserId:
      string,
  ) {
    await DatingProfile
      .updateOne(
        {
          guildId,
          userId,
        },
        {
          $addToSet: {
            skippedUserIds:
              targetUserId,
          },
        },
      );
  },

  async block(
    guildId:
      string,

    userId:
      string,

    targetUserId:
      string,
  ) {
    await DatingProfile
      .updateOne(
        {
          guildId,
          userId,
        },
        {
          $addToSet: {
            blockedUserIds:
              targetUserId,
          },

          $pull: {
            likedUserIds:
              targetUserId,

            skippedUserIds:
              targetUserId,
          },
        },
      );
  },

  async toggle(
    guildId:
      string,

    userId:
      string,
  ) {
    const profile =
      await DatingProfile
        .findOne({
          guildId,
          userId,
        });

    if (!profile) {
      throw new Error(
        "ยังไม่มี Dating Profile",
      );
    }

    profile.active =
      !profile.active;

    await profile.save();

    return profile;
  },

  async resetSkips(
    guildId:
      string,

    userId:
      string,
  ) {
    await DatingProfile
      .updateOne(
        {
          guildId,
          userId,
        },
        {
          $set: {
            skippedUserIds:
              [],
          },
        },
      );
  },

  async deleteProfile(
    guildId:
      string,

    userId:
      string,
  ) {
    await Promise.all([
      DatingProfile.deleteOne({
        guildId,
        userId,
      }),

      DatingProfile.updateMany(
        {
          guildId,

          userId: {
            $ne:
              userId,
          },
        },
        {
          $pull: {
            likedUserIds:
              userId,

            skippedUserIds:
              userId,

            blockedUserIds:
              userId,
          },
        },
      ),

      DatingMatch.updateMany(
        {
          guildId,

          status:
            "matched",

          $or: [
            {
              userAId:
                userId,
            },

            {
              userBId:
                userId,
            },
          ],
        },
        {
          $set: {
            status:
              "unmatched",

            unmatchedAt:
              new Date(),
          },
        },
      ),
    ]);
  },

  async matches(
    guildId:
      string,

    userId:
      string,
  ) {
    const profile =
      await DatingProfile
        .findOne({
          guildId,
          userId,
        });

    if (!profile) {
      throw new Error(
        "ยังไม่มี Dating Profile",
      );
    }

    const matches =
      await DatingMatch
        .find({
          guildId,

          status:
            "matched",

          $or: [
            {
              userAId:
                userId,
            },

            {
              userBId:
                userId,
            },
          ],
        })
        .sort({
          matchedAt:
            -1,
        })
        .limit(
          10,
        );

    const lines =
      matches.length >
      0
        ? matches
            .map(
              (
                match:
                  any,
                index:
                  number,
              ) => {
                const other =
                  match.userAId ===
                  userId
                    ? match.userBId
                    : match.userAId;

                const time =
                  Math.floor(
                    new Date(
                      match.matchedAt,
                    ).getTime() /
                    1000,
                  );

                return `${index + 1}. 💞 <@${other}> • <t:${time}:R>`;
              },
            )
            .join(
              "\n",
            )
        : "ยังไม่มี Match";

    return {
      content:
        null,

      embeds: [
        new EmbedBuilder()
          .setColor(
            0xff4f8b,
          )
          .setTitle(
            "💞 Matches ของคุณ",
          )
          .setDescription(
            lines,
          )
          .setFooter({
            text:
              "แสดงสูงสุด 10 Match ล่าสุด",
          }),
      ],

      components: [
        new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}browse`,
              )
              .setLabel(
                "หาคู่ต่อ",
              )
              .setEmoji(
                "❤️",
              )
              .setStyle(
                ButtonStyle.Primary,
              )
              .setDisabled(
                !profile.active,
              ),

            new ButtonBuilder()
              .setCustomId(
                `${DATING_PREFIX}home`,
              )
              .setLabel(
                "หน้าหลัก",
              )
              .setEmoji(
                "🏠",
              )
              .setStyle(
                ButtonStyle.Secondary,
              ),
          ),
      ],

      allowedMentions: {
        parse:
          [],
      },
    };
  },
};
