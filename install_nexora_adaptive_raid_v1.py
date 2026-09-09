from pathlib import Path
from datetime import datetime
import shutil
import re

ROOT = Path('.')
STAMP = datetime.now().strftime('%Y%m%d-%H%M%S')
BACKUP = Path('/workspaces/nexo-entry-security-backups') / f'adaptive-raid-{STAMP}'

TARGETS = [
    'src/models/EntrySecurityConfig.ts',
    'src/services/community/entrySecurityService.ts',
    'src/commands/moderation/entry.ts',
]

for rel in TARGETS:
    path = ROOT / rel
    if not path.exists():
        raise SystemExit(f'❌ missing: {rel}')
    backup = BACKUP / rel
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup)

print(f'📦 Backup: {BACKUP}')

adaptive_path = ROOT / 'src/services/community/adaptiveRaidService.ts'
adaptive_path.parent.mkdir(parents=True, exist_ok=True)
if adaptive_path.exists():
    backup = BACKUP / 'src/services/community/adaptiveRaidService.ts'
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(adaptive_path, backup)

adaptive_path.write_text(r'''import {
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
'''.strip() + '\n', encoding='utf-8')

print('✅ src/services/community/adaptiveRaidService.ts')

# Model
model_path = ROOT / 'src/models/EntrySecurityConfig.ts'
model = model_path.read_text(encoding='utf-8')
model = re.sub(
    r'raidJoinThreshold:\s*\{\s*type:\s*Number,\s*default:\s*\d+,\s*min:\s*3,\s*max:\s*100\s*\}',
    'raidJoinThreshold: { type: Number, default: 64, min: 3, max: 100 }',
    model,
    count=1,
)
model = re.sub(
    r'raidWindowSeconds:\s*\{\s*type:\s*Number,\s*default:\s*\d+,\s*min:\s*10,\s*max:\s*300\s*\}',
    'raidWindowSeconds: { type: Number, default: 60, min: 10, max: 300 }',
    model,
    count=1,
)

if 'adaptiveRaidEnabled' not in model:
    marker = '    lastRaidTriggeredAt: { type: Date, default: null },'
    block = '''    adaptiveRaidEnabled: { type: Boolean, default: true },
    adaptiveRaidMultiplier: { type: Number, default: 6, min: 2, max: 20 },
    adaptiveRaidMinimumJoins: { type: Number, default: 20, min: 5, max: 100 },
    adaptiveBaselineJoinsPerMinute: { type: Number, default: 0, min: 0 },
    adaptiveBaselineSamples: { type: Number, default: 0, min: 0 },
    adaptiveLastBaselineAt: { type: Date, default: null },
    lastRaidTriggeredAt: { type: Date, default: null },'''
    if marker not in model:
        raise SystemExit('❌ EntrySecurityConfig adaptive marker not found')
    model = model.replace(marker, block, 1)

model_path.write_text(model, encoding='utf-8')
print('✅ EntrySecurityConfig adaptive fields + hard 64/60')

# Service
service_path = ROOT / 'src/services/community/entrySecurityService.ts'
service = service_path.read_text(encoding='utf-8')

if 'from "./adaptiveRaidService.js"' not in service:
    marker = 'import { securityService } from "./securityService.js";'
    replacement = marker + '\nimport { adaptiveRaidService } from "./adaptiveRaidService.js";'
    if marker not in service:
        raise SystemExit('❌ entrySecurityService import marker not found')
    service = service.replace(marker, replacement, 1)

service = service.replace('const joinBuckets = new Map<string, number[]>();\n\n', '', 1)
service = service.replace(
    '''          raidJoinThreshold: 8,
          raidWindowSeconds: 30,''',
    '''          raidJoinThreshold: 64,
          raidWindowSeconds: 60,
          adaptiveRaidEnabled: true,
          adaptiveRaidMultiplier: 6,
          adaptiveRaidMinimumJoins: 20,
          adaptiveBaselineJoinsPerMinute: 0,
          adaptiveBaselineSamples: 0,''',
    1,
)

if 'adaptiveRaidEnabled: true' not in service:
    marker = '''          raidJoinThreshold: 64,
          raidWindowSeconds: 60,'''
    replacement = '''          raidJoinThreshold: 64,
          raidWindowSeconds: 60,
          adaptiveRaidEnabled: true,
          adaptiveRaidMultiplier: 6,
          adaptiveRaidMinimumJoins: 20,
          adaptiveBaselineJoinsPerMinute: 0,
          adaptiveBaselineSamples: 0,'''
    if marker in service:
        service = service.replace(marker, replacement, 1)

start_marker = '    const now = Date.now();\n    const windowMs = config.raidWindowSeconds * 1000;'
end_marker = '    await this.quarantineMember(\n'

if 'const detection =' not in service:
    start = service.find(start_marker)
    if start < 0:
        raise SystemExit('❌ handleJoin start marker not found')
    end = service.find(end_marker, start)
    if end < 0:
        raise SystemExit('❌ handleJoin end marker not found')

    new_block = '''    const detection =
      await adaptiveRaidService
        .observeJoin(
          config,
          member.guild.id,
        );

    if (
      !config.raidMode &&
      detection.triggered
    ) {
      config.raidMode = true;
      config.lastRaidTriggeredAt = new Date();
      await config.save();

      const reason =
        detection.reason === "hard_limit"
          ? `Hard limit: ${detection.hardCount}/${detection.hardWindowSeconds}s`
          : `Adaptive: ${detection.currentPerMinute}/60s • baseline ${detection.baselinePerMinute.toFixed(2)}/min • threshold ${detection.adaptiveThreshold}/min`;

      await sendLog(
        member.guild,
        config,
        "🚨 Entry Raid Mode AUTO-ENABLED",
        [
          `**Reason:** ${reason}`,
          `**Hard ceiling:** ${detection.hardThreshold}/${detection.hardWindowSeconds}s`,
          `**Adaptive baseline:** ${detection.baselinePerMinute.toFixed(2)} joins/min`,
          `**Adaptive threshold:** ${detection.adaptiveThreshold} joins/min`,
          "",
          "สมาชิกใหม่ทั้งหมดจะถูก Quarantine และต้อง Staff Review",
        ].join("\\n"),
        0xed4245,
      );

      try {
        const incident =
          await securityService
            .createIncident({
              guildId: member.guild.id,
              type: "join_raid",
              severity: "critical",
              executorId: null,
              targetId: member.id,
              action: "entry_raid_mode",
              description: `Join raid detected • ${reason}`,
              metadata: {
                reason: detection.reason,
                hardCount: detection.hardCount,
                hardThreshold: detection.hardThreshold,
                hardWindowSeconds: detection.hardWindowSeconds,
                currentPerMinute: detection.currentPerMinute,
                adaptiveThreshold: detection.adaptiveThreshold,
                baselinePerMinute: detection.baselinePerMinute,
                baselineSamples: detection.baselineSamples,
              },
            });

        await securityService
          .sendIncidentLog(
            member.guild,
            incident,
          );
      } catch {
        // Security Core may not be configured yet.
      }
    }

'''
    service = service[:start] + new_block + service[end:]

service_path.write_text(service, encoding='utf-8')
print('✅ entrySecurityService adaptive detector')

# Command
command_path = ROOT / 'src/commands/moderation/entry.ts'
command = command_path.read_text(encoding='utf-8')

if 'adaptiveRaidService' not in command:
    marker = 'import { EntryVerificationRequest } from "../../models/EntryVerificationRequest.js";'
    replacement = marker + '\nimport { adaptiveRaidService } from "../../services/community/adaptiveRaidService.js";'
    if marker not in command:
        raise SystemExit('❌ entry.ts import marker not found')
    command = command.replace(marker, replacement, 1)

if '.setName("adaptive")' not in command:
    marker = '''  .addSubcommand((c) =>
    c.setName("pending").setDescription("ดู Verification ที่รอตรวจ"),
  );'''
    block = '''  .addSubcommand((c) =>
    c
      .setName("adaptive")
      .setDescription("ปรับ Adaptive Raid Detection")
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("Enable / Disable")
          .setRequired(true)
          .addChoices(
            { name: "Enable", value: "enable" },
            { name: "Disable", value: "disable" },
          ),
      )
      .addNumberOption((o) =>
        o
          .setName("multiplier")
          .setDescription("Baseline multiplier เช่น 6 = 6× จากอัตราปกติ")
          .setMinValue(2)
          .setMaxValue(20),
      )
      .addIntegerOption((o) =>
        o
          .setName("min_joins")
          .setDescription("Adaptive trigger ต่ำสุดต่อ 60 วินาที")
          .setMinValue(5)
          .setMaxValue(100),
      )
      .addIntegerOption((o) =>
        o
          .setName("hard_threshold")
          .setDescription("Hard raid ceiling")
          .setMinValue(3)
          .setMaxValue(100),
      )
      .addIntegerOption((o) =>
        o
          .setName("hard_window")
          .setDescription("Hard ceiling window (วินาที)")
          .setMinValue(10)
          .setMaxValue(300),
      ),
  )
  .addSubcommand((c) =>
    c.setName("adaptive-reset").setDescription("Reset Adaptive baseline เพื่อเรียนรู้ใหม่"),
  )
  .addSubcommand((c) =>
    c.setName("pending").setDescription("ดู Verification ที่รอตรวจ"),
  );'''
    if marker not in command:
        raise SystemExit('❌ entry.ts builder insertion marker not found')
    command = command.replace(marker, block, 1)

if 'const adaptive =' not in command:
    marker = '''    const pending = await EntryVerificationRequest.countDocuments({
      guildId: guild.id,
      status: "pending",
    });

    await interaction.reply({'''
    replacement = '''    const pending = await EntryVerificationRequest.countDocuments({
      guildId: guild.id,
      status: "pending",
    });

    const adaptive =
      adaptiveRaidService
        .getStatus(
          config,
          guild.id,
        );

    await interaction.reply({'''
    if marker not in command:
        raise SystemExit('❌ entry.ts status prelude marker not found')
    command = command.replace(marker, replacement, 1)

if 'name: "Adaptive Raid"' not in command:
    marker = '''            {
              name: "Raid Trigger",
              value: `${config.raidJoinThreshold} joins / ${config.raidWindowSeconds}s`,
              inline: true,
            },'''
    replacement = '''            {
              name: "Raid Trigger",
              value: `${config.raidJoinThreshold} joins / ${config.raidWindowSeconds}s`,
              inline: true,
            },
            {
              name: "Adaptive Raid",
              value: adaptive.enabled
                ? adaptive.ready
                  ? `🟢 ON • ${adaptive.multiplier}× baseline`
                  : `🟡 Learning ${adaptive.baselineSamples}/${adaptive.minSamples}`
                : "🔴 OFF",
              inline: true,
            },
            {
              name: "Learned Baseline",
              value: `${adaptive.baselinePerMinute.toFixed(2)} joins/min`,
              inline: true,
            },
            {
              name: "Adaptive Trigger",
              value: `${adaptive.threshold} joins/60s • current ${adaptive.currentPerMinute}/60s`,
              inline: true,
            },'''
    if marker not in command:
        raise SystemExit('❌ entry.ts Raid Trigger field marker not found')
    command = command.replace(marker, replacement, 1)

if 'sub ===\n      "adaptive"' not in command and 'sub === "adaptive"' not in command:
    marker = '    if (sub === "pending") {'
    block = '''    if (
      sub ===
      "adaptive"
    ) {
      const enabled =
        interaction.options
          .getString(
            "mode",
            true,
          ) ===
        "enable";

      const multiplier =
        interaction.options
          .getNumber(
            "multiplier",
          );

      const minimumJoins =
        interaction.options
          .getInteger(
            "min_joins",
          );

      const hardThreshold =
        interaction.options
          .getInteger(
            "hard_threshold",
          );

      const hardWindowSeconds =
        interaction.options
          .getInteger(
            "hard_window",
          );

      const config =
        await adaptiveRaidService
          .updateSettings(
            guild.id,
            {
              enabled,
              multiplier,
              minimumJoins,
              hardThreshold,
              hardWindowSeconds,
            },
          );

      const adaptive =
        adaptiveRaidService
          .getStatus(
            config,
            guild.id,
          );

      await interaction.editReply({
        content: [
          "✅ Adaptive Raid settings updated",
          `Adaptive: **${adaptive.enabled ? "ON" : "OFF"}**`,
          `Baseline multiplier: **${adaptive.multiplier}×**`,
          `Minimum trigger: **${adaptive.minimumJoins}/60s**`,
          `Current learned baseline: **${adaptive.baselinePerMinute.toFixed(2)}/min**`,
          `Calculated trigger: **${adaptive.threshold}/60s**`,
          `Hard ceiling: **${config.raidJoinThreshold}/${config.raidWindowSeconds}s**`,
        ].join("\\n"),
      });

      return;
    }

    if (
      sub ===
      "adaptive-reset"
    ) {
      await adaptiveRaidService
        .resetBaseline(
          guild.id,
        );

      await interaction.editReply({
        content:
          "✅ Reset Adaptive Raid baseline แล้ว • ระบบจะเรียนรู้ traffic ใหม่อย่างน้อย 5 นาที",
      });

      return;
    }

    if (sub === "pending") {'''
    if marker not in command:
        raise SystemExit('❌ entry.ts execute insertion marker not found')
    command = command.replace(marker, block, 1)

command_path.write_text(command, encoding='utf-8')
print('✅ /entry adaptive + adaptive-reset + adaptive status')

# Tests
test_path = ROOT / 'tests/adaptive-raid.test.ts'
test_path.parent.mkdir(parents=True, exist_ok=True)
test_path.write_text(r'''import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateAdaptiveThreshold,
} from "../src/services/community/adaptiveRaidService.ts";

describe(
  "NEXORA Adaptive Raid Detection",
  () => {
    it(
      "uses the minimum threshold on low baseline traffic",
      () => {
        expect(
          calculateAdaptiveThreshold(
            1,
            6,
            20,
            64,
            60,
          ),
        ).toBe(20);
      },
    );

    it(
      "scales with normal server growth",
      () => {
        expect(
          calculateAdaptiveThreshold(5, 6, 20, 64, 60),
        ).toBe(30);

        expect(
          calculateAdaptiveThreshold(10, 6, 20, 64, 60),
        ).toBe(60);
      },
    );

    it(
      "never raises the adaptive trigger above hard 64/60",
      () => {
        expect(
          calculateAdaptiveThreshold(100, 6, 20, 64, 60),
        ).toBe(64);
      },
    );

    it(
      "normalizes a non-60-second hard window",
      () => {
        expect(
          calculateAdaptiveThreshold(20, 6, 20, 64, 120),
        ).toBe(32);
      },
    );
  },
);
'''.strip() + '\n', encoding='utf-8')
print('✅ tests/adaptive-raid.test.ts')

print()
print('🎉 NEXORA Adaptive Raid Detection installed')
print('   Hard ceiling: configurable; recommended 64 joins / 60s')
print('   Adaptive default: 6× learned baseline, minimum 20/min')
print('   Warm-up: 5 clean baseline windows')
print('   Trigger: sustained 10s or 1.25× surge')
print()
print('Next:')
print('  git diff --check')
print('  npx tsc --noEmit')
print('  npx vitest run tests/adaptive-raid.test.ts')
print('  npx vitest run')
print('  npm run deploy')
