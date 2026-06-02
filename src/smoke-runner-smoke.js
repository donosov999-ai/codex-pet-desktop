#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

if (packageJson.scripts?.smoke !== "node scripts/run-smoke.js") {
  fail("smoke script must delegate to scripts/run-smoke.js", {
    smoke: packageJson.scripts?.smoke || ""
  });
}

const runner = require("../scripts/run-smoke.js");
const commands = runner.SMOKE_COMMANDS || [];
const names = commands.map((command) => command.name);

if (!Array.isArray(commands) || commands.length < 30) {
  fail("runner must expose the full smoke command list", { count: commands.length });
}

if (names.some((name) => typeof name !== "string" || !name.trim())) {
  fail("every smoke command must have a readable name", { names });
}

if (commands.some((command) => !Array.isArray(command.args) || !command.args.length)) {
  fail("every smoke command must have argv-style args", { commands });
}

const buildIndex = names.indexOf("Build petpacks");
const visualQaIndex = names.indexOf("Visual QA page smoke");
const downloadPageIndex = names.indexOf("Download page smoke");
if (buildIndex < 0 || visualQaIndex < 0 || downloadPageIndex < 0) {
  fail("runner is missing generated asset smoke stages", { names });
}

if (buildIndex > visualQaIndex || buildIndex > downloadPageIndex) {
  fail("petpacks must be built before generated page smoke tests", { names });
}

console.log(JSON.stringify({ ok: true, count: commands.length }, null, 2));
