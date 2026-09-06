import chokidar from "chokidar";
import { execSync } from "node:child_process";

let timer = null;
let running = false;

const run = (command) => {
  console.log(`\n> ${command}`);
  execSync(command, {
    stdio: "inherit",
    shell: true,
  });
};

const push = () => {
  if (running) {
    console.log("⏳ Auto-push กำลังทำงานอยู่...");
    return;
  }

  running = true;

  try {
    console.log("\n🔨 Running build...");
    run("npm run build");

    console.log("\n📦 Adding changes...");
    run("git add .");

    const status = execSync("git status --porcelain", {
      encoding: "utf8",
      shell: true,
    }).trim();

    if (!status) {
      console.log("ℹ️ ไม่มีไฟล์ที่เปลี่ยนแปลง");
      return;
    }

    const message = `chore: auto-update ${new Date().toISOString()}`;

    console.log("\n📝 Creating commit...");
    run(`git commit -m "${message}"`);

    console.log("\n☁️ Pushing to GitHub...");
    run("git push origin main");

    console.log("\n✅ Auto-push สำเร็จ!");
  } catch (error) {
    console.error("\n❌ Auto-push หยุด เพราะ build/commit/push ไม่สำเร็จ");
  } finally {
    running = false;
  }
};

const watcher = chokidar.watch(
  [
    "src/**/*",
    "scripts/**/*",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ],
  {
    ignored: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**",
    ],
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  },
);

watcher.on("all", (event, file) => {
  console.log(`\n👀 ${event}: ${file}`);

  clearTimeout(timer);

  timer = setTimeout(() => {
    push();
  }, 3000);
});

console.log("🚀 NEXORA Auto-Push started");
console.log("💾 Save file → Build → Commit → Push");
console.log("🛑 Press Ctrl+C to stop\n");
