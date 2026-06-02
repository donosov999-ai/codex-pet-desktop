#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const scriptPath = path.join(root, "scripts", "check-release-tag.js");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const expectedVersion = packageJson.version;
const expectedTag = `v${expectedVersion}`;

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

if (!fs.existsSync(scriptPath)) {
  fail("missing release tag checker", { script: "scripts/check-release-tag.js" });
}

function runTagCheck(tag) {
  return spawnSync(process.execPath, ["scripts/check-release-tag.js"], {
    cwd: root,
    env: {
      ...process.env,
      GITHUB_REF_TYPE: "tag",
      GITHUB_REF_NAME: tag,
      GITHUB_REF: `refs/tags/${tag}`
    },
    encoding: "utf8"
  });
}

const matching = runTagCheck(expectedTag);
if (matching.status !== 0) {
  fail("matching release tag must pass", {
    status: matching.status,
    stdout: matching.stdout,
    stderr: matching.stderr
  });
}

const matchingOutput = JSON.parse(matching.stdout);
if (matchingOutput.tag !== expectedTag || matchingOutput.version !== expectedVersion) {
  fail("matching release tag output must include tag and version", matchingOutput);
}

const mismatched = runTagCheck(`v${Number(expectedVersion.split(".")[0] || 0) + 9}.9.9`);
if (mismatched.status === 0 || !mismatched.stderr.includes("release tag mismatch")) {
  fail("mismatched release tag must fail clearly", {
    status: mismatched.status,
    stdout: mismatched.stdout,
    stderr: mismatched.stderr
  });
}

console.log(JSON.stringify({ ok: true }, null, 2));
