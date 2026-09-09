import {
  EntrySecurityConfig,
} from "../../models/EntrySecurityConfig.js";

const ADAPTIVE_WINDOW_MS = 60_000;
const EMA_ALPHA = 0.2;
const MIN_BASELINE_SAMPLES = 5;
const BREACH_SUSTAIN_MS = 10_000;
const SURGE_FACTOR = 1.25;

type BaselineWindow = {
  start: number;
  count: number;
};

const rollingJoins = new Map<string, number[]>();
const baselineWindows = new Map<string, BaselineWindow>();
const breachStartedAt = new Map<string, number>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function minuteStart(now: number) {
  return Math.floor(now / ADAPTIVE_WINDOW_MS) * ADAPTIVE_WINDOW_MS;
}

function hardEquivalentPerMinute(
  threshold: number,
  windowSeconds: number,
) {
  return Math.max(
    1,
    Math.ceil(threshold * 60 / Math.max(1, windowSeconds)),
  );
}

export function calculateAdaptiveThreshold(
  baseline: number,
  multiplier: number,
  minimumJoins: number,
  hardThreshold: number,
  hardWindowSeconds: number,
) {
  const hardPerMinute = hardEquivalentPerMinute(
    hardThreshold,
    hardWindowSeconds,
  );

  const adaptive = Math.max(
    minimumJoins,
    Math.ceil(Math.max(0, baseline) * multiplier),
  );

  return Math.min(hardPerMinute, adaptive);
}

function configValues(config: any) {
  return {
    enabled: config.adaptiveRaidEnabled !== false,
    multiplier: clamp(Number(config.adaptiveRaidMultiplier ?? 6), 2, 20),
    minimumJoins: clamp(Number(config.adaptiveRaidMinimumJoins ?? 20), 5, 100),
    baseline: Math.max(0, Number(config.adaptiveBaselineJoinsPerMinute ?? 0)),
    samples: Math.max(0, Number(config.adaptiveBaselineSamples ?? 0)),
  };
}

async function learnWindow(config: any, count: number) {
  if (config.raidMode) return false;

  const values = configValues(config);
  const threshold = calculateAdaptiveThreshold(
    values.baseline,
    values.multiplier,
    values.minimumJoins,
    config.raidJoinThreshold,
    config.raidWindowSeconds,
  );

  const hardPerMinute = hardEquivalentPerMinute(
    config.raidJoinThreshold,
    config.raidWindowSeconds,
  );

  const suspicious =
    count >= hardPerMinute ||
    (values.samples >= MIN_BASELINE_SAMPLES && count >= threshold);

  if (suspicious) return false;

  const nextBaseline =
    values.samples === 0
      ? count
      : values.baseline * (1 - EMA_ALPHA) + count * EMA_ALPHA;

  config.adaptiveBaselineJoinsPerMinute =
    Math.round(nextBaseline * 100) / 100;
  config.adaptiveBaselineSamples = Math.min(100_000, values.samples + 1);
  config.adaptiveLastBaselineAt = new Date();

  return true;
}

async function advanceBaseline(config: any, guildId: string, now: number) {
  const currentStart = minuteStart(now);
  let state = baselineWindows.get(guildId);

  if (!state) {
    baselineWindows.set(guildId, { start: currentStart, count: 0 });
    return;
  }

  if (currentStart <= state.start) return;

  const elapsedWindows = Math.max(
    1,
    Math.floor((currentStart - state.start) / ADAPTIVE_WINDOW_MS),
  );

  let changed = await learnWindow(config, state.count);
  const emptyWindows = Math.min(5, Math.max(0, elapsedWindows - 1));

  for (let i = 0; i < emptyWindows; i += 1) {
    changed = (await learnWindow(config, 0)) || changed;
  }

  baselineWindows.set(guildId, { start: currentStart, count: 0 });
  if (changed) await config.save();
}

export type AdaptiveRaidResult = {
  hardTriggered: boolean;
  adaptiveTriggered: boolean;
  triggered: boolean;
  reason: "hard_limit" | "adaptive_surge" | "adaptive_sustained" | "none";
  hardCount: number;
  hardThreshold: number;
  hardWindowSeconds: number;
  currentPerMinute: number;
  adaptiveThreshold: number;
  baselinePerMinute: number;
  baselineSamples: number;
  adaptiveEnabled: boolean;
  breachAgeMs: number;
};

export const adaptiveRaidService = {
  async observeJoin(
    config: any,
    guildId: string,
    now = Date.now(),
  ): Promise<AdaptiveRaidResult> {
    await advanceBaseline(config, guildId, now);

    const baseline = baselineWindows.get(guildId);
    if (baseline) baseline.count += 1;

    const keepMs = Math.max(
      ADAPTIVE_WINDOW_MS,
      Number(config.raidWindowSeconds ?? 60) * 1000,
    );

    const current = (rollingJoins.get(guildId) ?? [])
      .filter((timestamp) => now - timestamp <= keepMs);

    current.push(now);
    rollingJoins.set(guildId, current);

    const hardWindowMs = Math.max(
      1,
      Number(config.raidWindowSeconds ?? 60),
    ) * 1000;

    const hardCount = current
      .filter((timestamp) => now - timestamp <= hardWindowMs)
      .length;

    const currentPerMinute = current
      .filter((timestamp) => now - timestamp <= ADAPTIVE_WINDOW_MS)
      .length;

    const values = configValues(config);
    const hardThreshold = Number(config.raidJoinThreshold ?? 64);
    const hardWindowSeconds = Number(config.raidWindowSeconds ?? 60);

    const adaptiveThreshold = calculateAdaptiveThreshold(
      values.baseline,
      values.multiplier,
      values.minimumJoins,
      hardThreshold,
      hardWindowSeconds,
    );

    const hardTriggered = hardCount >= hardThreshold;

    if (hardTriggered) {
      breachStartedAt.delete(guildId);
      return {
        hardTriggered: true,
        adaptiveTriggered: false,
        triggered: true,
        reason: "hard_limit",
        hardCount,
        hardThreshold,
        hardWindowSeconds,
        currentPerMinute,
        adaptiveThreshold,
        baselinePerMinute: values.baseline,
        baselineSamples: values.samples,
        adaptiveEnabled: values.enabled,
        breachAgeMs: 0,
      };
    }

    const adaptiveReady =
      values.enabled && values.samples >= MIN_BASELINE_SAMPLES;

    if (!adaptiveReady || currentPerMinute < adaptiveThreshold) {
      breachStartedAt.delete(guildId);
      return {
        hardTriggered: false,
        adaptiveTriggered: false,
        triggered: false,
        reason: "none",
        hardCount,
        hardThreshold,
        hardWindowSeconds,
        currentPerMinute,
        adaptiveThreshold,
        baselinePerMinute: values.baseline,
        baselineSamples: values.samples,
        adaptiveEnabled: values.enabled,
        breachAgeMs: 0,
      };
    }

    let startedAt = breachStartedAt.get(guildId);
    if (!startedAt) {
      startedAt = now;
      breachStartedAt.set(guildId, startedAt);
    }

    const breachAgeMs = Math.max(0, now - startedAt);
    const surgeThreshold = Math.min(
      hardThreshold,
      Math.ceil(adaptiveThreshold * SURGE_FACTOR),
    );

    const surge = currentPerMinute >= surgeThreshold;
    const sustained = breachAgeMs >= BREACH_SUSTAIN_MS;
    const adaptiveTriggered = surge || sustained;

    return {
      hardTriggered: false,
      adaptiveTriggered,
      triggered: adaptiveTriggered,
      reason: surge
        ? "adaptive_surge"
        : sustained
          ? "adaptive_sustained"
          : "none",
      hardCount,
      hardThreshold,
      hardWindowSeconds,
      currentPerMinute,
      adaptiveThreshold,
      baselinePerMinute: values.baseline,
      baselineSamples: values.samples,
      adaptiveEnabled: values.enabled,
      breachAgeMs,
    };
  },

  getStatus(config: any, guildId: string) {
    const values = configValues(config);
    const now = Date.now();
    const current = (rollingJoins.get(guildId) ?? [])
      .filter((timestamp) => now - timestamp <= ADAPTIVE_WINDOW_MS);

    const threshold = calculateAdaptiveThreshold(
      values.baseline,
      values.multiplier,
      values.minimumJoins,
      Number(config.raidJoinThreshold ?? 64),
      Number(config.raidWindowSeconds ?? 60),
    );

    return {
      enabled: values.enabled,
      multiplier: values.multiplier,
      minimumJoins: values.minimumJoins,
      baselinePerMinute: values.baseline,
      baselineSamples: values.samples,
      threshold,
      currentPerMinute: current.length,
      ready: values.samples >= MIN_BASELINE_SAMPLES,
      minSamples: MIN_BASELINE_SAMPLES,
      sustainSeconds: BREACH_SUSTAIN_MS / 1000,
      surgeFactor: SURGE_FACTOR,
    };
  },

  async updateSettings(
    guildId: string,
    settings: {
      enabled: boolean;
      multiplier?: number | null;
      minimumJoins?: number | null;
      hardThreshold?: number | null;
      hardWindowSeconds?: number | null;
    },
  ) {
    const config = await EntrySecurityConfig.findOne({ guildId });
    if (!config) throw new Error("Entry Security ยังไม่ได้ Setup");

    config.adaptiveRaidEnabled = settings.enabled;

    if (settings.multiplier !== null && settings.multiplier !== undefined) {
      config.adaptiveRaidMultiplier = clamp(settings.multiplier, 2, 20);
    }

    if (settings.minimumJoins !== null && settings.minimumJoins !== undefined) {
      config.adaptiveRaidMinimumJoins = clamp(
        Math.round(settings.minimumJoins),
        5,
        100,
      );
    }

    if (settings.hardThreshold !== null && settings.hardThreshold !== undefined) {
      config.raidJoinThreshold = clamp(
        Math.round(settings.hardThreshold),
        3,
        100,
      );
    }

    if (
      settings.hardWindowSeconds !== null &&
      settings.hardWindowSeconds !== undefined
    ) {
      config.raidWindowSeconds = clamp(
        Math.round(settings.hardWindowSeconds),
        10,
        300,
      );
    }

    await config.save();
    return config;
  },

  async resetBaseline(guildId: string) {
    const config = await EntrySecurityConfig.findOne({ guildId });
    if (!config) throw new Error("Entry Security ยังไม่ได้ Setup");

    config.adaptiveBaselineJoinsPerMinute = 0;
    config.adaptiveBaselineSamples = 0;
    config.adaptiveLastBaselineAt = null;
    await config.save();

    baselineWindows.delete(guildId);
    rollingJoins.delete(guildId);
    breachStartedAt.delete(guildId);

    return config;
  },
};
