import Decimal from "break_eternity.js";

import {
  getNexoSuffix,
} from "./nexoSuffix.js";

export type NexoNumberish =
  | string
  | number
  | Decimal
  | NexoNumber;

function trimFixed(
  value:
    number,

  precision:
    number,
): string {
  return value
    .toFixed(
      precision,
    )
    .replace(
      /\.?0+$/,
      "",
    );
}

export class NexoNumber {
  public readonly value:
    Decimal;

  public constructor(
    input:
      NexoNumberish =
        0,
  ) {
    if (
      input instanceof
      NexoNumber
    ) {
      this.value =
        new Decimal(
          input.value,
        );

      return;
    }

    this.value =
      new Decimal(
        input as
          string |
          number |
          Decimal,
      );
  }

  public static from(
    input:
      NexoNumberish,
  ): NexoNumber {
    return new NexoNumber(
      input,
    );
  }

  public static zero():
    NexoNumber {
    return new NexoNumber(
      0,
    );
  }

  public static one():
    NexoNumber {
    return new NexoNumber(
      1,
    );
  }

  public add(
    other:
      NexoNumberish,
  ): NexoNumber {
    return new NexoNumber(
      this.value.add(
        NexoNumber
          .from(
            other,
          )
          .value,
      ),
    );
  }

  public sub(
    other:
      NexoNumberish,
  ): NexoNumber {
    return new NexoNumber(
      this.value.sub(
        NexoNumber
          .from(
            other,
          )
          .value,
      ),
    );
  }

  public mul(
    other:
      NexoNumberish,
  ): NexoNumber {
    return new NexoNumber(
      this.value.mul(
        NexoNumber
          .from(
            other,
          )
          .value,
      ),
    );
  }

  public div(
    other:
      NexoNumberish,
  ): NexoNumber {
    const divisor =
      NexoNumber.from(
        other,
      );

    if (
      divisor.eq(
        0,
      )
    ) {
      throw new Error(
        "Division by zero",
      );
    }

    return new NexoNumber(
      this.value.div(
        divisor.value,
      ),
    );
  }

  public pow(
    power:
      NexoNumberish,
  ): NexoNumber {
    return new NexoNumber(
      this.value.pow(
        NexoNumber
          .from(
            power,
          )
          .value,
      ),
    );
  }

  public abs():
    NexoNumber {
    return new NexoNumber(
      this.value.abs(),
    );
  }

  public cmp(
    other:
      NexoNumberish,
  ): number {
    return this.value.cmp(
      NexoNumber
        .from(
          other,
        )
        .value,
    );
  }

  public eq(
    other:
      NexoNumberish,
  ): boolean {
    return (
      this.cmp(
        other,
      ) ===
      0
    );
  }

  public lt(
    other:
      NexoNumberish,
  ): boolean {
    return (
      this.cmp(
        other,
      ) <
      0
    );
  }

  public lte(
    other:
      NexoNumberish,
  ): boolean {
    return (
      this.cmp(
        other,
      ) <=
      0
    );
  }

  public gt(
    other:
      NexoNumberish,
  ): boolean {
    return (
      this.cmp(
        other,
      ) >
      0
    );
  }

  public gte(
    other:
      NexoNumberish,
  ): boolean {
    return (
      this.cmp(
        other,
      ) >=
      0
    );
  }

  public toStorage():
    string {
    return this.value
      .toString();
  }

  public toSuffix(
    precision =
      2,
  ): string {
    if (
      this.eq(
        0,
      )
    ) {
      return "0";
    }

    const negative =
      this.lt(
        0,
      );

    const absolute =
      negative
        ? this
            .mul(
              -1,
            )
            .value
        : this.value;

    const raw:
      any =
        absolute;

    const layer =
      Number(
        raw.layer ??
        0,
      );

    const mag =
      Number(
        raw.mag ??
        0,
      );

    if (
      layer >=
      2
    ) {
      const magnitude =
        new NexoNumber(
          Math.abs(
            mag,
          ),
        );

      return (
        negative
          ? "-"
          : ""
      ) +
      `Ω${layer}·${magnitude.toSuffix(precision)}`;
    }

    if (
      absolute.lt(
        1000,
      )
    ) {
      return (
        negative
          ? "-"
          : ""
      ) +
      trimFixed(
        absolute.toNumber(),
        precision,
      );
    }

    const log =
      absolute
        .log10();

    const exponent =
      Math.floor(
        log.toNumber(),
      );

    if (
      !Number.isFinite(
        exponent,
      )
    ) {
      return (
        negative
          ? "-"
          : ""
      ) +
      `Ω${Math.max(
        1,
        layer,
      )}·${trimFixed(
        Math.abs(
          mag,
        ),
        precision,
      )}`;
    }

    const suffix =
      getNexoSuffix(
        exponent,
      );

    if (
      suffix !==
      null
    ) {
      const remainder =
        exponent %
        3;

      const mantissa =
        Math.pow(
          10,
          log.toNumber() -
          exponent +
          remainder,
        );

      return (
        negative
          ? "-"
          : ""
      ) +
      `${trimFixed(
        mantissa,
        precision,
      )}${suffix}`;
    }

    /*
     * เลขสูงเกิน suffix table:
     * ห้ามกลับไปใช้ XAA/XAB
     *
     * formatter ขั้นถัดไปจะใช้
     * Alya-style layered notation
     * เช่น exponent ที่ถูก suffix ซ้ำ
     */
    const exponentValue =
      new NexoNumber(
        exponent,
      );

    return (
      negative
        ? "-"
        : ""
    ) +
    `1e${exponentValue.toSuffix(
      precision,
    )}`;
  }
}

export function toSuffix(
  value:
    NexoNumberish,

  precision =
    2,
): string {
  return NexoNumber
    .from(
      value,
    )
    .toSuffix(
      precision,
    );
}
