const BEGINNING = [
  "K",
  "M",
  "B",
] as const;

const FIRST = [
  "U",
  "D",
  "T",
  "Qd",
  "Qn",
  "Sx",
  "Sp",
  "Oc",
  "No",
] as const;

const SECOND = [
  "De",
  "Vt",
  "Tg",
  "Qdg",
  "Qng",
  "Sxg",
  "Spg",
  "Ocg",
  "Nog",
] as const;

const THIRD = [
  "Ce",
  "Dce",
  "Tce",
  "Qdce",
  "Qnce",
  "Sxce",
  "Spce",
  "Occe",
  "Noce",
] as const;

/*
 * Multi-layer suffix.
 *
 * index 1 = 10^(3 * 10^3)      -> Mi family
 * index 2 = 10^(3 * 10^6)      -> Mc family
 * index 3 = 10^(3 * 10^9)      -> Na family
 *
 * แค่ไม่กี่สิบชั้นนี้ก็ครอบคลุม exponent
 * ที่ใหญ่เกิน progression ของ NEXO Miner
 * ไปมหาศาลแล้ว
 */
const MULTI = [
  "",
  "Mi",
  "Mc",
  "Na",
  "Pi",
  "Fm",
  "At",
  "Zp",
  "Yc",
  "Xo",
  "Ve",
  "Me",
  "Due",
  "Tre",
  "Te",
  "Pt",
  "He",
  "Hp",
  "Oct",
  "En",
  "Ic",
  "Mei",
  "Dui",
  "Tri",
  "Teti",
  "Pti",
  "Hei",
  "Hpi",
  "Oci",
  "Eni",
  "Tra",
  "TeC",
] as const;

function tier1Suffix(
  rawExponent:
    number,

  allowBeginning =
    true,
): string | null {
  if (
    rawExponent <
    3
  ) {
    return null;
  }

  const exponent =
    Math.floor(
      rawExponent /
      3,
    ) -
    1;

  if (
    allowBeginning &&
    exponent <
    3
  ) {
    return (
      BEGINNING[
        exponent
      ] ??
      null
    );
  }

  let remaining =
    exponent;

  let suffix =
    "";

  if (
    remaining >=
    100
  ) {
    const hundreds =
      Math.floor(
        remaining /
        100,
      );

    const part =
      THIRD[
        hundreds -
        1
      ];

    if (!part) {
      return null;
    }

    suffix =
      part;

    remaining %=
      100;
  }

  if (
    remaining >=
    10
  ) {
    const tens =
      Math.floor(
        remaining /
        10,
      );

    const part =
      SECOND[
        tens -
        1
      ];

    if (!part) {
      return null;
    }

    suffix =
      part +
      suffix;

    remaining %=
      10;
  }

  if (
    remaining >
    0
  ) {
    const part =
      FIRST[
        remaining -
        1
      ];

    if (!part) {
      return null;
    }

    suffix =
      part +
      suffix;
  }

  return suffix;
}

function tier2Suffix(
  rawExponent:
    number,
): string | null {
  let exponent =
    Math.floor(
      rawExponent /
      3,
    ) -
    1;

  if (
    !Number.isFinite(
      exponent,
    ) ||
    exponent <
    1000
  ) {
    return null;
  }

  let suffix =
    "";

  const highestLayer =
    Math.floor(
      Math.log10(
        exponent,
      ) /
      3,
    );

  for (
    let layer =
      highestLayer;
    layer >=
      0;
    layer--
  ) {
    const place =
      Math.pow(
        1000,
        layer,
      );

    if (
      exponent <
      place
    ) {
      continue;
    }

    let chunk =
      Math.floor(
        exponent /
        place,
      );

    if (
      chunk >
      1000
    ) {
      chunk %=
        1000;
    }

    const prefix =
      tier1Suffix(
        (
          chunk +
          1
        ) *
          3,
        false,
      );

    /*
     * U = 1 ในตำแหน่งนั้น
     * ไม่ต้องแสดง:
     *
     * UMi -> Mi
     * UMc -> Mc
     */
    if (
      prefix &&
      prefix !==
        "U"
    ) {
      suffix +=
        prefix;
    }

    if (
      layer >
      0
    ) {
      const multi =
        MULTI[
          layer
        ];

      if (!multi) {
        return null;
      }

      suffix +=
        multi;
    }

    exponent %=
      place;
  }

  return (
    suffix ||
    null
  );
}

export function getNexoSuffix(
  exponent:
    number,
): string | null {
  if (
    exponent <
    3
  ) {
    return "";
  }

  if (
    exponent <=
    3002
  ) {
    return tier1Suffix(
      exponent,
      true,
    );
  }

  return tier2Suffix(
    exponent,
  );
}
