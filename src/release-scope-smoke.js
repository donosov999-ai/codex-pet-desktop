#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const scriptPath = path.join(root, "scripts", "release-scope.js");

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(scriptPath)) {
  fail("missing release scope helper", { script: "scripts/release-scope.js" });
}

function scopeFor(paths) {
  const result = spawnSync(process.execPath, ["scripts/release-scope.js", ...paths], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    fail("release scope helper failed", { paths, stdout: result.stdout, stderr: result.stderr });
  }
  return JSON.parse(result.stdout);
}

const readmeOnly = scopeFor(["README.md"]);
if (readmeOnly.scope !== "docs-only" || readmeOnly.appReleaseRequired || readmeOnly.tagRequired || readmeOnly.pagesDeployLikely) {
  fail("README-only changes must not require release or pages deploy", readmeOnly);
}

const petOnly = scopeFor(["resources/pets/mi-fen/pet.json"]);
if (petOnly.scope !== "petpack-pages" || petOnly.appReleaseRequired || petOnly.tagRequired || !petOnly.pagesDeployLikely) {
  fail("pet resource changes must route to Pages without app release", petOnly);
}

const appChange = scopeFor(["src/app/renderer/index.js"]);
if (appChange.scope !== "app-release-required" || !appChange.appReleaseRequired || !appChange.tagRequired) {
  fail("app changes must require desktop release", appChange);
}

const releaseWorkflowChange = scopeFor([".github/workflows/release.yml"]);
if (releaseWorkflowChange.scope !== "app-release-required" || !releaseWorkflowChange.appReleaseRequired || !releaseWorkflowChange.tagRequired) {
  fail("release workflow changes must require desktop release", releaseWorkflowChange);
}

const mixedChange = scopeFor(["README.md", "src-tauri/src/commands.rs"]);
if (mixedChange.scope !== "app-release-required" || !mixedChange.appReleaseRequired || !mixedChange.tagRequired) {
  fail("mixed README and app changes must require desktop release", mixedChange);
}

const smokeChange = scopeFor(["src/petpack-builder-smoke.js"]);
if (smokeChange.scope !== "app-release-required" || !smokeChange.appReleaseRequired || !smokeChange.tagRequired) {
  fail("smoke test changes must require desktop release because they affect quality gates", smokeChange);
}

const source = fs.readFileSync(scriptPath, "utf8");
if (!source.includes('"ls-files", "--others", "--exclude-standard"')) {
  fail("release scope helper must include untracked files when no paths are provided");
}

console.log(JSON.stringify({ ok: true }, null, 2));
