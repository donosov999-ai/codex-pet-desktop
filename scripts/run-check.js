#!/usr/bin/env node

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const tauriRoot = path.join(root, "src-tauri");

const CHECK_COMMANDS = [
  ["Smoke", "node", ["scripts/run-smoke.js"], root],
  ["Rust format check", "cargo", ["fmt", "--check"], tauriRoot],
  ["Rust Clippy", "cargo", ["clippy", "--all-targets", "--", "-D", "warnings"], tauriRoot],
  ["Rust tests", "cargo", ["test"], tauriRoot]
].map(([name, command, args, cwd]) => ({ name, command, args, cwd }));

function commandFor(command) {
  if (command === "node") {
    return process.execPath;
  }
  return process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
}

function runCheckCommands(commands = CHECK_COMMANDS) {
  for (const check of commands) {
    console.log(`\n[check] ${check.name}`);
    const result = spawnSync(commandFor(check.command), check.args, {
      cwd: check.cwd,
      stdio: "inherit",
      shell: process.platform === "win32" && check.command !== "node" && check.command !== "npm"
    });
    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }
  return 0;
}

if (require.main === module) {
  process.exit(runCheckCommands());
}

module.exports = {
  CHECK_COMMANDS,
  runCheckCommands
};
