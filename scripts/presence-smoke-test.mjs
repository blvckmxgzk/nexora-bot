import {
  readFile,
} from "node:fs/promises";

await readFile(
  "dist/services/botPresenceRuntime.js",
  "utf8",
);

const presence =
  await import(
    "../dist/services/botPresenceRuntime.js"
  );

if (
  presence.NEXORA_STATUS_TEXT !==
  "กำลังให้บริการ NEXORA"
) {
  throw new Error(
    "Presence text incorrect",
  );
}

if (
  !presence.botPresenceRuntime
) {
  throw new Error(
    "Presence runtime missing",
  );
}

if (
  typeof presence
    .botPresenceRuntime
    .start !==
  "function"
) {
  throw new Error(
    "Presence start missing",
  );
}

if (
  typeof presence
    .botPresenceRuntime
    .stop !==
  "function"
) {
  throw new Error(
    "Presence stop missing",
  );
}

console.log(
  "✅ Status: กำลังให้บริการ NEXORA",
);

console.log(
  "✅ Presence runtime valid",
);
