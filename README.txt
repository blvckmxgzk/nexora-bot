NEXORA Disaster Recovery v1

New files only:
- src/community/recovery/recoveryPolicy.ts
- src/models/GuildRecoveryConfig.ts
- src/models/GuildSnapshot.ts
- src/services/community/recoveryService.ts
- src/events/recoveryReady.ts
- src/commands/moderation/recovery.ts
- tests/recovery-policy.test.ts

The existing recursive command/event loaders should discover these files automatically.

Install:
  unzip -o nexora-disaster-recovery-v1.zip -d .
  git diff --check
  npx tsc --noEmit
  npx vitest run tests/recovery-policy.test.ts
  npx vitest run
  npm run deploy
