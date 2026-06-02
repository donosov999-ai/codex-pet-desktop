#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const builderPath = path.join(root, "scripts", "build-petpacks.js");
const zipPath = path.join(root, "scripts", "petpack-zip.js");
const visualQaPath = path.join(root, "scripts", "render-visual-qa-page.js");
const source = fs.readFileSync(builderPath, "utf8");

function fail(reason, details = {}) {
  console.error(JSON.stringify({ ok: false, reason, ...details }, null, 2));
  process.exit(1);
}

const forbidden = [
  "node:child_process",
  "spawnSync",
  'sh("zip"',
  "sh('zip'"
].filter((pattern) => source.includes(pattern));

if (forbidden.length) {
  fail("petpack builder must not depend on external zip commands", { forbidden });
}

if (!fs.existsSync(zipPath)) {
  fail("petpack zip helpers must live in scripts/petpack-zip.js");
}
if (!fs.existsSync(visualQaPath)) {
  fail("visual QA renderer must live in scripts/render-visual-qa-page.js");
}

const zipSource = fs.readFileSync(zipPath, "utf8");
const visualQaSource = fs.readFileSync(visualQaPath, "utf8");

for (const extracted of ["function createPetpackZip", "function crc32", "function writeUInt32LE"]) {
  if (source.includes(extracted)) {
    fail("petpack builder must delegate zip writing to scripts/petpack-zip.js", { extracted });
  }
  if (!zipSource.includes(extracted)) {
    fail("petpack zip helper is missing expected implementation", { extracted });
  }
}

for (const extracted of ["function renderVisualQaPage", "function escapeHtml"]) {
  if (source.includes(extracted)) {
    fail("petpack builder must delegate visual QA rendering to scripts/render-visual-qa-page.js", { extracted });
  }
  if (!visualQaSource.includes(extracted)) {
    fail("visual QA renderer is missing expected implementation", { extracted });
  }
}

console.log(JSON.stringify({ ok: true }, null, 2));
