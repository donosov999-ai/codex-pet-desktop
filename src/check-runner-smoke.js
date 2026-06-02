#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

if (packageJson.scripts?.check !== "node scripts/run-check.js") {
  fail("check script must delegate to scripts/run-check.js", {
    check: packageJson.scripts?.check || ""
  });
}

const runner = require("../scripts/run-check.js");
const commands = runner.CHECK_COMMANDS || [];
const names = commands.map((command) => command.name);

const expectedOrder = ["Smoke", "Rust format check", "Rust Clippy", "Rust tests"];
for (const expected of expectedOrder) {
  if (!names.includes(expected)) {
    fail("check runner is missing a required stage", { expected, names });
  }
}

if (expectedOrder.some((name, index) => names.indexOf(name) !== index)) {
  fail("check runner stages must stay in release quality-gate order", { names });
}

if (commands.some((command) => !Array.isArray(command.args) || !command.args.length || !command.cwd)) {
  fail("every check command must have argv-style args and cwd", { commands });
}

console.log(JSON.stringify({ ok: true, count: commands.length }, null, 2));
