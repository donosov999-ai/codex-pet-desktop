#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const petsRoot = path.join(root, "resources", "pets");

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

const formatterPath = path.join(root, "scripts", "format-pet-json.js");
if (!fs.existsSync(formatterPath)) {
  fail("missing pet JSON formatter", { script: "scripts/format-pet-json.js" });
}

const failures = [];
for (const entry of fs.readdirSync(petsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }
  const manifestPath = path.join(petsRoot, entry.name, "pet.json");
  if (!fs.existsSync(manifestPath)) {
    continue;
  }
  const source = fs.readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(source);
  const formatted = `${JSON.stringify(parsed, null, 2)}\n`;
  if (source !== formatted) {
    failures.push({ file: path.relative(root, manifestPath), reason: "not stable pretty JSON" });
  }
  if (/\\u[0-9a-fA-F]{4}/.test(source)) {
    failures.push({ file: path.relative(root, manifestPath), reason: "contains escaped unicode" });
  }
}

if (failures.length) {
  fail("pet JSON manifests must be stable UTF-8 JSON", { failures });
}

console.log(JSON.stringify({ ok: true }, null, 2));
