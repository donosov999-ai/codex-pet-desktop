#!/usr/bin/env node

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

const SMOKE_COMMANDS = [
  ["Build app config smoke", "node", ["src/build-app-config-smoke.js"]],
  ["Pet resource smoke", "node", ["src/smoke.js"]],
  ["Pet JSON format smoke", "node", ["src/pet-json-format-smoke.js"]],
  ["Smoke runner smoke", "node", ["src/smoke-runner-smoke.js"]],
  ["Check runner smoke", "node", ["src/check-runner-smoke.js"]],
  ["Release tag smoke", "node", ["src/release-tag-smoke.js"]],
  ["Release scope smoke", "node", ["src/release-scope-smoke.js"]],
  ["Renderer petpack helpers smoke", "node", ["src/renderer-petpack-helpers-smoke.mjs"]],
  ["Renderer empty smoke", "node", ["src/renderer-empty-smoke.js"]],
  ["Renderer empty window layout smoke", "node", ["src/renderer-empty-window-layout-smoke.js"]],
  ["Renderer import cache smoke", "node", ["src/renderer-import-cache-smoke.js"]],
  ["Renderer manager smoke", "node", ["src/renderer-manager-smoke.js"]],
  ["Renderer update smoke", "node", ["src/renderer-update-smoke.js"]],
  ["Renderer update failure smoke", "node", ["src/renderer-update-failure-smoke.js"]],
  ["Renderer update progress smoke", "node", ["src/renderer-update-progress-smoke.js"]],
  ["Renderer direction smoke", "node", ["src/renderer-direction-smoke.js"]],
  ["Renderer Chinese smoke", "node", ["src/renderer-chinese-smoke.js"]],
  ["Renderer store smoke", "node", ["src/renderer-store-smoke.js"]],
  ["Renderer store progress smoke", "node", ["src/renderer-store-progress-smoke.js"]],
  ["Renderer window interaction smoke", "node", ["src/renderer-window-interaction-smoke.js"]],
  ["Renderer panel close layout smoke", "node", ["src/renderer-panel-close-layout-smoke.js"]],
  ["Renderer tray command smoke", "node", ["src/renderer-tray-command-smoke.js"]],
  ["Renderer settings smoke", "node", ["src/renderer-settings-smoke.js"]],
  ["Renderer first-run store smoke", "node", ["src/renderer-first-run-store-smoke.js"]],
  ["Renderer store filter smoke", "node", ["src/renderer-store-filter-smoke.js"]],
  ["Renderer store enhanced smoke", "node", ["src/renderer-store-enhanced-smoke.js"]],
  ["Renderer panel tabs smoke", "node", ["src/renderer-panel-tabs-smoke.js"]],
  ["Renderer tray state sync smoke", "node", ["src/renderer-tray-state-sync-smoke.js"]],
  ["Renderer update detail smoke", "node", ["src/renderer-update-detail-smoke.js"]],
  ["Renderer natural behavior smoke", "node", ["src/renderer-natural-behavior-smoke.js"]],
  ["Renderer life engine smoke", "node", ["src/renderer-life-engine-smoke.mjs"]],
  ["Renderer life integration smoke", "node", ["src/renderer-life-integration-smoke.js"]],
  ["Renderer edge behavior smoke", "node", ["src/renderer-edge-behavior-smoke.js"]],
  ["Renderer behavior config smoke", "node", ["src/renderer-behavior-config-smoke.js"]],
  ["Renderer window layout smoke", "node", ["src/renderer-window-layout-smoke.js"]],
  ["Petpack QA smoke", "node", ["src/petpack-qa-smoke.js"]],
  ["Petpack builder smoke", "node", ["src/petpack-builder-smoke.js"]],
  ["Build petpacks", "node", ["scripts/build-petpacks.js"]],
  ["Visual QA page smoke", "node", ["src/visual-qa-page-smoke.js"]],
  ["Download page smoke", "node", ["src/download-page-smoke.js"]],
  ["Workflow runtime smoke", "node", ["src/workflow-runtime-smoke.js"]]
].map(([name, command, args]) => ({ name, command, args }));

function commandFor(command) {
  return command === "node" ? process.execPath : command;
}

function runSmokeCommands(commands = SMOKE_COMMANDS) {
  for (const smoke of commands) {
    console.log(`\n[smoke] ${smoke.name}`);
    const result = spawnSync(commandFor(smoke.command), smoke.args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32" && smoke.command !== "node"
    });
    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }
  return 0;
}

if (require.main === module) {
  process.exit(runSmokeCommands());
}

module.exports = {
  SMOKE_COMMANDS,
  runSmokeCommands
};
