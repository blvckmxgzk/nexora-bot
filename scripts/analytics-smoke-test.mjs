import {
  readFile,
} from "node:fs/promises";

const files = [
  "dist/models/AnalyticsSnapshot.js",
  "dist/services/analyticsService.js",
  "dist/services/analyticsRuntime.js",
  "dist/commands/admin/analytics.js",
];

for (
  const file of
    files
) {
  await readFile(
    file,
    "utf8",
  );
}

const analytics =
  await import(
    "../dist/services/analyticsService.js"
  );

const command =
  await import(
    "../dist/commands/admin/analytics.js"
  );

const now =
  new Date(
    "2026-09-18T12:00:00.000Z",
  );

const today =
  analytics.getAnalyticsRange(
    "today",
    now,
  );

const week =
  analytics.getAnalyticsRange(
    "7d",
    now,
  );

const month =
  analytics.getAnalyticsRange(
    "30d",
    now,
  );

if (
  today.days !==
  1
) {
  throw new Error(
    "today range invalid",
  );
}

if (
  week.days !==
  7
) {
  throw new Error(
    "7d range invalid",
  );
}

if (
  month.days !==
  30
) {
  throw new Error(
    "30d range invalid",
  );
}

if (
  analytics.analyticsDateKey(
    now,
  ) !==
  "2026-09-18"
) {
  throw new Error(
    "Bangkok date key invalid",
  );
}

const json =
  command.data
    .toJSON();

if (
  json.name !==
  "analytics"
) {
  throw new Error(
    "/analytics missing",
  );
}

const subcommands =
  (
    json.options ??
    []
  )
    .map(
      (
        option,
      ) =>
        option.name,
    );

for (
  const name of [
    "overview",
    "activity",
    "marketplace",
    "operations",
    "history",
    "refresh",
  ]
) {
  if (
    !subcommands.includes(
      name,
    )
  ) {
    throw new Error(
      `Missing /analytics ${name}`,
    );
  }
}

console.log(
  "✅ Bangkok date ranges valid",
);

console.log(
  "✅ Daily snapshot service valid",
);

console.log(
  "✅ Analytics command structure valid",
);
